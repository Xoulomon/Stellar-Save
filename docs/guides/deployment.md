# Deployment Guide

## 1. Pre-flight Checklist
- Set `NODE_ENV=production` for mainnet and `NODE_ENV=test` for testnets.
- Prepare private key env var: `PRIVATE_KEY=0x...` (use a secure vault, not plain text)
- RPC URLs: `ALCHEMY_API_KEY`, `INFURA_API_KEY`, `NODE_URL`.
- Etherscan API key: `ETHERSCAN_API_KEY`.
- Ensure `hardhat.config.ts` or `hardhat.config.js` has Sepolia/Goerli/Mainnet networks set.
- Confirm you have enough ETH in wallet for gas and deployment.
- Lock dependency versions (`npm ci` or `yarn install --frozen-lockfile`).

## 2. Setup
1. Install dependencies:
   - `npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers @nomiclabs/hardhat-etherscan dotenv`
2. Create `.env` and add variables:
   - `PRIVATE_KEY=`
   - `ALCHEMY_API_KEY=`
   - `ETHERSCAN_API_KEY=`

## 3. Deploy to Sepolia/Goerli
1. Build:
   - `npx hardhat compile`
2. Deploy script (example `scripts/deploy.ts`):
   ```ts
   import { ethers } from "hardhat";

   async function main() {
     const MyContract = await ethers.getContractFactory("MyContract");
     const deployed = await MyContract.deploy();
     await deployed.deployed();
     console.log("MyContract deployed to", deployed.address);
   }

   main().catch((error) => {
     console.error(error);
     process.exitCode = 1;
   });
   ```
3. Run deployment:
   - Sepolia: `npx hardhat run scripts/deploy.ts --network sepolia`
   - Goerli: `npx hardhat run scripts/deploy.ts --network goerli`

## 4. Ethereum Mainnet
- Validate all testing is complete, gas usage optimized.
- Use a timelocked multisig wallet for deployment and admin roles.
- Deploy:
  - `npx hardhat run scripts/deploy.ts --network mainnet`

## 5. Etherscan Verification
1. Publish source code with:
   - `npx hardhat verify --network sepolia <contractAddress> "Constructor arg 1" "arg 2"`
2. For proxy contracts use `@openzeppelin/hardhat-upgrades` verification method:
   - `npx hardhat verify --network goerli <implementation_address> "args"`
3. If using full flatten, specify compiler settings in `hardhat.config`.

## 6. Troubleshooting
### 6.1 Out of Gas
- Increase gas limit in command:
  - `npx hardhat run scripts/deploy.ts --network sepolia --gas 8000000`
- In `hardhat.config`, add `gas` and `gasPrice` or use `maxFeePerGas`.
- Optimize Solidity code: use `uint256` where appropriate, avoid expensive loops.

### 6.2 Replacement transaction underpriced
- Use higher gas price:
  - `npx hardhat run scripts/deploy.ts --network sepolia --gas-price 150000000000`
- Use EIP-1559 fields:
  - `maxFeePerGas`, `maxPriorityFeePerGas`.
- Wait for network congestion to reduce or use another RPC endpoint.

## 7. Post-Deployment
- Verify contract is verified on Etherscan.
- Perform sanity checks: `owner()`, `totalSupply()`, `paused()`, etc.
- Execute small value test transactions first.
- Document deployed addresses and ABI outputs.
