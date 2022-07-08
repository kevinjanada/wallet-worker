import addresses from "@wallet-worker/test-contracts/config/addresses.json";
import TestNFT from "@wallet-worker/test-contracts/artifacts/contracts/TestNFT.sol/TestNFT.json";
import { ethers } from "ethers";
import AsyncLock from "async-lock";

// eslint-disable-next-line @typescript-eslint/no-var-requires
require("dotenv").config();

type PublicKey = `0x${string}`;

class WalletWorker {
  private _provider: ethers.providers.Provider;
  private _wallets: Record<PublicKey, ethers.Wallet> = {};
  private _nonces: Record<PublicKey, number> = {};
  private _lock: AsyncLock;
  // Use wallet public keys as lock keys
  private _walletPubKeys: PublicKey[] = [];

  public initialized: Promise<boolean>;

  private _nextLockKeyIndex = 0;

  constructor(privateKeys: string[], provider: ethers.providers.Provider) {
    this._provider = provider;

    // initialize wallets
    this._wallets = {};
    for (const privKey of privateKeys) {
      const wallet = new ethers.Wallet(privKey, provider);
      this._wallets[wallet.publicKey as PublicKey] = wallet;
    }
    // initialize public Keys used as key to locks
    for (const [pubKey] of Object.entries(this._wallets)) {
      this._walletPubKeys.push(pubKey as PublicKey);
    }
    // Initialize lock
    this._lock = new AsyncLock();

    this.initialized = new Promise(async resolve => {
      const promises = this._walletPubKeys.map((pubKey: PublicKey) => {
        return new Promise(async resolve => {
          this._nonces[pubKey] = await this._wallets[pubKey].getTransactionCount();
          resolve(true)
        })
      })
      await Promise.all(promises);
      resolve(true);
    })
  }

  get walletPubKeys() {
    return this._walletPubKeys;
  }

  get wallets() {
    return this._wallets;
  }

  async executeTransaction(contract: ethers.Contract, method: string, params: (string | number)[]) {
    const lockIndex = this._nextLockKeyIndex;
    const lockKey = this._walletPubKeys[lockIndex];
    
    this._lock.acquire(lockKey, async () => {
      const wallet = this.wallets[lockKey];
      // Get current nonce
      const _nonce = await wallet.getTransactionCount();
      this._nonces[lockKey] = this._nonces[lockKey] > _nonce ? this._nonces[lockKey] : _nonce;
      console.log('transaction on this.nonce', this._nonces[lockKey]);

      // Create transaction
      const contractWithSigner = contract.connect(wallet);
      const sentTx = await contractWithSigner[method](...params, { nonce: this._nonces[lockKey] });
      console.log('sentTx.hash', sentTx.hash);

      // Increment nonce
      this._nonces[lockKey] += 1;

      this._provider.waitForTransaction(sentTx.hash).then(_tx => {
        console.log('mined tx', _tx.transactionHash);
      })
    })
    .then(() => console.log('lock released'))
    .catch(err => console.log(err))

    // Round robin 
    this._nextLockKeyIndex = (this._nextLockKeyIndex + 1) < this._walletPubKeys.length ? (this._nextLockKeyIndex + 1) : 0;
  }
}

async function main(walletWorker: WalletWorker, numTransactions: number) {
  const nftContract = new ethers.Contract(contractAddress, TestNFT.abi, provider);
  await walletWorker.initialized;
  for (let i = 0; i < numTransactions; i++) {
    walletWorker.executeTransaction(nftContract, "mintTo", [process.env.CUSTODIAL_WALLET_ADDRESS as string]) 
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
const NUM_TRANSACTIONS = 200;
const start = Date.now();

main(walletWorker, NUM_TRANSACTIONS).then(() => {
  const end = Date.now();
  const _secondsPassed = (end - start) / 1000

  const benchMark = {
    'Wallets Used': walletWorker.walletPubKeys.length,
    'Number of triggers': NUM_TRANSACTIONS,
    'Time': _secondsPassed,
  }

  console.table(benchMark);
});