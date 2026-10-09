# Waymark

**Pay for progress, not promises.** Waymark locks funds behind plain-English milestones. A panel of GenLayer validators reads the evidence and releases each payment when it checks out.

- Live app: [way-mark-delta.vercel.app]
- Network: GenLayer Studio Next (chain ID 61997, RPC https://studio-next.genlayer.com/api)
- Contract: [0xE64597ccEF274B011EBcec84Cc9d1F8702B24A65] ([explorer](https://explorer-studio-dev.genlayer.com/))
- Source: [`contracts/waymark.py`](contracts/waymark.py)

## The problem
Paying for milestone work means someone has to decide "is this delivered?" A normal contract can't read a web page, and a human or server arbiter becomes the trusted operator. Waymark replaces that arbiter with validator consensus.

## How it works
1. **Lock.** The funder locks value and splits it into milestones, each with plain-English criteria and a percent share.
2. **Submit.** The builder links a public evidence page: a live demo, a release, a README.
3. **Review.** Anyone asks the panel to review. Each validator fetches the page itself and rules `MET`, `PARTIAL` or `NOT_MET`; consensus must agree on the label.
4. **Release.** On `MET` the tranche is paid to the builder. Otherwise the milestone is rejected and the builder can resubmit.

## Why GenLayer
Whether work meets criteria is a judgement about meaning. Remove the `gl.eq_principle.prompt_comparative` call in `judge` and no payment can ever be released. The contract has no owner, admin, pause or withdraw method. Evidence is marked untrusted in the prompt, and unrelated or empty pages resolve to `NOT_MET`.

## Try it (about 5 minutes)
1. Open the live app, press **Connect wallet** (MetaMask, Rabby or any browser wallet; the app adds Studio Next for you) or use the built-in demo account, then press **Get test funds**.
2. Click your address (top right) to copy it, and paste it as **Builder address** in **New deal**.
3. Use these milestones, then press **Lock funds and create deal**:
   `Landing page | The page is titled 'Example Domain' | 50`
   `Everest guide | The page explains how to climb Mount Everest | 50`
4. Submit `https://example.com` as evidence for both, then press **Ask validators to review** on each.
5. Expected: the first milestone is released and paid; the second is rejected with a reason.

## Run it yourself
```
npm install && (cd frontend && npm install)
npm run deploy               # deploys the contract, writes frontend/.env.local
cd frontend && npm run dev   # http://localhost:5173
python -m pytest            # unit tests: allocation rules and payout caps (no node needed)
python -m pytest tests/direct  # Direct Mode tests (needs genlayer-test)
npm run demo                 # end-to-end run on the real network
```
Deploy the frontend to Vercel with root directory `frontend` and the variables in `frontend/.env.example`.

## Layout
`contracts/` Intelligent Contract · `deploy/` deploy script · `frontend/` Vite app using genlayer-js · `scripts/` shared client and end-to-end demo · `tests/direct/` Direct Mode tests · `docs/DESIGN.md`

## Known limitations
- No refund path if a builder never delivers.
- No bonded challenge or appeal of a ruling yet.
- Models can disagree; if validators can't agree the transaction is undetermined and nothing moves, so run it again.
- Demo keys are throwaway keys stored in the browser, for test funds only.
