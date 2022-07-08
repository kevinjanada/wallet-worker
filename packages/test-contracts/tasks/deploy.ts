import { task } from "hardhat/config";
import { TestNFT, TestNFT__factory } from "../typechain";

task("deploy", "Deploys NFT Smart contract")
  .addParam("proxyRegistryAddress", "Wyvern Proxy registry address", "0x0000000000000000000000000000000000000000")
  .setAction(
    async ({ proxyRegistryAddress }, { ethers, run }) => {
      await run("compile");

      // const network = await ethers.provider.getNetwork();
      const [deployer] = await ethers.getSigners();

      const nonce = await deployer.getTransactionCount();

      const minters = [
        process.env.MINTER_ADDRESS_1,
        process.env.MINTER_ADDRESS_2,
        process.env.MINTER_ADDRESS_3,
      ] as string[];

      const NFT: TestNFT__factory = await ethers.getContractFactory("TestNFT");
      const nft: TestNFT = await NFT.deploy(
        proxyRegistryAddress,
        minters,
        { nonce: nonce }
      );

      await nft.deployed();

      const contracts = { TestNFT: nft.address };
      const network = await ethers.provider.getNetwork();
      const { chainId } = network;

      await run("save-addresses", { contracts, chainId })

      console.log("NFT Deployed to :", nft.address);

      return nft.address;
    }
);
