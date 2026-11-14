# Verified results — November 14, 2026

## Automated checks

- **35 Python tests passed**: deterministic matching, exact-byte hashes, malformed evidence, Unicode/UTF-8 bounds, ownership, duplicate locks/IDs/JSON fields, independent validator disagreement, error-to-uncertainty handling, terminal outcomes, retry bounds and append-only receipts. These tests explicitly stub GenLayer; they do not claim live consensus.
- **44 JavaScript tests passed**: evidence hashing/schema, canonical cross-language receipt serialization, tamper detection, transaction lifecycle/error states, signed-call identity, and EIP-1193 wallet switching/addition/rejection/account validation.
- Production build passed. GitHub Actions runs the same checks on pushes and pull requests.
- The live deployment's decoded source bytes exactly match `contracts/benchmark_fence.py` (SHA-256 `fc72ab20b9eecdfb85a1e01cc2f347e8b558f28bc29da71fe55f2f8a0e753ff8`).

## Actual Studionet consensus

The deployment plus all five submissions and five reviews are **FINALIZED with successful execution**, using Studio built-in account `0x67Da51Fd9AC1d52F34F5d01d06da8548979fC514`. Every recorded write uses full consensus (`leader_only: false`), five initial validators and zero rotations.

| Fixture                    | Actual pair finding          | Aggregate verdict      |
| -------------------------- | ---------------------------- | ---------------------- |
| Exact copied question      | EXACT_DUPLICATE; no LLM call | CONTAMINATION_DETECTED |
| Reworded same question     | PARAPHRASE                   | CONTAMINATION_DETECTED |
| Fictional answer key       | ANSWER_LEAKAGE               | CONTAMINATION_DETECTED |
| Unrelated gardening sample | NO_OVERLAP                   | NO_OVERLAP_FOUND       |
| Missing page/context       | UNCERTAIN                    | INCONCLUSIVE           |

All fixtures are explicitly synthetic. No real model's training corpus has been audited. Full transaction receipts and exported finalized case records are in `evidence/`; `deployment.json` indexes the transactions and cases.

An initial Studio submission failed with an evidence-hash mismatch because Studio's single-line argument field stripped line breaks from formatted JSON. The rejected transaction is preserved in `receipt-rejected-formatting.json`. The corrected compact-byte submission succeeded. The final dashboard prepares compact JSON plus its matching hash for Studio, verifies the signed call's exact arguments, and does not label that rejected transaction successful.

## Browser verification

- Public production website opened successfully without sign-in.
- Dashboard selected the same Studio account, prepared the semantic submission/review, and accepted the resulting hashes only after verifying sender, contract, method and exact arguments. It then independently read finalized state and checked its evidence/receipt hashes.
- Production receipt lookup, deep-linked semantic case, evidence-pair display and download were verified. The actual downloaded JSON passed `scripts/verify_receipt.py`.
- The actual application was rendered inside **390px and 768px frames**; content viewports were 373px and 751px after borders/scrollbars. Neither had horizontal document overflow. Mobile dialog remained inside the viewport. Invalid JSON/schema and missing publication consent were correctly rejected in the browser. See `/qa/responsive.html` to reproduce the same real-app viewport checks.
- Real MetaMask extension signing was **not exercised**. Its provider adapter was tested with controlled EIP-1193 responses; all live signing used Studio as requested. The app does not create another signing account or ask for private keys.

The exported chain alone proves internal integrity, not network origin. Authenticate it by comparing finalized state at the published address and the verified source hash.
