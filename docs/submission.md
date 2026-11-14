# BenchmarkFence — submission

Category: **Projects** (full contract and dashboard).

## What it does

BenchmarkFence helps AI researchers preserve inspectable evidence of benchmark overlap in disclosed training samples. The GenLayer contract hash-locks exact input bytes, deterministically finds normalized question copies, and uses independent AI validator assessments for paraphrases and answer leakage. Evidence-linked findings and append-only hash-chained receipts remain available in the dashboard and as JSON exports. Unknown cases remain INCONCLUSIVE. Findings never claim to audit undisclosed training data or certify an entire model as clean.

## How to use

Load or import public evidence in the dashboard. Select the public address of your GenLayer Studio built-in account. Prepare `submit`, sign it in Studio in **Normal (Full Consensus)** mode, and return its transaction hash to the dashboard. The dashboard checks that the actual signed sender, contract, method and arguments match the prepared call. It tracks finalization/execution and verifies finalized state. Repeat for `review`, then inspect linked pairs and export receipts. Browser wallets can also sign dapp calls directly.

The README covers exact schema limits, security assumptions, local development and offline receipt verification. Live findings and public links will be recorded here after hosted verification.
