# Waymark design

**Problem.** Paying for milestone work needs someone to decide "is this delivered?", which is a judgement about meaning. A normal contract can't read a page, and a human or server arbiter becomes the trusted operator.

**Flow.** Funder locks value and defines milestones (title, plain-English criteria, percent). Builder submits an evidence URL. Anyone calls `judge`; each validator fetches the page itself and rules MET / PARTIAL / NOT_MET under `prompt_comparative` (verdict label must match). MET pays that tranche to the builder. Otherwise the milestone is rejected and the builder can resubmit.

**Why GenLayer.** Delete the `prompt_comparative` call in `judge` and no tranche can ever be released. There is no owner, admin, pause or withdraw method.

**Prompt injection.** Evidence is marked untrusted in the prompt and truncated to 12,000 characters. Ambiguous or unrelated pages resolve to NOT_MET.

**Known limits.** No refund path if a builder never delivers; no bonded challenge or appeal; payouts rely on `emit_transfer` working on the target network; the funder can't dispute a MET ruling. Next step: bonded challenges and appeals, as in Chargeback.
