import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const RPC = process.env.RPC || "https://studio-next.genlayer.com/api";
export const CHAIN_ID = Number(process.env.CHAIN_ID || 61997);
export const chain = { ...studionet, id: CHAIN_ID, rpcUrls: { default: { http: [RPC] } } };

export function clientFor(privateKey) {
  const account = createAccount(privateKey);
  return { account, client: createClient({ chain, endpoint: RPC, account }) };
}
export const newKey = generatePrivateKey;

export async function fund({ client, account }, amount = 1e19) {
  await client.request({ method: "sim_fundAccount", params: [account.address, amount] });
}
export async function send(client, args) {
  const est = await client.estimateTransactionFeesForWrite(args);
  const hash = await client.writeContract({ ...args, fees: { distribution: est.distribution, feeValue: est.feeValue } });
  return client.waitForDecision
    ? client.waitForDecision({ hash })
    : client.waitForTransactionReceipt({ hash, status: "ACCEPTED", retries: 60, interval: 4000 });
}
export async function deployFees(client) {
  const est = await client.estimateTransactionFees({
    leaderTimeunitsAllocation: 125n, validatorTimeunitsAllocation: 250n,
    executionBudgetPerRound: 786_500n, totalMessageFees: 0n, appealRounds: 1n, rotations: [1n, 1n],
  });
  return { distribution: est.distribution, feeValue: est.feeValue };
}
export function readEnvAddress() {
  const f = path.join(ROOT, "frontend", ".env.local");
  const m = fs.existsSync(f) && fs.readFileSync(f, "utf8").match(/VITE_WAYMARK_ADDRESS=(0x[0-9a-fA-F]+)/);
  return process.env.WAYMARK_ADDRESS || (m && m[1]);
}
