# Wallet Worker
Use wallet worker to execute multiple ethereum transactions using multiple wallets.  
The wallet worker will manage the nonce internally as it sends transactions to the RPC endpoint.  

## TODO:
- [ ] Implement number of retries config
- [ ] Create error handler. to replace transaction with higher gas
- [ ] Add backoff time parameter

## Quick Start
```typescript
const privateKeys = [
  process.env.PRIVATE_KEY_1,
  process.env.PRIVATE_KEY_2,
  process.env.PRIVATE_KEY_3,
]
const provider = new ethers.providers.JsonRpcProvider(process.env.RINKEBY_URL);
const nftContract = new ethers.Contract(contractAddress, TestNFT.abi, provider);

// Create walletWorker instance
const walletWorker = new WalletWorker(privateKeys as string[], provider);
// Handle transaction success event
walletWorker.on('success', function(data: any) {
  const { returnData, tx } = data;
  console.log(returnData) // any data you pass in to executeTransaction function. see below
  console.log(tx) // The tx object retrieved from mined transaction
})
// Handle transaction error event.
// By default the transaction will be retried indefinitely until successful
// Number of retries not yet implemented
walletWorker.on('error', function(error: any) {
  console.log('error', error);
})
// Execute transaction in a loop without waiting for the transaction to be mined
for (let i = 0; i < numTransactions; i++) {
  walletWorker.executeTransaction(
    nftContract,
    "mintTo",
    [process.env.CUSTODIAL_WALLET_ADDRESS as string],
    { myData: 'Anything' }
  ) 
}
```