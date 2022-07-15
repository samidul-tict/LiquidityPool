import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SpaceCoinICO, SpaceCoinICO__factory } from "../typechain/";
import { LiquidityPool, LiquidityPool__factory } from "../typechain/";
import { SpaceRouter, SpaceRouter__factory } from "../typechain/";

describe("Space Router", function () {
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

  this.beforeEach(async function () {
    [owner, treasury, alice, bob, charlie, dan] = await ethers.getSigners();

    whitelist = [
      owner.address,
      treasury.address,
      alice.address,
      bob.address,
      charlie.address,
      dan.address,
    ];

    spaceCoinICOFactory = await ethers.getContractFactory("SpaceCoinICO");
    spaceCoinICO = (await spaceCoinICOFactory
      .connect(owner)
      .deploy(treasury.address, whitelist)) as SpaceCoinICO;
    await spaceCoinICO.deployed();
    console.log("ICO contract address: ", spaceCoinICO.address);

    liquidityPoolFactory = await ethers.getContractFactory("LiquidityPool");
    liquidityPool = (await liquidityPoolFactory
      .connect(owner)
      .deploy(spaceCoinICO.address)) as LiquidityPool;
    await liquidityPool.deployed();
    console.log("Liquidity Pool contract address: ", liquidityPool.address);

    spaceRouterFactory = await ethers.getContractFactory("SpaceRouter");
    spaceRouter = (await spaceRouterFactory
      .connect(owner)
      .deploy(liquidityPool.address, spaceCoinICO.address)) as SpaceRouter;
    await spaceRouter.deployed();
    console.log("space Router contract address: ", spaceRouter.address);
  });

  describe("add liquidity", function () {
    this.beforeEach(async function () {
      // move to GENERAL phase
      await spaceCoinICO.connect(owner).changeICOStage(1);

      // move to OPEN phase
      await spaceCoinICO.connect(owner).changeICOStage(2);
      await spaceCoinICO.connect(alice).investInSPC({ value: ethers.utils.parseEther("1500") });
      await spaceCoinICO.connect(bob).investInSPC({ value: ethers.utils.parseEther("1000") });
      await spaceCoinICO.connect(owner).withdrawFund(treasury.address);

      await spaceCoinICO.connect(treasury).approve(spaceRouter.address, ethers.utils.parseEther("500"));
    });
    it("deposit directly to contract", async function () {
      const tx = {
        to: spaceRouter.address,
        value: ethers.utils.parseEther("10"),
        gasLimit: 500000,
      };
      await expect(alice.sendTransaction(tx)).to.be.revertedWith(
        "USE METHOD: DEPOSIT"
      );
    });
    it("first time: deposit SPC and ETH both in 5:1 ratio", async function () {
      expect(await spaceRouter.connect(treasury).deposit(
        ethers.utils.parseEther("500"), bob.address, {value: ethers.utils.parseEther("100")})
      ).to.emit(spaceRouter, "LiquidityAdded").withArgs(
          treasury.address,
          bob.address,
          ethers.utils.parseEther("500"),
          ethers.utils.parseEther("100"),
          "223606797749978968640"
        );
    });
    it("nth time: deposit SPC and ETH both in 5:1 ratio", async function () {
      // first liquidity deposit
      await spaceRouter
        .connect(treasury)
        .deposit(ethers.utils.parseEther("500"), bob.address, {
          value: ethers.utils.parseEther("100"),
        });

      // second liquidity deposit
      await spaceCoinICO
        .connect(treasury)
        .approve(spaceRouter.address, ethers.utils.parseEther("500"));
      expect(
        await spaceRouter
          .connect(treasury)
          .deposit(ethers.utils.parseEther("500"), bob.address, {
            value: ethers.utils.parseEther("100"),
          })
      )
        .to.emit(spaceRouter, "LiquidityAdded")
        .withArgs(
          treasury.address,
          bob.address,
          ethers.utils.parseEther("500"),
          ethers.utils.parseEther("100"),
          "223606797749978968640"
        );
    });
    it("deposit SPC and ETH both in any ratio", async function () {
      // first liquidity deposit
      expect(
        await spaceRouter
          .connect(treasury)
          .deposit(ethers.utils.parseEther("500"), bob.address, {
            value: ethers.utils.parseEther("10"),
          })
      )
        .to.emit(spaceRouter, "LiquidityAdded")
        .withArgs(
          treasury.address,
          bob.address,
          ethers.utils.parseEther("50"),
          ethers.utils.parseEther("10"),
          "70710678118654751440"
        );

      // second liquidity deposit
      await spaceCoinICO
        .connect(treasury)
        .approve(spaceRouter.address, ethers.utils.parseEther("500"));
      expect(
        await spaceRouter
          .connect(treasury)
          .deposit(ethers.utils.parseEther("40"), bob.address, {
            value: ethers.utils.parseEther("10"),
          })
      )
        .to.emit(spaceRouter, "LiquidityAdded")
        .withArgs(
          treasury.address,
          bob.address,
          ethers.utils.parseEther("40"),
          ethers.utils.parseEther("8"),
          "5656854249492380115"
        );
    });
    it("deposit SPC only", async function () {
      await expect(
        spaceRouter
          .connect(treasury)
          .deposit(ethers.utils.parseEther("500"), bob.address)
      ).to.be.revertedWith("NO_LIQUIDITY");
    });
    it("deposit ETH only", async function () {
      await expect(
        spaceRouter
          .connect(treasury)
          .deposit(ethers.utils.parseEther("0"), bob.address, {
            value: ethers.utils.parseEther("100"),
          })
      ).to.be.revertedWith("NO_LIQUIDITY");
    });
  });

  describe("remove liquidity", function () {
    this.beforeEach(async function () {
      // move to GENERAL phase
      await spaceCoinICO.connect(owner).changeICOStage(1);

      // move to OPEN phase
      await spaceCoinICO.connect(owner).changeICOStage(2);
      await spaceCoinICO
        .connect(owner)
        .investInSPC({ value: ethers.utils.parseEther("1500") });
      await spaceCoinICO
        .connect(charlie)
        .investInSPC({ value: ethers.utils.parseEther("1000") });
      await spaceCoinICO.connect(owner).withdrawFund(treasury.address);

      // approve 500 SPC to space router contract
      await spaceCoinICO
        .connect(treasury)
        .approve(spaceRouter.address, ethers.utils.parseEther("500"));

      // add liquidity
      const unresolvedReceipt = await spaceRouter
        .connect(treasury)
        .deposit(ethers.utils.parseEther("500"), bob.address, {
          value: ethers.utils.parseEther("100"),
        });
      const resolvedReceipt = await unresolvedReceipt.wait();
      liquidity = resolvedReceipt.events?.find(
        (event) => event.event === "LiquidityAdded"
      )?.args![4];
    });
    it("withdraw zero liquidity", async function () {
      await expect(
        spaceRouter
          .connect(treasury)
          .withdraw(ethers.utils.parseEther("0"), bob.address)
      ).to.be.revertedWith("INCORRECT_LIQUIDITY_VALUE");
    });
    it("withdraw liquidity > 0", async function () {
      // approve 100 LP token to space router contract
      await liquidityPool.connect(bob).approve(spaceRouter.address, liquidity);

      expect(
        await spaceRouter.connect(bob).withdraw(liquidity, treasury.address)
      )
        .to.emit(spaceRouter, "LiquidityRemoved")
        .withArgs(
          bob.address,
          treasury.address,
          ethers.utils.parseEther("500"),
          ethers.utils.parseEther("100"),
          liquidity
        );
    });
    it("withdraw liquidity > received during add liquidity", async function () {
      // approve 100 LP token to space router contract
      liquidity = liquidity.add(ethers.utils.parseEther("100"));
      await liquidityPool.connect(bob).approve(spaceRouter.address, liquidity);

      await expect(
        spaceRouter.connect(bob).withdraw(liquidity, treasury.address)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });

  describe("swap", function () {
    describe("ETH to SPC", function () {
      this.beforeEach(async function () {
        // move to GENERAL phase
        await spaceCoinICO.connect(owner).changeICOStage(1);

        // move to OPEN phase
        await spaceCoinICO.connect(owner).changeICOStage(2);
        await spaceCoinICO
          .connect(charlie)
          .investInSPC({ value: ethers.utils.parseEther("1500") });
        await spaceCoinICO.connect(owner).withdrawFund(treasury.address);

        // approve 500 SPC to space router contract
        await spaceCoinICO
          .connect(treasury)
          .approve(spaceRouter.address, ethers.utils.parseEther("500"));

        // add liquidity
        await spaceRouter
          .connect(treasury)
          .deposit(ethers.utils.parseEther("500"), charlie.address, {
            value: ethers.utils.parseEther("100"),
          });
      });
      it("send zero(0) ether to swap", async function () {
        await expect(
          spaceRouter
            .connect(treasury)
            .swapETHtoSPC(ethers.utils.parseEther("1"), charlie.address, {
              value: ethers.utils.parseEther("0"),
            })
        ).to.be.revertedWith("INVALID_ETH_AMOUNT");
      });
      it("define a minimum accepted limit for returned SPC", async function () {
        await expect(
          spaceRouter
            .connect(treasury)
            .swapETHtoSPC(ethers.utils.parseEther("10"), charlie.address, {
              value: ethers.utils.parseEther("1"),
            })
        ).to.be.revertedWith("BELOW_USER_DEFINED_LIMIT");
      });
      it("get SPC in exchange of ETH", async function () {
        const unresolvedReceipt = await spaceRouter
          .connect(treasury)
          .swapETHtoSPC(ethers.utils.parseEther("9"), charlie.address, {
            value: ethers.utils.parseEther("2"),
          });
        const resolvedReceipt = await unresolvedReceipt.wait();
        let _amountSPCOut: BigNumber = resolvedReceipt.events?.find(
          (event) => event.event === "SwappedToken"
        )?.args![4];
        expect(_amountSPCOut).to.equal("9707785840360855069");
      });
    });
    describe("SPC to ETH", function () {
      this.beforeEach(async function () {
        // move to GENERAL phase
        await spaceCoinICO.connect(owner).changeICOStage(1);

        // move to OPEN phase
        await spaceCoinICO.connect(owner).changeICOStage(2);
        await spaceCoinICO
          .connect(dan)
          .investInSPC({ value: ethers.utils.parseEther("1500") });
        await spaceCoinICO.connect(owner).withdrawFund(treasury.address);

        // approve 500 SPC to space router contract
        await spaceCoinICO
          .connect(treasury)
          .approve(spaceRouter.address, ethers.utils.parseEther("500"));

        // add liquidity
        await spaceRouter
          .connect(treasury)
          .deposit(ethers.utils.parseEther("500"), bob.address, {
            value: ethers.utils.parseEther("100"),
          });
      });
      it("send zero(0) SPC to swap", async function () {
        await expect(
          spaceRouter
            .connect(treasury)
            .swapSPCtoETH(
              ethers.utils.parseEther("0"),
              ethers.utils.parseEther("1"),
              dan.address
            )
        ).to.be.revertedWith("INVALID_SPC_AMOUNT");
      });
      it("define a minimum accepted limit for returned ETH", async function () {
        await expect(
          spaceRouter
            .connect(treasury)
            .swapSPCtoETH(
              ethers.utils.parseEther("10"),
              ethers.utils.parseEther("5"),
              dan.address
            )
        ).to.be.revertedWith("BELOW_USER_DEFINED_LIMIT");
      });
      it("get ETH in exchange of SPC", async function () {
        // approve 500 SPC to space router contract
        await spaceCoinICO
          .connect(dan)
          .approve(spaceRouter.address, ethers.utils.parseEther("10"));

        const unresolvedReceipt = await spaceRouter
          .connect(dan)
          .swapSPCtoETH(
            ethers.utils.parseEther("10"),
            ethers.utils.parseEther("1.9"),
            alice.address
          );
        const resolvedReceipt = await unresolvedReceipt.wait();
        let _amountETHOut: BigNumber = resolvedReceipt.events?.find(
          (event) => event.event === "SwappedToken"
        )?.args![4];
        expect(_amountETHOut).to.equal("1941557168072171013");
      });
    });
  });

  describe("expected trade value", function () {
    this.beforeEach(async function () {
      // move to GENERAL phase
      await spaceCoinICO.connect(owner).changeICOStage(1);

      // move to OPEN phase
      await spaceCoinICO.connect(owner).changeICOStage(2);
      await spaceCoinICO
        .connect(charlie)
        .investInSPC({ value: ethers.utils.parseEther("1500") });
      await spaceCoinICO.connect(owner).withdrawFund(treasury.address);

      // approve 500 SPC to space router contract
      await spaceCoinICO
        .connect(treasury)
        .approve(spaceRouter.address, ethers.utils.parseEther("500"));

      // add liquidity
      await spaceRouter
        .connect(treasury)
        .deposit(ethers.utils.parseEther("500"), charlie.address, {
          value: ethers.utils.parseEther("100"),
        });
    });
    it("ETH to SPC", async function () {
      const unresolvedReceipt = await spaceRouter
        .connect(treasury)
        .getEstimatedTradeVal(ethers.utils.parseEther("20"), 1);
      const resolvedReceipt = await unresolvedReceipt.wait();
      liquidity = resolvedReceipt.events?.find(
        (event) => event.event === "EstimatedTradeValue"
      )?.args![1];

      expect(liquidity).to.equals("82637729549248747913");
    });
    it("SPC to ETH", async function () {
      const unresolvedReceipt = await spaceRouter
        .connect(treasury)
        .getEstimatedTradeVal(ethers.utils.parseEther("20"), 0);
      const resolvedReceipt = await unresolvedReceipt.wait();
      liquidity = resolvedReceipt.events?.find(
        (event) => event.event === "EstimatedTradeValue"
      )?.args![1];

      expect(liquidity).to.equals("3809157368218545594");
    });
  });
});
