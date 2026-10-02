#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==================================================="
echo "[1/4] Checking / Starting Geth Node..."
echo "==================================================="

if ! curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://127.0.0.1:8545 >/dev/null 2>&1; then
    echo "Starting Geth node in background..."
    geth --datadir "$DIR/network" --dev --http --http.addr 127.0.0.1 --http.port 8545 --http.corsdomain "*" --http.api "eth,web3,net,personal,miner" > /tmp/geth.log 2>&1 &
    sleep 3
fi
echo "[OK] Geth node is running on http://127.0.0.1:8545"

echo ""
echo "==================================================="
echo "[2/4] Compiling and Deploying Contracts via Hardhat..."
echo "==================================================="
cd "$DIR/hardhat"

if [ ! -d "node_modules" ]; then
    echo "Installing Hardhat dependencies..."
    npm install
fi

rm -rf ignition/deployments/chain-1337
echo "yes" | npx hardhat ignition deploy ignition/modules/Protocol.ts --network localhost

echo ""
echo "==================================================="
echo "[3/4] Syncing to Frontend..."
echo "==================================================="
npx hardhat run scripts/sync-frontend.ts

echo ""
echo "==================================================="
echo "[4/4] Starting Frontend Dev Server..."
echo "==================================================="
FRONT_DIR="front"
if [ ! -d "$DIR/front" ] && [ -d "$DIR/frontend" ]; then
    FRONT_DIR="frontend"
fi

cd "$DIR/$FRONT_DIR"
if [ ! -d "node_modules" ]; then
    echo "Installing Frontend dependencies..."
    npm install
fi

echo "[SUCCESS] Everything is ready! Starting frontend on http://localhost:5173..."
npm run dev
