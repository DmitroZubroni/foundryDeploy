@echo off

:: 1. Запуск Geth
start geth --datadir network --dev --http --http.addr 127.0.0.1 --http.port 8545 --http.corsdomain * --http.api eth,web3,net,personal,miner

:: 2. Ожидание запуска Geth
timeout /t 3 >nul

:: 3. Деплой смарт-контрактов (адреса и ABI сами пробросятся во фронт)
cd hardhat
rd /s /q ignition\deployments\chain-1337 2>nul
echo yes | call npx hardhat ignition deploy ignition/modules/Protocol.ts --network localhost

:: 4. Запуск фронтенда
cd ..\front
start npm run dev
