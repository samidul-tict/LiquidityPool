import { expect } from "chai";
import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SpaceCoinICO, SpaceCoinICO__factory } from "../typechain";
import { LiquidityPool, LiquidityPool__factory } from "../typechain";
import { SpaceRouter, SpaceRouter__factory } from "../typechain/";

describe("Liquidity Pool", function () {
  let spaceCoinICO: SpaceCoinICO;
  let spaceCoinICOFactory: SpaceCoinICO__factory;
  let spaceRouter: SpaceRouter;
  let spaceRouterFactory: SpaceRouter__factory;
  let liquidityPool: LiquidityPool;
  let liquidityPoolFactory: LiquidityPool__factory;
  let liquidity: BigNumber;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;
  let dan: SignerWithAddress;
  let whitelist: string[];

  this.beforeEach(async function() {
    [owner, treasury, alice, bob, charlie, dan] = await ethers.getSigners();
    
    whitelist = [owner.address, treasury.address, alice.address, bob.address, charlie.address, dan.address];

    spaceCoinICOFactory = await ethers.getContractFactory("SpaceCoinICO");
    spaceCoinICO = (await spaceCoinICOFactory.connect(owner).deploy(treasury.address, whitelist)) as SpaceCoinICO;
    await spaceCoinICO.deployed();
    console.log("ICO contract address: ", spaceCoinICO.address);

    liquidityPoolFactory = await ethers.getContractFactory("LiquidityPool");
    liquidityPool = (await liquidityPoolFactory.connect(owner).deploy(spaceCoinICO.address)) as LiquidityPool;
    await liquidityPool.deployed();
    console.log("Liquidity Pool contract address: ", liquidityPool.address);
  });

  describe("mint", function () {
    this.beforeEach(async function() {
        // move to GENERAL phase
        await spaceCoinICO.connect(owner).changeICOStage(1);

        // move to OPEN phase
        await spaceCoinICO.connect(owner).changeICOStage(2);
        await spaceCoinICO.connect(alice).investInSPC({value: ethers.utils.parseEther("1500")});
        await spaceCoinICO.connect(bob).investInSPC({value: ethers.utils.parseEther("1000")});
    });
    it("mint before deposit", async function() {
        await expect(liquidityPool.connect(owner).mint(alice.address)).to.be.revertedWith("NO_LIQUIDITY");
    });
    it("mint after deposit only ETH", async function() {
        const tx = {
            to: liquidityPool.address,
            value: ethers.utils.parseEther("100"),
            gasLimit: 500000
        }
        alice.sendTransaction(tx);
        await expect(liquidityPool.connect(owner).mint(alice.address))
        .to.be.revertedWith("NO_LIQUIDITY");
    });
    it("mint after deposit only SPC", async function() {
        await spaceCoinICO.connect(alice).transfer(liquidityPool.address, ethers.utils.parseEther("500"));
        await expect(liquidityPool.connect(owner).mint(alice.address)).to.be.revertedWith("NO_LIQUIDITY");
    });
    it("mint after deposit", async function() {
        await spaceCoinICO.connect(alice).transfer(liquidityPool.address, ethers.utils.parseEther("500"));
        await spaceCoinICO.connect(owner).withdrawFund(treasury.address);

        const tx = {
            to: liquidityPool.address,
            value: ethers.utils.parseEther("100"),
            gasLimit: 500000
        }
        alice.sendTransaction(tx);
        expect(await liquidityPool.connect(owner).mint(alice.address))
        .to.emit(liquidityPool, "Mint").withArgs(owner.address, alice.address, "223606797749978968640");
    });
  });

  describe("burn", function () {
    this.beforeEach(async function() {
        // move to GENERAL phase
        await spaceCoinICO.connect(owner).changeICOStage(1);

        // move to OPEN phase
        await spaceCoinICO.connect(owner).changeICOStage(2);
        await spaceCoinICO.connect(alice).investInSPC({value: ethers.utils.parseEther("1500")});
        await spaceCoinICO.connect(alice).transfer(liquidityPool.address, ethers.utils.parseEther("500"));
        await spaceCoinICO.connect(owner).withdrawFund(treasury.address);

        const tx = {
            to: liquidityPool.address,
            value: ethers.utils.parseEther("100"),
            gasLimit: 500000
        }
        alice.sendTransaction(tx);

        // first, add liquidity
        const unresolvedReceipt = await liquidityPool.connect(alice).mint(alice.address);
        const resolvedReceipt = await unresolvedReceipt.wait();
        liquidity = resolvedReceipt.events?.find(event => event.event === "Mint")?.args![2];
    });
    it("burn liquidity by someone who didn't add liquidity before", async function() {
        await expect(liquidityPool.connect(treasury).burn(bob.address)).to.be.revertedWith("INSUFFICIENT_LIQUIDITY_BURNED");
    });
    it("burn liquidity by someone who added liquidity before", async function() {
        await liquidityPool.connect(alice).transfer(liquidityPool.address, liquidity);
        await expect(liquidityPool.connect(treasury).burn(alice.address)).emit(liquidityPool, "Burn").withArgs(
            treasury.address,
            alice.address,
            "500000000000000000000",
            "100000000000000000000"
        );
    });
  });

  describe("swap SPC to ETH", function () {
    this.beforeEach(async function() {
        // move to GENERAL phase
        await spaceCoinICO.connect(owner).changeICOStage(1);

        // move to OPEN phase
        await spaceCoinICO.connect(owner).changeICOStage(2);
        await spaceCoinICO.connect(alice).investInSPC({value: ethers.utils.parseEther("1500")});
        await spaceCoinICO.connect(alice).transfer(liquidityPool.address, ethers.utils.parseEther("500"));
        await spaceCoinICO.connect(owner).withdrawFund(treasury.address);

        const tx = {
            to: liquidityPool.address,
            value: ethers.utils.parseEther("100"),
            gasLimit: 500000
        }
        alice.sendTransaction(tx);

        // add liquidity
        const unresolvedReceipt = await liquidityPool.connect(alice).mint(alice.address);
        const resolvedReceipt = await unresolvedReceipt.wait();
        liquidity = resolvedReceipt.events?.find(event => event.event === "Mint")?.args![2];

        spaceRouterFactory = await ethers.getContractFactory("SpaceRouter");
        spaceRouter = (await spaceRouterFactory.connect(owner).deploy(liquidityPool.address, spaceCoinICO.address)) as SpaceRouter;
        await spaceRouter.deployed();
        console.log("space Router contract address: ", spaceRouter.address);
    });
    it("send zero(0) SPC to swap", async function() {
        await expect(liquidityPool.connect(treasury).swapSPCtoETH(ethers.utils.parseEther("0"), alice.address))
        .to.be.revertedWith("INSUFFICIENT_OUTPUT_AMOUNT");
    });
    it("swap when there is zero liquidity", async function() {
        // first transfer the liquidity to liquidity pool
        await liquidityPool.connect(alice).transfer(liquidityPool.address, liquidity);

        // burn the liquidity
        await liquidityPool.connect(alice).burn(alice.address);

        await expect(liquidityPool.connect(treasury).swapSPCtoETH(ethers.utils.parseEther("5"), alice.address))
        .to.be.revertedWith("INSUFFICIENT_LIQUIDITY");
    });
    it("swap without burning the liquidity : INVALID_K", async function() {        
        await expect(liquidityPool.connect(treasury).swapSPCtoETH(ethers.utils.parseEther("5"), alice.address))
        .to.be.revertedWith("INVALID_K");
    });
    it("swap to liquidityPool.address/ spaceCoinICO.address only", async function() {        
        await expect(liquidityPool.connect(treasury).swapSPCtoETH(ethers.utils.parseEther("5"), liquidityPool.address))
        .to.be.revertedWith("INVALID_TO_ADDRESS");

        await expect(liquidityPool.connect(treasury).swapSPCtoETH(ethers.utils.parseEther("5"), spaceCoinICO.address))
        .to.be.revertedWith("INVALID_TO_ADDRESS");
    });
    it("swap SPC == > ETH", async function() {
        await spaceCoinICO.connect(alice).transfer(liquidityPool.address, ethers.utils.parseEther("5"));
        let _ETHBalance: BigNumber = await ethers.provider.getBalance(alice.address);

        const unresolvedReceipt = await spaceRouter.getEstimatedTradeVal(ethers.utils.parseEther("5"), 0);
        const resolvedReceipt = await unresolvedReceipt.wait();
        let _ethAmountOut: BigNumber = resolvedReceipt.events?.find(event => event.event === "EstimatedTradeValue")?.args![1];

        await liquidityPool.connect(treasury).swapSPCtoETH(_ethAmountOut, alice.address);
        _ETHBalance = _ETHBalance.add(_ethAmountOut);
        expect(await ethers.provider.getBalance(alice.address)).to.equals(_ETHBalance);
    });
  });

  describe("swap ETH to SPC", function () {
    this.beforeEach(async function() {
        // move to GENERAL phase
        await spaceCoinICO.connect(owner).changeICOStage(1);

        // move to OPEN phase
        await spaceCoinICO.connect(owner).changeICOStage(2);
        await spaceCoinICO.connect(alice).investInSPC({value: ethers.utils.parseEther("1500")});
        await spaceCoinICO.connect(alice).transfer(liquidityPool.address, ethers.utils.parseEther("500"));
        await spaceCoinICO.connect(owner).withdrawFund(treasury.address);

        const tx = {
            to: liquidityPool.address,
            value: ethers.utils.parseEther("100"),
            gasLimit: 500000
        }
        alice.sendTransaction(tx);

        // add liquidity
        const unresolvedReceipt = await liquidityPool.connect(alice).mint(alice.address);
        const resolvedReceipt = await unresolvedReceipt.wait();
        liquidity = resolvedReceipt.events?.find(event => event.event === "Mint")?.args![2];

        spaceRouterFactory = await ethers.getContractFactory("SpaceRouter");
        spaceRouter = (await spaceRouterFactory.connect(owner).deploy(liquidityPool.address, spaceCoinICO.address)) as SpaceRouter;
        await spaceRouter.deployed();
        console.log("space Router contract address: ", spaceRouter.address);
    });
    it("send zero(0) ETH to swap", async function() {
        await expect(liquidityPool.connect(treasury).swapETHtoSPC(ethers.utils.parseEther("0"), alice.address))
        .to.be.revertedWith("INSUFFICIENT_OUTPUT_AMOUNT");
    });
    it("swap when there is zero liquidity", async function() {
        // first transfer the liquidity to liquidity pool
        await liquidityPool.connect(alice).transfer(liquidityPool.address, liquidity);

        // burn the liquidity
        await liquidityPool.connect(alice).burn(alice.address);

        await expect(liquidityPool.connect(treasury).swapETHtoSPC(ethers.utils.parseEther("5"), alice.address))
        .to.be.revertedWith("INSUFFICIENT_LIQUIDITY");
    });
    it("swap without burning the liquidity : INVALID_K", async function() {        
        await expect(liquidityPool.connect(treasury).swapETHtoSPC(ethers.utils.parseEther("5"), alice.address))
        .to.be.revertedWith("INVALID_K");
    });
    it("swap to liquidityPool.address/ spaceCoinICO.address only", async function() {        
        await expect(liquidityPool.connect(treasury).swapETHtoSPC(ethers.utils.parseEther("5"), liquidityPool.address))
        .to.be.revertedWith("INVALID_TO_ADDRESS");

        await expect(liquidityPool.connect(treasury).swapETHtoSPC(ethers.utils.parseEther("5"), spaceCoinICO.address))
        .to.be.revertedWith("INVALID_TO_ADDRESS");
    });
    it("swap ETH == > SPC", async function() { 
        const tx = {
            to: liquidityPool.address,
            value: ethers.utils.parseEther("1"),
            gasLimit: 500000
        }
        alice.sendTransaction(tx);
        let _SPCBalance: BigNumber = await spaceCoinICO.balanceOf(alice.address);

        const unresolvedReceipt = await spaceRouter.getEstimatedTradeVal(ethers.utils.parseEther("1"), 1);
        const resolvedReceipt = await unresolvedReceipt.wait();
        let _spcAmountOut: BigNumber = resolvedReceipt.events?.find(event => event.event === "EstimatedTradeValue")?.args![1];

        await liquidityPool.connect(treasury).swapETHtoSPC(_spcAmountOut, alice.address);
        _SPCBalance = _SPCBalance.add(_spcAmountOut);
        expect(await spaceCoinICO.balanceOf(alice.address)).to.equals(_SPCBalance);
    });
  });
});