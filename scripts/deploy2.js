// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers, upgrades } = require("hardhat");
const toBN = ethers.BigNumber.from;

async function main() {
  const [deployer, addr1, addr2, addr3, paperKeyAddress, allowancesigner] = await ethers.getSigners();

  const mybase = "ipfs://bafybeiedvedvubk35kgin7kseqv7erskgtotfo67ihgexumws7e3dmmcaa/";

  const bBefore = ethers.BigNumber.from((await deployer.getBalance()).toString()); 
  console.log("Deploying with: %s, balance: %f", deployer.address, ethers.utils.formatUnits( (bBefore) , unit = "ether"));

  let BNFT = await ethers.getContractFactory("BlankToken");
  const bnft = await BNFT.deploy(mybase);
  await bnft.deployed();

  let bAfter = ethers.BigNumber.from((await deployer.getBalance()).toString());  
  let deployCost = (bBefore.sub(bAfter));

  console.log("NFT Contract deployed to: ", bnft.address);

  console.log("Deploy cost:", ethers.utils.formatUnits( (deployCost) , unit = "ether" ), "eth\n====================\n");

    let setAlltx = await bnft.connect(deployer).setAllowancesSigner("0x447ecF100A442A9F759507296631D89495c546Be");
    await setAlltx.wait();
    console.log("Allowances signer set");

    let tx = await bnft.connect(deployer).switchSaleState();
    await tx.wait();
    console.log("Sale state switched");

    tx = await bnft.connect(deployer).switchMergeState();
    await tx.wait();
    console.log("Merge state switched");
    
    let mintQty = 20;
    tx = await bnft.connect(deployer).adminMint(deployer.address, mintQty);
    await tx.wait();
    console.log("NFTs are minted");

    console.log("Total Supply: ", (await bnft.totalSupply()).toString());

    /*
    await hre.run("verify:verify", {
      address: bnft.address,
      constructorArguments: [
        mybase,
      ],
    });
    */
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });