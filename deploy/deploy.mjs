// Deploys contracts/waymark.py and writes frontend/.env.local
import fs from "node:fs";
import path from "node:path";
import { ROOT, RPC, CHAIN_ID, clientFor, newKey, fund, deployFees } from "../scripts/lib.mjs";

const keyFile = path.join(ROOT, ".deployer-key");
const key = process.env.DEPLOYER_KEY || (fs.existsSync(keyFile) ? fs.readFileSync(keyFile, "utf8").trim() : newKey());
fs.writeFileSync(keyFile, key);
const me = clientFor(key);
console.log("deployer", me.account.address);
await fund(me).catch((e) => console.log("fund skipped:", e.message));

const code = fs.readFileSync(path.join(ROOT, "contracts", "waymark.py"), "utf8");
const hash = await me.client.deployContract({ code, args: [], fees: await deployFees(me.client) });
console.log("deploy tx", hash);
const r = await me.client.waitForTransactionReceipt({ hash, status: "ACCEPTED", retries: 90, interval: 4000 });
const address = r?.data?.contract_address || r?.txDataDecoded?.contractAddress || r?.recipient;
if (!address) { console.error("could not find contract address in receipt:", JSON.stringify(r)); process.exit(1); }
fs.writeFileSync(
  path.join(ROOT, "frontend", ".env.local"),
  `VITE_WAYMARK_ADDRESS=${address}\nVITE_RPC=${RPC}\nVITE_CHAIN_ID=${CHAIN_ID}\n`
);
console.log("Waymark deployed at", address, "(written to frontend/.env.local)");
