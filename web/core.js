export const POLICY = "benchmarkfence/1";
export const EXPLORER = "https://explorer-studio.genlayer.com";
export const stringify = (v) =>
  JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x), 2);
export const shorten = (v) => (v ? v.slice(0, 8) + "…" + v.slice(-6) : "—");
export async function sha256(text) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(bytes), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
}
export function canonical(v) {
  const sorted = (x) =>
    Array.isArray(x)
      ? x.map(sorted)
      : x && typeof x === "object"
        ? Object.fromEntries(
            Object.keys(x)
              .sort()
              .map((k) => [k, sorted(x[k])]),
          )
        : x;
  return JSON.stringify(sorted(v)).replace(
    /[\u007f-\uffff]/g,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}
const exactKeys = (v, keys) =>
  v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.keys(v).sort().join(",") === keys.sort().join(",");
const text = (v, min, max) =>
  typeof v === "string" &&
  Array.from(v.trim()).length >= min &&
  Array.from(v).length <= max;
export function validateBundle(raw) {
  if (typeof raw !== "string" || new TextEncoder().encode(raw).length > 14000)
    throw Error("Use at most 14,000 UTF-8 bytes.");
  const d = JSON.parse(raw);
  if (
    !exactKeys(d, [
      "version",
      "dataset",
      "benchmark",
      "source_claim",
      "samples",
      "evaluations",
    ]) ||
    d.version !== POLICY
  )
    throw Error("Use the documented benchmarkfence/1 bundle schema.");
  if (
    !text(d.dataset, 1, 120) ||
    !text(d.benchmark, 1, 120) ||
    !text(d.source_claim, 1, 400)
  )
    throw Error("Add dataset, benchmark and disclosure reference.");
  for (const [key, max] of [
    ["samples", 6],
    ["evaluations", 3],
  ]) {
    if (!Array.isArray(d[key]) || d[key].length < 1 || d[key].length > max)
      throw Error(`Use 1–${max} ${key}.`);
    const seen = new Set();
    for (const r of d[key]) {
      if (
        !exactKeys(
          r,
          key === "samples" ? ["id", "text"] : ["id", "question", "answer"],
        ) ||
        typeof r.id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,40}$/.test(r.id) ||
        seen.has(r.id)
      )
        throw Error("Invalid or duplicate item ID/fields.");
      seen.add(r.id);
      if (
        key === "samples"
          ? !text(r.text, 1, 1600)
          : !text(r.question, 12, 600) || !text(r.answer, 1, 240)
      )
        throw Error("Item text exceeds the documented limits.");
    }
  }
  return d;
}
export function transactionState(tx) {
  const phase = String(tx.statusName ?? tx.status ?? "UNKNOWN").toUpperCase();
  if (
    ["CANCELED", "CANCELLED", "UNDETERMINED", "REJECTED", "FAILED"].includes(
      phase,
    )
  )
    return { phase, state: "failed", execution: "Consensus did not complete" };
  if (phase !== "FINALIZED") return { phase, state: "pending", execution: "" };
  const result = tx.resultName ?? tx.result_name;
  if (["MAJORITY_DISAGREE", "NO_MAJORITY", "FAILURE"].includes(result))
    return { phase, state: "failed", execution: result };
  const receipts = tx.consensus_data?.leader_receipt;
  let candidates = (Array.isArray(receipts) ? receipts : [receipts]).filter(
    (r) =>
      r &&
      r.mode !== "validator" &&
      r.genvm_result?.error_code !== "CONSENSUS_VALIDATOR_QUORUM_REACHED" &&
      !/cancelled after quorum/i.test(r.genvm_result?.stderr || ""),
  );
  const leader = tx.lastLeader ?? tx.last_leader;
  if (leader) {
    const matching = candidates.filter(
      (r) =>
        r.node_config?.address?.toLowerCase() === String(leader).toLowerCase(),
    );
    if (matching.length) candidates = matching;
  }
  const outputs = candidates.map((r) => r.execution_result ?? r.result?.status);
  const execution =
    tx.txExecutionResultName ??
    (outputs.length && outputs.every((v) => v === outputs[0])
      ? outputs[0]
      : undefined);
  if (["FINISHED_WITH_RETURN", "SUCCESS", "return"].includes(execution))
    return { phase, state: "success", execution };
  if (["FINISHED_WITH_ERROR", "ERROR", "error"].includes(execution))
    return { phase, state: "failed", execution };
  return {
    phase,
    state: "unverified",
    execution: "Execution result unavailable; inspect explorer",
  };
}
export async function verifyRecord(record) {
  if (
    !record ||
    typeof record.bundle !== "string" ||
    !Array.isArray(record.receipts) ||
    !record.receipts.length
  )
    throw Error("Missing audit record.");
  validateBundle(record.bundle);
  if ((await sha256(record.bundle)) !== record.evidence_sha256)
    throw Error("Evidence bytes do not match their hash.");
  if (
    (await sha256(
      record.owner.toLowerCase() + "\n" + record.evidence_sha256,
    )) !== record.id
  )
    throw Error("Case ID does not bind owner and evidence.");
  let previous = "0".repeat(64);
  for (let i = 0; i < record.receipts.length; i++) {
    const r = record.receipts[i];
    if (
      r.body?.sequence !== i ||
      r.body?.previous_hash !== previous ||
      r.body?.case_id !== record.id ||
      r.body?.evidence_sha256 !== record.evidence_sha256 ||
      r.body?.policy !== POLICY ||
      (await sha256(canonical(r.body))) !== r.hash
    )
      throw Error("Receipt chain integrity failed.");
    previous = r.hash;
  }
  if (record.attempts !== record.receipts.length - 1)
    throw Error("Receipt count mismatch.");
  return previous;
}
export const examples = {
  exact: {
    version: POLICY,
    dataset: "Synthetic disclosed training excerpt",
    benchmark: "Fence arithmetic mini-benchmark",
    source_claim:
      "Synthetic reproducible fixture; no claim about any real model or training dataset.",
    samples: [
      {
        id: "train-001",
        text: "Practice worksheet: A box contains 12 red marbles and 7 blue marbles. How many marbles are in the box? Answer: 19.",
      },
    ],
    evaluations: [
      {
        id: "eval-001",
        question:
          "A box contains 12 red marbles and 7 blue marbles. How many marbles are in the box?",
        answer: "19",
      },
    ],
  },
  semantic: {
    version: POLICY,
    dataset: "Synthetic paraphrased worksheet",
    benchmark: "Fence arithmetic mini-benchmark",
    source_claim: "Synthetic paraphrase fixture for live validator review.",
    samples: [
      {
        id: "train-para",
        text: "Inside a box are seven blue marbles together with twelve red ones. Work out the total number of marbles. The solution is nineteen.",
      },
    ],
    evaluations: [
      {
        id: "eval-001",
        question:
          "A box contains 12 red marbles and 7 blue marbles. How many marbles are in the box?",
        answer: "19",
      },
    ],
  },
  leakage: {
    version: POLICY,
    dataset: "Synthetic answer key disclosure",
    benchmark: "Fence fictional code mini-benchmark",
    source_claim: "Synthetic fictional answer key; no external facts required.",
    samples: [
      {
        id: "train-key",
        text: "Released answer key for the fictional Fence evaluation item FC-204: the vault access phrase is SILVER-PINE-729. Use this exact phrase for FC-204.",
      },
    ],
    evaluations: [
      {
        id: "FC-204",
        question:
          "In the fictional Fence evaluation item FC-204, what is the vault access phrase?",
        answer: "SILVER-PINE-729",
      },
    ],
  },
  unrelated: {
    version: POLICY,
    dataset: "Synthetic unrelated training text",
    benchmark: "Fence arithmetic mini-benchmark",
    source_claim: "Synthetic unrelated fixture. Limited to the submitted pair.",
    samples: [
      {
        id: "train-other",
        text: "A gardener plants lavender beside a stone path and waters the flowers before sunrise.",
      },
    ],
    evaluations: [
      {
        id: "eval-001",
        question:
          "A box contains 12 red marbles and 7 blue marbles. How many marbles are in the box?",
        answer: "19",
      },
    ],
  },
  uncertain: {
    version: POLICY,
    dataset: "Synthetic incomplete excerpt",
    benchmark: "Fence reference mini-benchmark",
    source_claim:
      "Synthetic ambiguity fixture; intentionally omits the referenced document.",
    samples: [
      {
        id: "train-gap",
        text: "The answer to the question on the missing previous page is the value marked in the red circle. That page and the circle are not included in this excerpt.",
      },
    ],
    evaluations: [
      {
        id: "eval-gap",
        question:
          "What answer is marked in the red circle on the missing previous page?",
        answer: "42",
      },
    ],
  },
};
