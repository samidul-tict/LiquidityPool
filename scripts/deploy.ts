// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, network } from "hardhat";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SpaceCoinICO, SpaceCoinICO__factory } from "../typechain/";
import { LiquidityPool, LiquidityPool__factory } from "../typechain/";
import { SpaceRouter, SpaceRouter__factory } from "../typechain/";

async function main() {
  let spaceCoinICO: SpaceCoinICO;
  let spaceCoinICOFactory: SpaceCoinICO__factory;
  let spaceRouter: SpaceRouter;
  let spaceRouterFactory: SpaceRouter__factory;
  let liquidityPool: LiquidityPool;
  let liquidityPoolFactory: LiquidityPool__factory;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let whitelist: string[];

  [owner] = await ethers.getSigners();
  [treasury] = await ethers.getSigners();
  [alice] = await ethers.getSigners();
  [bob] = await ethers.getSigners();
  whitelist = [owner.address, treasury.address];

  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  spaceCoinICOFactory = await ethers.getContractFactory("SpaceCoinICO");
  spaceCoinICO = await spaceCoinICOFactory.deploy(treasury.address, whitelist);
  await spaceCoinICO.deployed();
  console.log("Space Coin ICO deployed to: ", spaceCoinICO.address);
  
  console.log("Owner address: ", owner.address);
  console.log("Treasury address: ", treasury.address);
  console.log("Alice address: ", alice.address);
  console.log("Bob address: ", bob.address);
  
  liquidityPoolFactory = await ethers.getContractFactory("LiquidityPool");
  liquidityPool = (await liquidityPoolFactory.deploy(spaceCoinICO.address)) as LiquidityPool;
  await liquidityPool.deployed();
  console.log("liquidity pool contract address: ", liquidityPool.address);

  spaceRouterFactory = await ethers.getContractFactory("SpaceRouter");
  spaceRouter = (await spaceRouterFactory.deploy(liquidityPool.address, spaceCoinICO.address)) as SpaceRouter;
  await spaceRouter.deployed();
  console.log("space Router contract address: ", spaceRouter.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
