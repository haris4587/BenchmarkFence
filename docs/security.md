# Security and trust boundaries

The GenLayer contract, not the frontend, enforces input bounds, hashes, ownership, duplicate prevention and retry rules. All submitted evidence is immutable and public. There is no custody or real-money transfer.

Untrusted text is serialized as data inside the semantic prompt. Dataset names, provenance claims and user-controlled metadata are not fed into the classifier. The classifier only receives sample text, questions, answers and ordered pair IDs. Prompt injection remains a model-risk boundary, not a solved security guarantee; explicit instructions in data are grounds for uncertainty. Compact validated labels remove free-text/quotation serialization instability. Each validator must independently reach the same label vector; formatting alone is never enough.

Model failures and malformed outputs map to UNCERTAIN within the classifier; validators still independently execute. Network-level disagreement or execution failure cannot be converted by the UI into a successful receipt. Bounded retries prevent unrestricted review loops. A terminal positive/no-overlap finding cannot be overwritten. An INCONCLUSIVE attempt can be followed by another review of the **same** evidence, at most three attempts total; old receipts remain.

The app inserts evidence with textContent, not user-controlled HTML. Links to explorer and source are fixed-origin. Browser wallet account/network changes disconnect the signer and require reconnection. Browser extension wallet signatures remain in the extension. In Studio mode the app prepares calls, verifies the resulting transaction's sender/recipient/method/arguments, then checks finalized state. Studio alone holds and uses its built-in key. The app cannot access Studio's origin-isolated signer and does not request private keys.

Local receipt hash verification detects accidental/partial tampering. It is not a signature or source-authentication proof. Always compare against finalized state at the recorded deployed address and verified contract source. A public development network may reset; preserve exports and transaction evidence, while recognizing that exports alone do not authenticate their origin.

For larger corpora, a future version could commit Merkle roots and review retrieval-selected batches, but sampling/retrieval completeness would need separate evidence. Those features are not implemented or claimed in v1.
