# Lending & Vault Protocol (Hardhat 3 + Geth + React)

Полнофункциональный протокол децентрализованного кредитования и доходных хранилищ (Lending / Vaults), разворачиваемый на локальной сети Geth и интегрированный с React-фронтендом.

---

## 📁 Структура проекта: что где лежит

```text
├── start.sh                      # Единый скрипт запуска для Linux/macOS (Geth -> Deploy -> Frontend)
├── start.bat                     # Единый скрипт запуска для Windows
├── network/                      # Данные локального приватного блокчейна Geth (--datadir)
│
├── hardhat/                      # Смарт-контракты, тесты, деплой и скрипты взаимодействия
│   ├── contracts/                # Исходный код смарт-контрактов на Solidity 0.8.34
│   │   ├── tokens.sol            # Токены протокола (USDC, USDT, PryUSD, USD1, DAI)
│   │   ├── Vault.sol             # Хранилище активов стандарта ERC4626 с начислением APY
│   │   ├── Market.sol            # Кредитный рынок: залог, заем, LTV, процентные ставки
│   │   └── MyProxy.sol           # Transparent Upgradeable Proxy (OpenZeppelin v5)
│   ├── ignition/
│   │   └── modules/Protocol.ts   # Сценарий деплоя Ignition: токены, хранилища, рынки, прокси
│   ├── scripts/
│   │   ├── interact.ts           # Демонстрационный скрипт вызова ВСЕХ методов контрактов
│   │   ├── sync-addresses.ts     # Синхронизация адресов деплоя в front/src/service/addresses.json
│   │   └── deploy-task-action.ts # Хук плагина Hardhat для автоматической синхронизации при деплое
│   ├── test/
│   │   ├── Protocol.t.sol        # Набор тестов на Solidity (Foundry / forge-std)
│   │   └── Protocol.test.ts      # Набор тестов на TypeScript (Mocha + Chai + Ethers v6)
│   └── hardhat.config.ts         # Конфигурация Hardhat 3, сетей и плагина автосинхронизации
│
└── front/                        # Клиентское приложение (React + Vite + Ethers)
    ├── src/
    │   ├── service/
    │   │   ├── addresses.json    # Адреса развернутых контрактов (обновляются автоматически)
    │   │   ├── marketABI.json    # ABI контракта кредитного рынка
    │   │   ├── vaultABI.json     # ABI контракта хранилища
    │   │   ├── contracts.js      # Инициализация подключения к контрактам через провайдер
    │   │   └── Contract.jsx      # React-компонент взаимодействия с блокчейном
    │   ├── core/                 # Бизнес-логика фронтенда
    │   └── ui/                   # Пользовательский интерфейс и компоненты
    ├── package.json              # Зависимости фронтенда
    └── vite.config.js            # Конфигурация сборщика Vite
```

---

## ⚡ Быстрый запуск всего проекта

### Вариант 1: В одну команду (Linux / macOS)
Скрипт фоново запускает ноду Geth, очищает старые данные деплоя, деплоит все контракты, автоматически прокидывает их адреса на фронтенд и запускает dev-сервер:
```bash
bash start.sh
```

### Вариант 2: В одну команду (Windows)
```cmd
start.bat
```

После старта:
- **Geth RPC:** `http://127.0.0.1:8545` (Chain ID: `1337`)
- **Frontend:** `http://localhost:5173`

---

## 🛠️ Перечень команд

Все команды для работы со смарт-контрактами выполняются из папки `hardhat/`.

### 1. Локальный блокчейн Geth
Запуск локальной ноды вручную в dev-режиме с открытым HTTP RPC:
```bash
geth --datadir network --dev --http --http.addr 127.0.0.1 --http.port 8545 --http.corsdomain "*" --http.api "eth,web3,net,personal,miner"
```

### 2. Компиляция смарт-контрактов
Компиляция всех контрактов Solidity 0.8.34 с оптимизатором и IR-генерацией:
```bash
cd hardhat
npx hardhat compile
```

### 3. Деплой контрактов
Деплой всей экосистемы (токены, 2 хранилища, 3 прокси-рынка, распределение ликвидности):
```bash
cd hardhat
# Сброс предыдущего состояния локального деплоя (при необходимости)
rm -rf ignition/deployments/chain-1337

# Деплой в локальную сеть
echo "yes" | npx hardhat ignition deploy ignition/modules/Protocol.ts --network localhost
```
> **Автоматическая синхронизация адресов:**  
> При завершении деплоя хук Hardhat автоматически перезаписывает адреса в файле `front/src/service/addresses.json`.  
> Если нужно синхронизировать адреса вручную без повторного деплоя:
> ```bash
> cd hardhat
> npx ts-node scripts/sync-addresses.ts
> ```

