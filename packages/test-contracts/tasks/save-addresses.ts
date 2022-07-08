import { task } from "hardhat/config";
import fs from "fs";
import path from "path";

task(
  "save-addresses",
  "Save deployed contract addresses",
  async ({ contracts, chainId }: { contracts: Record<string, string>, chainId: number }) => {
    const addressesFilePath = path.join(__dirname, "../config/addresses.json");
    const addressesStr = fs.readFileSync(addressesFilePath).toString();
    const addresses: Record<number, any> = JSON.parse(addressesStr);

    for (const [name, address] of Object.entries(contracts)) {
      if (!addresses[chainId]) {
        addresses[chainId] = { [name]: {} };
      }
      addresses[chainId][name] = address;
    }

    fs.writeFileSync(
      addressesFilePath,
      JSON.stringify(addresses, undefined, 2)
    );
  }
);
