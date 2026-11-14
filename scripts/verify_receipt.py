"""Offline integrity verification. Does not authenticate network origin.
Usage: python scripts/verify_receipt.py exported-record.json
"""
import hashlib
import json
import sys


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def digest(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def verify(envelope):
    assert envelope["format"] == "benchmarkfence/1" and envelope["chain_id"] == 61999, "Wrong format or chain"
    record = envelope["record"]
    assert digest(record["bundle"]) == record["evidence_sha256"], "Evidence hash mismatch"
    assert digest(record["owner"].lower() + "\n" + record["evidence_sha256"]) == record["id"], "Case ID mismatch"
    previous = "0" * 64
    assert record["receipts"], "Missing receipt chain"
    for i, entry in enumerate(record["receipts"]):
        body = entry["body"]
        assert body["policy"] == envelope["format"] and body["case_id"] == record["id"] and body["evidence_sha256"] == record["evidence_sha256"], "Receipt binding mismatch"
        assert body["sequence"] == i and body["previous_hash"] == previous, "Broken receipt sequence"
        assert digest(canonical(body)) == entry["hash"], "Receipt hash mismatch"
        previous = entry["hash"]
    assert len(record["receipts"]) == record["attempts"] + 1, "Attempt count mismatch"
    return previous


if __name__ == "__main__":
    try:
        value = json.load(open(sys.argv[1], encoding="utf-8"))
        print("Integrity verified:", verify(value))
        print("Authenticate separately against finalized contract state and the published contract source hash.")
    except Exception as exc:
        print("VERIFICATION FAILED:", exc, file=sys.stderr)
        sys.exit(1)
