// End-to-end demo on the real network: lock funds, submit evidence, let validators rule.
import { clientFor, newKey, fund, send, readEnvAddress } from "./lib.mjs";

const address = readEnvAddress();
if (!address) throw new Error("Deploy first (npm run deploy) or set WAYMARK_ADDRESS");
const funder = clientFor(newKey()), builder = clientFor(newKey());
await Promise.all([fund(funder), fund(builder)]);

const URL = "https://example.com";
const ms = [
  { title: "Landing page", criteria: "The page is titled 'Example Domain'", percent: 50 },
  { title: "Everest guide", criteria: "The page explains how to climb Mount Everest", percent: 50 },
];
const call = (who, functionName, args, value = 0n) =>
  send(who.client, { address, functionName, args, value });
const deals = async () => JSON.parse(await funder.client.readContract({ address, functionName: "get_all", args: [] }));

await call(funder, "create_deal", [builder.account.address, "Demo deal", JSON.stringify(ms)], 10n ** 18n);
const id = (await deals()).length - 1;
for (const i of [0, 1]) {
  await call(builder, "submit", [id, i, URL]);
  await call(funder, "judge", [id, i]);
}
const d = (await deals())[id];
d.milestones.forEach((m) => console.log(m.title, "->", m.status, "|", m.note));
const ok = d.milestones[0].status === "released" && d.milestones[1].status === "rejected";
console.log(ok ? "PASS: honest panel released one milestone and rejected the other" : "UNEXPECTED result (models can disagree; rerun)");
process.exit(ok ? 0 : 1);
