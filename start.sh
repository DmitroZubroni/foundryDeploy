#!/usr/bin/env bash

# 1. Запуск Geth
geth --datadir network --dev --http --http.addr 127.0.0.1 --http.port 8545 --http.corsdomain "*" --http.api "eth,web3,net,personal,miner" > /dev/null 2>&1 &
sleep 3

# 2. Деплой контрактов
cd hardhat
rm -rf ignition/deployments/chain-1337
echo "yes" | npx hardhat ignition deploy ignition/modules/Protocol.ts --network localhost

# 3. Запуск фронтенда
cd ../front
npm run dev