### 4. Интерактивный скрипт вызова всех методов
Запуск комплексного сценария, вызывающего **все** методы хранилищ, рынков и прокси с красивым логированием:
```bash
cd hardhat
npx hardhat run scripts/interact.ts --network localhost
```
*Что выполняет скрипт:*
1. Инспектирует **MyProxy**: получает `getProxyAdmin()` и `getProxyImplementation()`.
2. Вызывает все методы **Vault**: `getVault()`, `deposit()`, `getUserVault()`, `totalAssets()`, `withdrawPart()`, `withdrawFull()`.
3. Вызывает все методы **Market**: `getMarket()`, `supply()`, `borrow()`, `getUserMarket()`, `LTV()`, `totalDept()`, `accruedInterest()`, `repayPart()`, `repayFull()`, `withdrawPart()`, `withdrawFull()`.

### 5. Запуск тестов
Одновременный запуск тестов на Solidity и TypeScript:
```bash
cd hardhat
npx hardhat test
```
*Запуск отдельно по типам:*
- Только Solidity-тесты (`forge-std`):
  ```bash
  npx hardhat test test/Protocol.t.sol
  ```
- Только TypeScript-тесты (Mocha + Chai):
  ```bash
  npx hardhat test test/Protocol.test.ts
  ```

### 6. Запуск фронтенда
```bash
cd front
npm install   # если еще не установлены зависимости
npm run dev   # запуск dev-сервера на порту 5173
```
Сборка фронтенда в продакшн-бандл:
```bash
cd front
npm run build
```

---

## 🧠 Как устроены и работают компоненты

### 1. Токены (`tokens.sol`)
- Стандарт ERC20 (OpenZeppelin).
- При развертывании минтят начальный баланс (по 5 000 токенов) на три адреса.
- `USDC`, `USDT`, `PryUSD`, `USD1`, `DAI` — стейблкоины протокола.
- Содержат метод `mint` и перегруженный `transfer(address from, address to, uint amount)` для удобного перевода активов протоколом.

### 2. Хранилище (`Vault.sol`)
- Стандарт **ERC4626** (токенизированное хранилище доходности).
- Принимает базовый актив (`assetToken`, например USDC) и начисляет пользователю доли (`shares`).
- `destributeToMarkets(m1, m2, m3)`: распределяет 1/6 часть баланса хранилища по трем рынкам кредитования для обеспечения заемной ликвидности.
- `withdrawPart(amount)` и `withdrawFull()`: позволяют частичный или полный вывод базовых активов со сжиганием долей.
- Защита от микродепозитов: минимальный депозит составляет 10 токенов.

### 3. Кредитный рынок (`Market.sol`)
- Архитектура без оракулов с изолированными пулами (в стиле Morpho Blue).
- **Collateral & Borrow**: Пользователь вносит залоговый токен (`collateralToken`, например USDT) и занимает заемный токен (`borrowToken`, например USDC).
- **LTV и LLTV**:
  $$\text{LTV} = \frac{100 \times \text{totalDept} \times \text{borrowPrice}}{\text{collateralAmount} \times \text{collateralPrice}}$$
  Если текущий $\text{LTV} > \text{LLTV}$ (например, 75%), транзакция займа или вывода залога откатывается (`"LTV is larger than LLTV"`).
- **Процентная ставка (Interest Rate)**:
  Индекс заимствования (`currentBorrowIndex`) непрерывно растет по формуле начисления процентов за каждый прошедший блок.
- **Погашение долга**:
  - `repayPart(amount)`: сначала списывает начисленные проценты, распределяя комиссию 70% в Vault и 30% администратору, затем уменьшает тело долга.
  - `repayFull()`: полностью закрывает долг и проценты, сжигая все долговые доли (`borrowShare`).

### 4. Прозрачный прокси (`MyProxy.sol`)
- Реализация **Transparent Upgradeable Proxy** поверх OpenZeppelin v5.
- Позволяет обновлять логику контракта `Market` без потери состояния рынков и средств пользователей.
- `getProxyAdmin()` возвращает адрес управляющего контракта `ProxyAdmin`.
- `getProxyImplementation()` возвращает текущую реализацию `Market`.

### 5. Автоматическая передача адресов на фронтенд
1. Модуль деплоя `ignition/modules/Protocol.ts` сохраняет адреса в файл `ignition/deployments/chain-1337/deployed_addresses.json`.
2. В `hardhat.config.ts` зарегистрирован плагин `syncFrontendPlugin`, который перехватывает окончание деплоя (`ignition deploy`) и запускает функцию `syncAddresses()` из `scripts/sync-addresses.ts`.
3. Функция считывает развернутые адреса рынков и хранилищ и сохраняет их в `front/src/service/addresses.json`:
   ```json
   {
     "market1": "0x...",
     "market2": "0x...",
     "market3": "0x...",
     "vault1": "0x...",
     "vault2": "0x..."
   }
   ```
4. Фронтенд импортирует этот файл напрямую и мгновенно подключается к актуальным смарт-контрактам.
