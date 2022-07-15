import { ethers } from "ethers";
import LiquidityPool from "../../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json";
import SpaceRouter from "../../artifacts/contracts/SpaceRouter.sol/SpaceRouter.json";
import SpaceCoinICO from "../../artifacts/contracts/SpaceCoinICO.sol/SpaceCoinICO.json";

const ROUTER_CONTRACT_ADDRESS = "0x10dD48bdb34f354A9053fe6D632b654088bf25D6";
const ICO_CONTRACT_ADDRESS = "0x4Ed421d76de3474D94739CAeE433d496FE670d77";
const LP_CONTRACT_ADDRESS = "0x72Ac35F1E89aF3Ea3E840726FD755796C2f09D04";

const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();

const lpContract = new ethers.Contract(
  LP_CONTRACT_ADDRESS,
  LiquidityPool.abi,
  signer
);
const icoContract = new ethers.Contract(
  ICO_CONTRACT_ADDRESS,
  SpaceCoinICO.abi,
  signer
);
const routerContract = new ethers.Contract(
  ROUTER_CONTRACT_ADDRESS,
  SpaceRouter.abi,
  signer
);

const MAX_GAS_LIMIT = ethers.utils.hexlify(10000000);
let reserveSPC;
let reserveETH;

// Kick things off
go();

async function go() {
  await connectToMetamask();
  ico_spc_left.innerText = ethers.utils.formatEther(
    await icoContract.balanceOf(ICO_CONTRACT_ADDRESS)
  );
  total_contribution.innerText = ethers.utils.formatEther(
    await icoContract.totalContribution()
  );
  my_spc.innerText = ethers.utils.formatEther(
    await icoContract.balanceOf(signer.getAddress())
  );
  transfer_fee_status.innerText = await icoContract.canDeductTax();

  const [_spc, _eth] = await lpContract.getReserves();
  reserveSPC = _spc;
  reserveETH = _eth;
  lp_eth_bal.innerText = ethers.utils.formatEther(_eth);
  lp_spc_bal.innerText = ethers.utils.formatEther(_spc);
  my_lp_token.innerText = ethers.utils.formatEther(
    await lpContract.balanceOf(signer.getAddress())
  );
}

async function connectToMetamask() {
  try {
    console.log("Signed in as", await signer.getAddress());
  } catch (err) {
    console.log("Not signed in");
    await provider.send("eth_requestAccounts", []);
  }
}

/* ------------------- Space Coin ICO -------------------- */

toggle_transfer_fee.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  console.log("Toggling Transfer Fee");

  await connectToMetamask();
  try {
    await icoContract.toggleTaxFlag();
    transfer_fee_status.innerText = await icoContract.canDeductTax();
  } catch (err) {
    console.log(err);
  }
});

ico_spc_buy.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const eth = ethers.utils.parseEther(form.eth.value);
  console.log("Buying", eth, "eth");

  await connectToMetamask();
  try {
    await signer.sendTransaction({
      to: ICO_CONTRACT_ADDRESS,
      value: eth,
      gasLimit: ethers.utils.hexlify(10000000),
    });
    ico_spc_left.innerText = ethers.utils.formatEther(
      await icoContract.balanceOf(ICO_CONTRACT_ADDRESS)
    );
    total_contribution.innerText = ethers.utils.formatEther(
      await icoContract.totalContribution()
    );
    my_spc.innerText = ethers.utils.formatEther(
      await icoContract.balanceOf(signer.getAddress())
    );
  } catch (err) {
    console.log(err);
  }
});

/* ------------------- End -------------------- */

/* ------------------- Liquidity Pool -------------------- */

//
// LP
//
let currentSpcToEthPrice = 5;

provider.on("block", (n) => {
  console.log("New block", n);
  // TODO: Update currentSpcToEthPrice
});

lp_deposit.eth.addEventListener("input", (e) => {
  lp_deposit.spc.value = +e.target.value * currentSpcToEthPrice;
});

lp_deposit.spc.addEventListener("input", (e) => {
  lp_deposit.eth.value = +e.target.value / currentSpcToEthPrice;
});

lp_deposit.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const eth = ethers.utils.parseEther(form.eth.value);
  const spc = ethers.utils.parseEther(form.spc.value);
  console.log("Depositing", eth, "eth and", spc, "spc");

  await connectToMetamask();

  try {
    const unresolvedReceipt = await icoContract.approve(ROUTER_CONTRACT_ADDRESS, spc);
    const resolvedReceipt = await unresolvedReceipt.wait();
    await routerContract.deposit(spc, signer.getAddress(), { value: eth });

    my_spc.innerText = ethers.utils.formatEther(
      await icoContract.balanceOf(signer.getAddress())
    );
    const [_spc, _eth] = await lpContract.getReserves();
    lp_eth_bal.innerText = ethers.utils.formatEther(_eth);
    lp_spc_bal.innerText = ethers.utils.formatEther(_spc);
    my_lp_token.innerText = ethers.utils.formatEther(
      await lpContract.balanceOf(signer.getAddress())
    );
  } catch (err) {
    console.log(err);
  }
});

