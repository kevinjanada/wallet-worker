import TestNFT from "@wallet-worker/test-contracts/artifacts/contracts/TestNFT.sol/TestNFT.json";
import addresses from "@wallet-worker/test-contracts/config/addresses.json";
import { ethers } from "ethers";
import WalletWorker from './index';

async function main(walletWorker: WalletWorker, numTransactions: number, provider: ethers.providers.JsonRpcProvider) {
  const nftContract = new ethers.Contract(contractAddress, TestNFT.abi, provider);
  await walletWorker.initialized;
  // const processedEmails: Record<any, any>[] = []

  walletWorker.on('success', function(data: any) {
    const { returnData, tx } = data;
    const tokenIdHex = tx.logs[0].topics[3];
    const tokenIdNumber = parseInt(tokenIdHex, 16);
    console.log(`success. email: ${returnData}, tokenId: ${tokenIdNumber}`, )
  })
  walletWorker.on('error', function(error: any) {
    // console.log('error', {
    //   error
    // })
  })

  for (let i = 0; i < numTransactions; i++) {
    walletWorker.executeTransaction(
      nftContract,
      "mintTo",
      [process.env.CUSTODIAL_WALLET_ADDRESS as string],
      `email-${i}`
    ) 
  }
}

// const goerliChainId = 5;
const rinkebyChainId = 4;
// const contractAddress = addresses[goerliChainId].TestNFT;
const contractAddress = addresses[rinkebyChainId].TestNFT;
// Wallet worker private keys
const privateKeys = [
  process.env.PRIVATE_KEY_1,
  process.env.PRIVATE_KEY_2,
  process.env.PRIVATE_KEY_3,
]

const provider = new ethers.providers.JsonRpcProvider(process.env.RINKEBY_URL);

const walletWorker = new WalletWorker(privateKeys as string[], provider);
const NUM_TRANSACTIONS = 20;
const start = Date.now();

main(walletWorker, NUM_TRANSACTIONS, provider)
  .catch(err => console.log(err))