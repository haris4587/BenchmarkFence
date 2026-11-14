# BenchmarkFence — final submission details

**Contribution type:** Builder → Projects
**Title:** BenchmarkFence — Evidence-Bound AI Benchmark Contamination Verification

## Paste-ready description (under 1,000 characters)

BenchmarkFence helps AI researchers verify benchmark overlap in disclosed training samples. A GenLayer Intelligent Contract hash-locks exact evidence bytes, detects copied questions deterministically, and uses independent AI validators to assess paraphrases and hidden answer leakage. The dashboard supports Studio built-in account signing, checks signed call identity, tracks consensus through finalized execution, and verifies evidence-linked, append-only hash-chained receipts. Uncertain cases remain INCONCLUSIVE; NO_OVERLAP_FOUND applies only to submitted samples, never an undisclosed corpus or an entire model. Includes public source, accurate docs, receipt exports, 35 Python and 44 JavaScript tests, green CI, and five live full-consensus review outcomes.

## Evidence links

- Website: https://benchmarkfence.vercel.app/
- Public source: https://github.com/haris4587/BenchmarkFence
- Deployed contract: https://explorer-studio.genlayer.com/address/0xC6a6c2982F23229488D590A87148840469687E79
- Import deployed contract into Studio: https://studio.genlayer.com/?import-contract=0xC6a6c2982F23229488D590A87148840469687E79
- Successful deployment: https://explorer-studio.genlayer.com/tx/0x4c2570f26e229a962fd8da92541ab86f7b4dfd9df445ef67b283b8c4de4de87f
- Successful semantic review: https://explorer-studio.genlayer.com/tx/0xe70b1ea5cc7b9397bd7cb01acb2792bc5909c0c84df99bd01ec9aa209fe8c084
- Successful answer-leakage review: https://explorer-studio.genlayer.com/tx/0x7e92c38f186a805140a1660f402ce208915a92e3c29e7557fb6262f4058378ed
- Successful no-overlap review: https://explorer-studio.genlayer.com/tx/0xa99035ac01626777b36ec74c7493e3dbd9f9d982c04c9e7fbd905453941a2839
- Successful INCONCLUSIVE review: https://explorer-studio.genlayer.com/tx/0x2f9433eb7b2b2dd8f31e421d2c8d51fbeb17c803bb7db631c8194eebb5bc3642
- Live semantic case: https://benchmarkfence.vercel.app/?case=511c92f324508bf654e61deb7b80426ba8500448c6966e8bddb4ef4326ee16a0#receipts
- Live uncertain case: https://benchmarkfence.vercel.app/?case=d29889da64fee57940f3793479213034bffce506bfabb118a8dbefc9a73b0d5a#receipts
- CI: https://github.com/haris4587/BenchmarkFence/actions
- Full validation and limitations: https://github.com/haris4587/BenchmarkFence/blob/main/docs/validation.md
- Transaction/export evidence: https://github.com/haris4587/BenchmarkFence/tree/main/evidence

## What makes it meaningful

It addresses evaluation trust rather than improving a prompt response. The contract combines deterministic evidence integrity/matching with independently repeated semantic validation. Its classifications are bound to immutable submitted bytes and explicit sample/question IDs. Owners cannot replace old evidence or rewrite receipts. Review retries are restricted to INCONCLUSIVE cases and at most three attempts. A real dashboard handles actual contract state, Studio signing handoff and transaction execution outcomes.

## Reviewer walkthrough

1. Open the live semantic case above. Inspect the actual training/evaluation pair and PARAPHRASE finding.
2. Expand the receipt chain and export the record. Run `python scripts/verify_receipt.py <downloaded-file>` to check its hashes.
3. Open the uncertain case to see a successful execution resulting in INCONCLUSIVE, distinct from transaction failure.
4. Use the Studio import link, keep Normal (Full Consensus), and submit a new public batch through the dashboard's prepared-call workflow using your own built-in Studio address. Sign in Studio, then track the returned hash in the dashboard. The dashboard verifies the signed call before accepting the result.
5. Inspect the contract, tests, source hash and live receipts in the repository. Reproduce the narrow-viewport checks at `/qa/responsive.html`.

No video or social post is claimed. The live working demo and documented transaction evidence are supplied.
