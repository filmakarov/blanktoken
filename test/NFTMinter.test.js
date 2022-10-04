// Load dependencies
const { expect } = require('chai');

// Import utilities from Test Helpers
const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { deployments, getNamedAccounts, ethers } = require('hardhat');
const ConsoleProgressBar = require('console-progress-bar');

const toBN = ethers.BigNumber.from;

describe('Minting tests', () => {
  let deployer;
  let random;
  let random2;
  let unlocker;
  let holder;
  let holder2;
  let holder3;
  let spender;
  let allowancesigner;
  let operator;
  const ADDRESS_ZERO = ethers.constants.AddressZero;
  const mybase = "https://blankstudio.art/json/";

  const provider = ethers.provider;
  const { hexlify, toUtf8Bytes } = ethers.utils;

async function signAllowance(account, mintQty, allowanceId, signerAccount = allowancesigner) {
  const idBN = toBN(allowanceId).shl(128);
  const nonce = idBN.add(mintQty);
  const message = await nftContract.createMessage(account, nonce);

  //const formattedMessage = hexlify(toUtf8Bytes(message));
  const formattedMessage = hexlify(message);
  const addr = signerAccount.address.toLowerCase();

  /*
  const signature = await signerAccount.signMessage(
      ethers.utils.arrayify(message),
  );
  */

  const signature = await provider.send('eth_sign', [addr, formattedMessage]);

  return { nonce, signature };
}

  beforeEach(async () => {
      [deployer, random, random2, unlocker, holder, holder2, holder3, spender, allowancesigner, operator] = await ethers.getSigners();

      // get chainId
      chainId = await ethers.provider.getNetwork().then((n) => n.chainId);

      const BLT = await ethers.getContractFactory('BlankToken', deployer);
      nftContract = await BLT.deploy(mybase);

      await nftContract.connect(deployer).switchSaleState();
      await nftContract.connect(deployer).setAllowancesSigner(await allowancesigner.getAddress());
  });

  describe('Deployment', async function () {
    
    it('deploys', async function () {
        expect(nftContract.address).to.not.equal("");
    });

    it('deploys with correct base URI', async function () {
      
      const mintQty = 1;
      const { nonce: nonce, signature: allowance } = await signAllowance(
          await random.getAddress(),
          mintQty,
          Math.floor(Math.random() * 1000 * (await provider.getBlockNumber())) //some random allowance id
      );

      await nftContract.connect(random).mint(await random.getAddress(), nonce, allowance);

      console.log(await nftContract.tokenURI((await nftContract.nextTokenIndex()).sub(1)));

      expect(await nftContract.tokenURI((await nftContract.nextTokenIndex()).sub(1))).to.include(mybase);
    });

    it('deploys with 0 tokens', async function () {
      expect(await nftContract.totalSupply()).to.equal(0);
    });
  });

  /*  ====== ====== ====== ====== ====== ======
    *   
    *   PRESALE MINTING TESTS
    * 
    * ====== ====== ====== ====== ======  ====== */

  describe('Presale minting', async function () {
    it('can mint token with a signature', async function () {

      const mintQty = 1;
      const { nonce: nonce, signature: allowance } = await signAllowance(
          await random.getAddress(),
          mintQty,
          Math.floor(Math.random() * 1000 * (await provider.getBlockNumber())) //some random allowance id
      );
        
      await nftContract.connect(random).mint(await random.getAddress(), nonce, allowance);

      expect(
          await nftContract.balanceOf(await random.getAddress()),
      ).to.be.equal(mintQty);
  });
  
  it('can mint token with an allowance made for other person that was not used yet to other person wallet', async function () {

      const mintQty = 1;
      const { nonce: nonce, signature: allowance } = await signAllowance(
          await random.getAddress(),
          mintQty,
          Math.floor(Math.random() * 1000 * (await provider.getBlockNumber())) //some random allowance id
      );
        
      await nftContract.connect(random2).mint(await random.getAddress(), nonce, allowance);

      expect(
          await nftContract.balanceOf(await random.getAddress()),
      ).to.be.equal(mintQty);
  });
  
   
  it('can mint several quotas with same capacity but diff nonce', async function () {

    const mintQty = 1;
    const quotas = 3;

    for (let i=0; i<quotas; i++) {
      const { nonce: nonce, signature: allowance } = await signAllowance(
          await random.getAddress(),
          mintQty,
          Math.floor(Math.random() * 1000) //some random allowance id
      );

      await nftContract.connect(random).mint(await random.getAddress(), nonce, allowance);

    }
    expect(
        await nftContract.balanceOf(await random.getAddress()),
    ).to.be.equal(mintQty*quotas);
  });


  it('cannot reuse signature', async function () {

    const mintQty = 1;
    const allowId = Math.floor(Math.random() * 1000 * (await provider.getBlockNumber()));
    const { nonce: nonce, signature: allowance } = await signAllowance(
          await random.getAddress(),
          mintQty,
          allowId //some random allowance id
    );
    await nftContract.connect(random).mint(await random.getAddress(), nonce, allowance);
    //console.log("cannot reuse sig: 1st mint ok");

    await expect(
      nftContract.connect(random).mint(await random.getAddress(), nonce, allowance),
    ).to.be.revertedWith('!ALREADY_USED!');
  });

  it('cannot mint to yourself with other persons allowance', async function () {

    const mintQty = 1;
    const allowId = Math.floor(Math.random() * 1000 * (await provider.getBlockNumber()));
      const { nonce: nonce, signature: allowance } = await signAllowance(
          await random.getAddress(),
          mintQty,
          allowId //some random allowance id
      );

    await expect(
      nftContract.connect(random2).mint(await random2.getAddress(), nonce, allowance),
    ).to.be.revertedWith('!INVALID_SIGNATURE!');
  });

  it('cannot mint with signature by wrong signer', async function () {

    const mintQty = 1;
      const { nonce: nonce, signature: allowance } = await signAllowance(
          await random.getAddress(),
          mintQty,
          Math.floor(Math.random() * 1000), 
          random2
      );

    await expect(
      nftContract.connect(random).mint(await random.getAddress(), nonce, allowance),
    ).to.be.revertedWith('!INVALID_SIGNATURE!');
  });

  it('cannot mint with previously valid signature when we revoked everyhting by changing signer in the contract', async function () {
    
    const mintQty = 1;
      const { nonce: nonce, signature: allowance } = await signAllowance(
          await random.getAddress(),
          mintQty,
          Math.floor(Math.random() * 1000), 
      );
      
      await nftContract.connect(deployer).setAllowancesSigner(random.address);
    await expect(
      nftContract.connect(random).mint(await random.getAddress(), nonce, allowance),
    ).to.be.revertedWith('!INVALID_SIGNATURE!');
  });

  it('non owner can not change signer', async function () {
    await expect(
      nftContract.connect(random).setAllowancesSigner(random.address),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('cannot mint with increased nonce', async function () {

    const mintQty = 1;
      const { nonce: nonce, signature: allowance } = await signAllowance(
          await random.getAddress(),
          mintQty,
          Math.floor(Math.random() * 1000), 
      );

      const nonce2 = nonce.add(2);

    await expect(
      nftContract.connect(random).mint(await random.getAddress(), nonce2, allowance),
    ).to.be.revertedWith('!INVALID_SIGNATURE!');
  });

  it('cannot manipulate signature', async function () {

    const mintQty = 1;
      let { nonce: nonce, signature: allowance } = await signAllowance(
          await random.getAddress(),
          mintQty,
          345, //some random id
      );

      allowance =
            '0x45eacf01' + allowance.substr(-(allowance.length - 10));

    await expect(
      nftContract.connect(random).mint(await random.getAddress(), nonce, allowance),
    ).to.be.reverted;
  }); 

  it('can not order before presale started', async function () {
    let tx = await nftContract.connect(deployer).switchSaleState();
    await tx.wait();

    expect((await nftContract.saleState())).to.be.false;

    const mintQty = 1;
      const { nonce: nonce, signature: allowance } = await signAllowance(
          await random.getAddress(),
          mintQty,
          Math.floor(Math.random() * 1000 * (await provider.getBlockNumber())) //some random allowance id
      );

    await expect (
      nftContract.connect(random).mint(await random.getAddress(), nonce, allowance),
    ).to.be.revertedWith('Presale not active');          
  });

  /*

  it('can not order Over Capacity', async function () {
  
    const mintQty = 1;

    const capacity = 1000;

    const consoleProgressBar = new ConsoleProgressBar({ maxValue: capacity });

    // claim all tokens
    for (let i=0; i<capacity; i++) {
      
      const { nonce: nonce, signature: allowance } = await signAllowance(
          await random.getAddress(),
          mintQty,
          Math.floor(Math.random() * 10000 * (await provider.getBlockNumber())) //some random allowance id
      );

      await nftContract.connect(random).mint(await random.getAddress(), nonce, allowance);
      consoleProgressBar.addValue(1);
    }

    // all tokens are claimed
    expect(await nftContract.totalSupply()).to.equal(capacity);

    // exceeded mint
    const { nonce: nonce, signature: allowance } = await signAllowance(
      await random.getAddress(),
      mintQty,
      Math.floor(Math.random() * 1000 * (await provider.getBlockNumber())) //some random allowance id
    );

    await expect (

      nftContract.connect(random).mint(await random.getAddress(), nonce, allowance),

    ).to.be.revertedWith('>MaxSupply');          
  });

  */

});

/*  ====== ====== ====== ====== ====== ======
    *   
    *   VIEW FUNCTIONS TESTS
    * 
    * ====== ====== ====== ====== ======  ====== */

describe('View functions tests', async function () {

  it('can return correct tokens of Owner without burning', async function () {

    const mintQty = 1;

    expect(await nftContract.totalSupply()).to.equal(0);
    expect(await nftContract.balanceOf(await random.getAddress())).to.equal(0);

    let totMintedBeforeTest = await nftContract.totalSupply();

    await nftContract.connect(deployer).adminMint(await random.getAddress(), mintQty);
    await nftContract.connect(deployer).adminMint(await random2.getAddress(), mintQty);
    await nftContract.connect(deployer).adminMint(await random.getAddress(), mintQty);
    await nftContract.connect(deployer).adminMint(await deployer.getAddress(), mintQty);
    await nftContract.connect(deployer).adminMint(await holder.getAddress(), mintQty);
    await nftContract.connect(deployer).adminMint(await random.getAddress(), mintQty);
    
    let minted = (await nftContract.totalSupply());
    
    //the starting index of the collection
    let startIndex = (await nftContract.nextTokenIndex()).sub(minted);

    let expToO = [toBN((startIndex.add(totMintedBeforeTest)).add(0)), 
                  toBN((startIndex.add(totMintedBeforeTest)).add(2)), 
                  toBN((startIndex.add(totMintedBeforeTest)).add(5))];
    
    let gotToO = await nftContract.tokensOfOwner(await random.getAddress());
    
    for (let i=0; i<expToO.length; i++) {
      //console.log("got from contract: " , gotToO[i]);
      expect(gotToO[i]).to.equal(expToO[i]);
    }

  }); 

});


/*  ====== ====== ====== ====== ====== ======
    *   
    *   ADMIN FUNCTIONS TESTS
    * 
    * ====== ====== ====== ====== ======  ====== */

describe('Admin functions tests', async function () {

  it('can change baseUri', async function () {

    let oldBaseUri = await nftContract.baseURI();
    
    let newBaseExp = "site.com";
    let tx = await nftContract.connect(deployer).setBaseURI(newBaseExp);
    await tx.wait();

    let newBaseSet = await nftContract.baseURI();
    
    expect(newBaseSet).to.equal(newBaseExp).and.to.not.equal(oldBaseUri);
  }); 

  it('can not set BaseURI if not admin: test onlyOwner function', async function () {
    await expect(
        nftContract.connect(random).setBaseURI("fddfsf"),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('can AdminMint', async function () {
    const mintQty = 1;
    expect(await nftContract.totalSupply()).to.equal(0);
    await nftContract.connect(deployer).adminMint(await random.getAddress(), mintQty);
    expect(await nftContract.totalSupply()).to.equal(mintQty);
    expect(await nftContract.balanceOf(await random.getAddress())).to.equal(mintQty);
  });

  it('can not adminMint if not admin: test onlyOwner function', async function () {
    const mintQty = 1;
    await expect(
        nftContract.connect(random).adminMint(await random.getAddress(), mintQty),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  // Reveal test

  // CHANGE REVEAL TO MERGE

  it('can switch merge state', async function () {

    expect(await nftContract.mergingActive()).to.be.false;

    await nftContract.connect(deployer).switchMergeState();

    expect(await nftContract.mergingActive()).to.be.true;
    
  }); 

  it('can not switch merge if not admin: test onlyOwner function', async function () {
    const mintQty = 1;
    await expect(
        nftContract.connect(random).switchMergeState(),
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

});


/*  ====== ====== ====== ====== ====== ======
    *   
    *   MERGING TESTS
    * 
    * ====== ====== ====== ====== ======  ====== */

describe('Merging tests', async function () {

  beforeEach(async () => {  
    let randomAmount = (Math.floor(Math.random() * 10)) + 1;    
    let txPrelMint = await nftContract.connect(deployer).adminMint(await random.getAddress(), randomAmount);
    await txPrelMint.wait();

    randomAmount = (Math.floor(Math.random() * 10)) + 1;    
    txPrelMint = await nftContract.connect(deployer).adminMint(await random2.getAddress(), randomAmount);
    await txPrelMint.wait();

    randomAmount = (Math.floor(Math.random() * 10)) + 5;    
    txPrelMint = await nftContract.connect(deployer).adminMint(await holder.getAddress(), randomAmount);
    await txPrelMint.wait();
    
    randomAmount = (Math.floor(Math.random() * 10)) + 1;    
    txPrelMint = await nftContract.connect(deployer).adminMint(await holder2.getAddress(), randomAmount);
    await txPrelMint.wait();

    randomAmount = (Math.floor(Math.random() * 10)) + 1;    
    txPrelMint = await nftContract.connect(deployer).adminMint(await holder3.getAddress(), randomAmount);
    await txPrelMint.wait();
    
    //console.log("Total Supply before burn",(await nftContract.totalSupply()).toString());
  });

  it('can burn 2 tokens and get 1, with the next id', async function () {

    let lastTokenBefore = await nftContract.nextTokenIndex() - 1;
    //console.log("Last minted token id %i", lastTokenBefore);

    let tokensOfOwner = await nftContract.tokensOfOwner(await holder.getAddress());
    let tokenId1 = tokensOfOwner[0];
    let tokenId2 = tokensOfOwner[tokensOfOwner.length - 2];
    //console.log("Balance of holder: %i", await nftContract.balanceOf(await holder.getAddress())); 
    //console.log("Token1 id %i | token2 id %i", tokenId1, tokenId2); 

    await nftContract.connect(deployer).switchMergeState();

    let txMerge = await nftContract.connect(holder).mergeTokens(tokenId1, tokenId2);
    await txMerge.wait();

    //console.log("Total Supply after burn",(await nftContract.totalSupply()).toString());
    //console.log("Last minted token id %i", await nftContract.nextTokenIndex()-1);

    let lastTokenAfter = await nftContract.nextTokenIndex() - 1;
    //console.log("Last minted token id after burning %i", lastTokenAfter);

    expect(lastTokenAfter).to.equal(lastTokenBefore+1);
    
    await expect(
      nftContract.ownerOf(tokenId1) ).to.be.revertedWith('Blank Token: Not minted or burned');

    await expect(
        nftContract.ownerOf(tokenId2) ).to.be.revertedWith('Blank Token: Not minted or burned');

  }); 

  it('can not merge before merge active', async function () {

    let tokensOfOwner = await nftContract.tokensOfOwner(await holder.getAddress());
    let tokenId1 = tokensOfOwner[0];
    let tokenId2 = tokensOfOwner[tokensOfOwner.length - 2];
    //console.log("Token1 id %i | token2 id %i", tokenId1, tokenId2); 

    await expect(
      nftContract.connect(holder).mergeTokens(tokenId1, tokenId2) ).to.be.revertedWith('Blank Token: Merging has not started yet');

  });

  it('can not merge other persons token', async function () {

    let tokensOfOwner = await nftContract.tokensOfOwner(await holder.getAddress());
    let tokenId1 = tokensOfOwner[0];
    let tokenId2 = tokensOfOwner[tokensOfOwner.length - 2];
    //console.log("Token1 id %i | token2 id %i", tokenId1, tokenId2); 

    await nftContract.connect(deployer).switchMergeState();

    await expect(
      nftContract.connect(random).mergeTokens(tokenId1, tokenId2) ).to.be.revertedWith('Blank Token: must own tokens to merge');

  });

});

/*  ====== ====== ====== ====== ====== ======
    *   
    *   VIEW FUNCTIONS TESTS AFTER MERGING
    * 
    * ====== ====== ====== ====== ======  ====== */

describe('View functions tests after merging', async function () {

  beforeEach(async () => {  
    let randomAmount = (Math.floor(Math.random() * 10)) + 2;    
    let txPrelMint = await nftContract.connect(deployer).adminMint(await random.getAddress(), randomAmount);
    await txPrelMint.wait();

    randomAmount = (Math.floor(Math.random() * 10)) + 3;    
    txPrelMint = await nftContract.connect(deployer).adminMint(await random2.getAddress(), randomAmount);
    await txPrelMint.wait();
    
    randomAmount = (Math.floor(Math.random() * 10)) + 1;    
    txPrelMint = await nftContract.connect(deployer).adminMint(await holder2.getAddress(), randomAmount);
    await txPrelMint.wait();

    randomAmount = (Math.floor(Math.random() * 10)) + 5;    
    txPrelMint = await nftContract.connect(deployer).adminMint(await holder.getAddress(), randomAmount);
    await txPrelMint.wait();

    randomAmount = (Math.floor(Math.random() * 10)) + 1;    
    txPrelMint = await nftContract.connect(deployer).adminMint(await holder3.getAddress(), randomAmount);
    await txPrelMint.wait();
    
    //console.log("Total Supply before burn",(await nftContract.totalSupply()).toString());
  });

  it('can return correct tokens of Owner after burning', async function () {

    let tokensOfOwnerBefore = await nftContract.tokensOfOwner(await holder.getAddress());

    // MERGE TOKENS //

    let tokenId1 = tokensOfOwnerBefore[0];
    let tokenId2 = tokensOfOwnerBefore[tokensOfOwnerBefore.length - 2];
    //console.log("Balance of holder: %i", await nftContract.balanceOf(await holder.getAddress())); 
    //console.log("Token1 id %i | token2 id %i", tokenId1, tokenId2); 

    await nftContract.connect(deployer).switchMergeState();

    let txMerge = await nftContract.connect(holder).mergeTokens(tokenId1, tokenId2);
    await txMerge.wait();

    //console.log("Last minted token id is %i", await nftContract.nextTokenIndex() - 1);

    // MERGE TOKENS END //
    
    let minted = (await nftContract.totalSupply());  //how many tokens was minted

    let tokensOfOwnerExpected = [];
    for (let i = 0; i< tokensOfOwnerBefore.length; i++) {
      tokensOfOwnerExpected.push(tokensOfOwnerBefore[i]);
    }

    let indexOfMerged = tokensOfOwnerExpected.indexOf(tokenId1);
    //console.log("index of merged 1", indexOfMerged);
    if (indexOfMerged > -1) { // only splice array when item is found
      tokensOfOwnerExpected.splice(indexOfMerged, 1); // 2nd parameter means remove one item only
    }
    // same for the second one
    indexOfMerged = tokensOfOwnerExpected.indexOf(tokenId2);
    if (indexOfMerged > -1) { 
      tokensOfOwnerExpected.splice(indexOfMerged, 1); 
    } 

    //add the # of the newly minted token
    tokensOfOwnerExpected.push((await nftContract.nextTokenIndex()).sub(1));

    let tokensOfOwnerAfter = await nftContract.tokensOfOwner(await holder.getAddress());
    
    for (let i=0; i<tokensOfOwnerAfter.length; i++) {
      //console.log("expected: %i; got from contract: %i" , tokensOfOwnerExpected[i], tokensOfOwnerAfter[i]);
      expect(tokensOfOwnerAfter[i]).to.equal(tokensOfOwnerExpected[i]);
    }

  }); 

  it('ownerOf should revert for burned', async function () {

    let tokensOfOwnerBefore = await nftContract.tokensOfOwner(await holder.getAddress());

    // MERGE TOKENS //

    let tokenId1 = tokensOfOwnerBefore[0];
    let tokenId2 = tokensOfOwnerBefore[tokensOfOwnerBefore.length - 2];
    
    await nftContract.connect(deployer).switchMergeState();

    let txMerge = await nftContract.connect(holder).mergeTokens(tokenId1, tokenId2);
    await txMerge.wait();

    // MERGE TOKENS END //

    await expect(
      nftContract.ownerOf(tokenId1)).to.be.revertedWith('Blank Token: Not minted or burned');
    await expect(
        nftContract.ownerOf(tokenId2)).to.be.revertedWith('Blank Token: Not minted or burned');

  }); 

});



});