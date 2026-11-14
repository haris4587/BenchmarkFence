# BenchmarkFence

**Evidence before confidence.** A working GenLayer dapp that checks disclosed training samples against evaluation items, records evidence-linked contamination findings, and preserves append-only hash-linked receipts.

## The trust problem

A model's evaluation score can overstate generalization when benchmark questions or answer keys appear in training data. A researcher making a disclosure needs an inspectable record of **what was compared, what was found, and how that finding was reached**. A chat response alone cannot lock evidence, independently validate an assessment, or maintain an immutable audit history.

BenchmarkFence commits the exact submitted UTF-8 bytes, detects normalized exact question occurrences in deterministic code, and asks GenLayer validators to independently classify each remaining sample/evaluation pair. It returns **CONTAMINATION_DETECTED**, **NO_OVERLAP_FOUND**, or **INCONCLUSIVE**. The UI reads the deployed contract and supports browser-wallet writes or explicitly prepared Studio-signed calls and verifies the returned receipt chain locally.

## Scope and honest limits

- Only disclosed samples submitted in a batch are reviewed. There is no access to a model's private training corpus, weights, or undisclosed data.
- A source reference is an uploader's **unverified claim**. Hash locking proves which bytes were submitted; it does not prove provenance, dataset completeness, or when a model was trained.
- **NO_OVERLAP_FOUND is not a clean-model certificate.** It means no contamination was found in these submitted pairs.
- Semantic review is probabilistic; independent validators may disagree or make correlated errors. Disagreement may prevent transaction consensus. This is a transaction failure or unresolved transaction, never an invented INCONCLUSIVE receipt.
- A valid uncertain/unusable model response can yield INCONCLUSIVE when validators agree. Confirmed positive pairs take priority over uncertainty, while the unresolved-pair count remains visible.
- Exact matching uses Unicode `casefold()`, whitespace collapsing, and word boundaries. Punctuation is preserved. It detects the full question occurring in a sample; it does not require an answer match. Very generic short questions are disallowed below 12 characters, but users should still choose distinctive questions.
- Evidence, including reference answers, is **public on-chain**. Never upload private, restricted, or unreleased benchmarks. Test with disclosed material you have permission to publish.
- This is a Studionet development deployment, not a production assurance or financial service. Hosted development networks can change or reset.

## Use the dashboard

1. Open the live deployment listed in [deployment evidence](evidence/deployment.json).
2. Load a labeled synthetic example or import a public JSON bundle following the schema below.
3. Check the evidence hash and confirm publication rights. Select the Studio built-in account workflow or connect a browser wallet.
4. **Lock evidence** and wait for both finalization and successful execution. The UI also checks the expected finalized state.
5. **Request contract review** using the same submitting account. Observe submission, consensus, finalization and execution separately.
6. Inspect each linked sample/question pair, receipt hashes, and explorer links. Export a self-contained verification record.
7. If a call is interrupted, use the saved transaction ID in **Track**. Do not blindly resubmit pending calls.

### Accounts

- The deployment is performed with **GenLayer Studio's built-in account**, in full-consensus mode. Open `contracts/benchmark_fence.py` in [Studio](https://studio.genlayer.com), deploy it, and call `submit` / `review` to reproduce that workflow.
- The dashboard supports MetaMask and other EIP-1193 browser wallets, switches/adds Studionet (61999), handles account/network changes, and lets the wallet approve signatures. No MetaMask installation is required for development testing.
- **Use GenLayer Studio account** selects a public address and prepares exact method/argument calls. Sign in Studio's built-in UI, then paste the transaction hash into the dashboard. Before accepting a matching successful transaction the dashboard verifies its sender, destination, method and exact arguments, then reads finalized contract state and verifies its hash-linked receipts. No signing keys are transferred between origins.
- Studio's browser storage is origin-isolated; this dashboard cannot silently use Studio's private signer. It never asks you to paste a private key and never creates a different signing account.
- Studio string argument fields use a single line. The dashboard explicitly displays compact JSON and its recomputed hash before preparing a Studio submit, preserving the exact bytes that will be signed.

## Evidence format

