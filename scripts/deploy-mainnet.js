// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers, upgrades } = require("hardhat");
const toBN = ethers.BigNumber.from;

async function main() {
  const [deployer, addr1, addr2, addr3, paperKeyAddress, allowancesigner] = await ethers.getSigners();

  const mybase = "https://idkyet.com/json/";

  const bBefore = ethers.BigNumber.from((await deployer.getBalance()).toString()); 

  let BNFT = await ethers.getContractFactory("BlankToken");
  const bnft = await BNFT.deploy(mybase);
  await bnft.deployed();

  let bAfter = ethers.BigNumber.from((await deployer.getBalance()).toString());  
  let deployCost = (bBefore.sub(bAfter));

  console.log("NFT Contract deployed to: ", bnft.address);

  console.log("Deploy cost:", ethers.utils.formatUnits( (deployCost) , unit = "ether" ), "eth\n====================\n");

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });