import { network } from "hardhat";

// Подключаемся к сети localhost
const { ethers } = await network.getOrCreate("localhost");

// Адрес развернутого контракта Storage
const CONTRACT_ADDRESS = "0xdB7d6AB1f17c6b31909aE466702703dAEf9269Cf";

// Получаем инстанс контракта
const storage = await ethers.getContractAt("Storage", CONTRACT_ADDRESS);

console.log("=== Взаимодействие с контрактом Storage ===");

// 1. Чтение текущего значения (view-вызов, бесплатно)
const currentValue = await storage.retrieve();
console.log(`Текущее значение number: ${currentValue.toString()}`);

// 2. Запись нового значения (отправка транзакции)
const newValue = 777n;
console.log(`\nОтправляем транзакцию store(${newValue})...`);
const tx = await storage.store(newValue);
console.log(`Хеш транзакции: ${tx.hash}`);

// Ждем включения транзакции в блок
const receipt = await tx.wait();
console.log(`Транзакция подтверждена в блоке #${receipt?.blockNumber}`);

// 3. Проверяем обновленное значение
const updatedValue = await storage.retrieve();
console.log(`\nНовое значение number: ${updatedValue.toString()}`);
