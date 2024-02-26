# Decentralized Smart Contract Lottery

This is a sample project that to allows users to engage in a fair verifiably random, autonomous decentralized lottery that is deployed on the blockchain.

## Built With
* Hardhat
* Chainlink VRF
* Chainlink Keepers

## Getting Started
### Prerequisites
* Install Yarn

    ```shell
    corepack enable
    ```

### Installation
1. Get you Sepolia RPC URL at https://www.alchemy.com/
1. Get your API keys on [Etherscan](https://etherscan.io/) and [Coinmarketcap](https://coinmarketcap.com/api/)
2. Clone the repo

    ```shell
    git clone https://github.com/vinodh-morawaka/hardhat-smart-contract-lottery.git
    ```
3. Install Yarn packages

    ```shell
    yarn install
    ```
4. Enter your API keys and your wallet's private key in `.env` file

    ```yaml
    SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
    PRIVATE_KEY=YOUR-WALLET'S PRIVATE KEY
    ETHERSCAN_API_KEY=YOUR-ETHERSCAN-API-KEY
    COINMARKETCAP_API_KEY=YOUR-COINMARKETCAP-API-KEY
    ```

## Usage
You can run tests by running:

```shell
yarn test
yarn test:staging
```

### Method 1 - By using the scripts
1. Run the `enter.js` and `mockOffchain.js` scripts in the scripts folder by running the following:

    ```shell
    yarn hardhat node
    yarn hardhat run scripts/enter.js --network localhost
    yarn hardhat run scripts/mockOffchain.js --network localhost
    ```

### Method 2 - By using the Etherscan Block Explorer
1. Visit the Sepolia testnet etherscan block explorer
2. Copy and paste the contract's address 0x04b7dc4c0ccd70aa3a6b518b4321f6bc4fdd9bcc
3. Go to the Write Contract Section under Contract
3. Connect your wallet
4. Enter the lottery by paying 0.01 ETH
5. Wait for the winner to be picked