Maximum **14,000 UTF-8 bytes**, **6 training samples**, **3 evaluation items**, **18 pairs**. Each text sample is at most 1,600 characters; questions 12–600; reference answers 1–240; item IDs 1–40 ASCII letters, digits, `_` or `-`, unique within each collection. Names: 1–120 characters; source claim: 1–400. Unknown fields, duplicate JSON keys and non-finite constants are rejected by the contract.

```json
{
  "version": "benchmarkfence/1",
  "dataset": "Public disclosure snapshot name",
  "benchmark": "Evaluation subset name",
  "source_claim": "Public disclosure reference or explicit synthetic fixture declaration",
  "samples": [{"id": "train-001", "text": "Disclosed training sample..."}],
  "evaluations": [{"id": "eval-001", "question": "A sufficiently specific evaluation question?", "answer": "Reference answer"}]
}
```

The client hashes the original JSON text, not a reserialized object. Changing whitespace changes the commitment. The contract verifies the supplied SHA-256 itself. Case ID = `sha256(lowercase_owner + "\n" + evidence_sha256)`.

## Contract design

| Method | Behavior |
| --- | --- |
| `submit(bundle, expected_sha256)` | Validates and locks exact evidence bytes, records submitting owner, returns deterministic case ID, appends the first receipt. Duplicate owner/evidence locks are rejected. |
| `review(case_id)` | Owner-only review. Deterministic exact matches bypass AI; remaining pairs use independent validator classification. At most 3 successful reviews, with retries allowed only after INCONCLUSIVE. |
| `get_case(case_id)` | Returns immutable evidence plus append-only receipts, or JSON `null`. |
| `list_cases(offset, limit)` | Bounded pagination (limit 1–20) over registered case IDs. |
| `get_info()` | Returns policy version, bounds and case count. |

Each non-exact pair is assigned PARAPHRASE, ANSWER_LEAKAGE, NO_OVERLAP or UNCERTAIN. Ordinary shared topics, common knowledge and short answer tokens alone are not enough to establish leakage. Validators independently run the same classification against locked evidence and compare the compact label vector. There is no validator that merely accepts well-formed leader output, no free-form quotation matching, and no global LLM response used as proof. The contract derives its aggregate verdict deterministically.

Receipts bind policy, case ID, evidence hash, sequence and previous hash. Review receipts add all pair IDs/categories and counts. A prior receipt is never rewritten. There is no admin verdict override, payout, oracle key, or hidden off-chain adjudicator.

## Development

Requires Node.js 22+ and Python 3.10+; contract SDK is content-pinned in its first line. The JS SDK and Vite are pinned in `package-lock.json`.

```sh
npm ci
npm run check
npm run dev
```

`npm run check` runs JavaScript integration/unit tests, adversarial Python contract tests, and a production build. Python tests explicitly stub the GenLayer boundary: they test deterministic rules and independent-validation behavior, **not real validator consensus**. Live consensus evidence is recorded separately in `evidence/`.

Use `npm run build` to create `dist/`. Vite serves the frontend and bundles the installed SDK; there is no application backend/database/API key to configure. The dashboard calls Studionet directly. `web/deployment.json` is the public source of truth for the deployed address and example IDs. Deploy static output on Vercel, Netlify or another static host. No signer or server-side secret is deployed.

### Offline receipt integrity

```sh
python scripts/verify_receipt.py exported-record.json
```

This verifies the evidence commitment, owner-bound case ID and linked receipt hashes. **It is not proof of network origin**: an attacker can fabricate a whole self-consistent file. Authenticate the export by reading the same case from the published contract address at finalized state and checking the deployment/source hash. The dashboard does this live read before showing the chain as verified.

## Reproducible live tests

The UI includes five **synthetic** fixtures: exact duplicate, paraphrase, answer leakage, unrelated text, and missing context. They do not make claims about any actual model or real dataset. Live transactions, observed findings and the deployed source SHA-256 are included in [evidence](evidence). Reproduce using the UI or Studio; wait for finalized successful execution and read state afterwards.

See [submission notes](docs/submission.md), [security notes](docs/security.md) and [validation report](docs/validation.md). MIT licensed.
