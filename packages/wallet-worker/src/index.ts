import { ethers } from "ethers";
import AsyncLock from "async-lock";
import { EventEmitter } from "stream";

// eslint-disable-next-line @typescript-eslint/no-var-requires
require("dotenv").config();

type PublicKey = `0x${string}`;

interface Transaction {
  method: string;
  params: (string | number)[];
  returnData: unknown;
}

class WalletWorker extends EventEmitter {
  private _provider: ethers.providers.Provider;
  private _wallets: Record<PublicKey, ethers.Wallet> = {};
  private _nonces: Record<PublicKey, number> = {};
  private _lock: AsyncLock;
  // Use wallet public keys as lock keys
  private _walletPubKeys: PublicKey[] = [];

  private _nextLockKeyIndex = 0;

  private _transactionQueue: Record<PublicKey, Transaction[]> = {};
  // private _transactionQueue: Transaction[] = [];

  constructor(privateKeys: string[], provider: ethers.providers.Provider) {
    super();

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
    // Initialize failed Transactions map 
    for (const [pubKey] of Object.entries(this._wallets)) {
      this._transactionQueue[pubKey as PublicKey] = [];
    }

    // Initialize lock
    this._lock = new AsyncLock();
  }

  get walletPubKeys() {
    return this._walletPubKeys;
  }

  get wallets() {
    return this._wallets;
  }

  get failedTransactions() {
    return this._transactionQueue;
  }

  async executeTransaction(contract: ethers.Contract, method: string, params: (string | number)[], returnData: unknown) {
    const lockIndex = this._nextLockKeyIndex;
    const pubKey = this._walletPubKeys[lockIndex];
    // Round robin 
    this._nextLockKeyIndex = (this._nextLockKeyIndex + 1) < this._walletPubKeys.length ? (this._nextLockKeyIndex + 1) : 0;

    return this._lock.acquire(pubKey, async () => {
      const wallet = this.wallets[pubKey];
      // Add new transaction to the queue
      this._transactionQueue[pubKey].push({ method, params, returnData });
      // Handle Transactions in the queue FIFO
      while (this._transactionQueue[pubKey].length > 0) {
        const { method, params, returnData } = this._transactionQueue[pubKey].shift() as Transaction;
        // Get current nonce
        let nonce = await this._provider.getTransactionCount(wallet.address);
        this._nonces[pubKey] = this._nonces[pubKey] > nonce ? this._nonces[pubKey] : nonce;
        nonce = this._nonces[pubKey];
        // console.log('transaction on this.nonce', nonce);
  
        // Create transaction
        const contractWithSigner = contract.connect(wallet);
        // const gasPrice = await this._provider.getGasPrice();
        // const gasEstimate = await contractWithSigner.estimateGas[method](...params)
        // const gasPrice = ethers.BigNumber.from('40000000000'); // TODO: set gas price from matic gas station
        contractWithSigner[method](...params, {
            nonce,
            // gasPrice,
          }
        )
        .then((sentTx: ethers.providers.TransactionResponse) => {
          this._provider.waitForTransaction(sentTx.hash)
            .then(async (minedTx: ethers.providers.TransactionReceipt) => {
              this.emit('success', {
                tx: minedTx,
                returnData
              })
              await new Promise(resolve => setTimeout(resolve, 200)) // Backoff
            })
            // Wait for transaction error
            .catch(async (error: any) => {
              await new Promise(resolve => setTimeout(resolve, 1000))
              // Add failed transaction to the back of the queue
              this._transactionQueue[pubKey].push({ method, params, returnData })
              this.emit('error', {
                error,
                data: returnData,
              })
            });
        })
        // contract method error
        .catch(async (error: any) => {
          await new Promise(resolve => setTimeout(resolve, 1000))
          // Add failed transaction to the back of the queue
          this._transactionQueue[pubKey].push({ method, params, returnData })
          this.emit('error', {
            error,
            data: returnData,
          })
        });
        this._nonces[pubKey] += 1;
      }
    })
    .then(() => {
      // console.log('lock released')
    })
    .catch(err => console.log(err));
  }
}

export default WalletWorker;