lp_withdraw.addEventListener("submit", async (e) => {
  e.preventDefault();
  console.log("Withdrawing 100% of LP");

  await connectToMetamask();

  try {
    const _myLP = await lpContract.balanceOf(signer.getAddress());
    const unresolvedReceipt = await lpContract.approve(ROUTER_CONTRACT_ADDRESS, _myLP);
    const resolvedReceipt = await unresolvedReceipt.wait();
    await routerContract.withdraw(_myLP, signer.getAddress());

    my_spc.innerText = ethers.utils.formatEther(
      await icoContract.balanceOf(signer.getAddress())
    );
    const [_spc, _eth] = await lpContract.getReserves();
    lp_eth_bal.innerText = ethers.utils.formatEther(_eth);
    lp_spc_bal.innerText = ethers.utils.formatEther(_spc);
    my_lp_token.innerText = ethers.utils.formatEther(
      await lpContract.balanceOf(signer.getAddress())
    );
  } catch (err) {
    console.log(err);
  }
});

//
// Swap
//
let swapIn = { type: "eth", value: 0 };
let swapOut = { type: "spc", value: 0 };
switcher.addEventListener("click", () => {
  [swapIn, swapOut] = [swapOut, swapIn];
  swap_in_label.innerText = swapIn.type.toUpperCase();
  swap.amount_in.value = swapIn.value;
  updateSwapOutLabel();
});

swap.amount_in.addEventListener("input", updateSwapOutLabel);

function updateSwapOutLabel() {
  /* swapOut.value = swapIn.type === 'eth'
    ? +swap.amount_in.value * currentSpcToEthPrice
    : +swap.amount_in.value / currentSpcToEthPrice; */
  let _reserveIn = 0;
  let _reserveOut = 0;
  /* let _denominator = 0;
  let _netAmountIn = swap.amount_in.value * 99;
  const _transferFee = document.getElementById('transfer_fee_status').innerHTML;
  if (swapIn.type === "eth") {
    // ETH to SPC
    _reserveIn = reserveETH;
    _reserveOut = reserveSPC;
    _denominator = _reserveIn * 100 + _netAmountIn;
    const _numerator = _netAmountIn * _reserveOut;

    if(_transferFee == 'true') {
      swapOut.value = (_numerator * 98) / (_denominator * 100);
    } else {
      swapOut.value = _numerator / _denominator;
    }
  } else {
    // SPC to ETH
    _reserveIn = reserveSPC;
    _reserveOut = reserveETH;
    _denominator = _reserveIn * 100 + _netAmountIn;
    if(_transferFee == 'true') {
      _netAmountIn = (swap.amount_in.value * 99 * 98) / 100;
      _denominator = (_reserveIn * 100) + _netAmountIn;
    }
    const _numerator = _netAmountIn * _reserveOut;
    swapOut.value = _numerator / _denominator;
  } */

  if (swapIn.type === "eth") {
    // ETH to SPC
    _reserveIn = reserveETH;
    _reserveOut = reserveSPC;
  } else {
    // SPC to ETH
    _reserveIn = reserveSPC;
    _reserveOut = reserveETH;
  }
  alert(_reserveIn);
  alert(_reserveOut);
  const _netAmountIn = swap.amount_in.value * 99;
  const _numerator = _netAmountIn * _reserveOut;
  const _denominator = (_reserveIn * 100) + _netAmountIn;
  swapOut.value = _numerator / _denominator;

  swap.min_amount_out.value = 0;
  swap_out_label.innerText = `${swapOut.value} ${swapOut.type.toUpperCase()}`;
}

swap.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const amountIn = ethers.utils.parseEther(form.amount_in.value);
  const minAmountOut = ethers.utils.parseEther(form.min_amount_out.value);
  error_msg.innerHTML = "";
  console.log("Swapping", amountIn, swapIn.type, "for", swapOut.type);

  await connectToMetamask();

  try {
    if (swapIn.type === "eth") {
      // ETH to SPC
      await routerContract.swapETHtoSPC(minAmountOut, signer.getAddress(), {
        value: amountIn,
      });
    } else {
      // SPC to ETH
      await icoContract.approve(ROUTER_CONTRACT_ADDRESS, amountIn);
      await routerContract.swapSPCtoETH(
        amountIn,
        minAmountOut,
        signer.getAddress()
      );
    }
    const [_spc, _eth] = await lpContract.getReserves();
    lp_eth_bal.innerText = ethers.utils.formatEther(_eth);
    lp_spc_bal.innerText = ethers.utils.formatEther(_spc);
  } catch (err) {
    error_msg.innerHTML = err.reason;
    console.log(err);
  }
});

/* ------------------- End -------------------- */
