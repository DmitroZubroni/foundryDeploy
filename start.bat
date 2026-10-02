start geth --datadir network --dev --http --http.addr 127.0.0.1 --http.port 8545 --http.corsdomain * --http.api eth,web3,net,personal,miner
timeout 3
start /wait cmd /c "cd hardhat && echo yes | npx hardhat ignition deploy ignition/modules/Protocol.ts --network localhost"
start cmd /k "cd front && if not exist node_modules (npm install) && npm run dev"
