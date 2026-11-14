import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  sha256,
  canonical,
  validateBundle,
  transactionState,
  verifyRecord,
  examples,
} from "../web/core.js";
import { connectProvider } from "../web/wallet.js";
for (const [name, data] of Object.entries(examples))
  test("valid example: " + name, () =>
    assert.equal(
      validateBundle(JSON.stringify(data)).version,
      "benchmarkfence/1",
    ),
  );
test("UTF-8 bytes are hashed exactly", async () =>
  assert.equal(
    await sha256("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  ));
test("JSON whitespace changes evidence hash", async () =>
  assert.notEqual(await sha256("{}"), await sha256("{ }")));
test("canonical JSON matches Python ensure_ascii", () =>
  assert.equal(
    canonical({ z: "été 😀\u007f", a: 1 }),
    '{"a":1,"z":"\\u00e9t\\u00e9 \\ud83d\\ude00\\u007f"}',
  ));
test("bounds reject oversize UTF8", () =>
  assert.throws(() => validateBundle("界".repeat(5000)), /14,000/));
test("reject unknown schema", () =>
  assert.throws(
    () => validateBundle(JSON.stringify({ ...examples.exact, extra: "x" })),
    /schema/,
  ));
test("reject duplicate item IDs", () =>
  assert.throws(
    () =>
      validateBundle(
        JSON.stringify({
          ...examples.exact,
          samples: [examples.exact.samples[0], examples.exact.samples[0]],
        }),
      ),
    /duplicate/,
  ));
test("question length bound", () => {
  const d = structuredClone(examples.exact);
  d.evaluations[0].question = "2+2";
  assert.throws(() => validateBundle(JSON.stringify(d)), /limits/);
});
for (const phase of [
  "PENDING",
  "PROPOSING",
  "COMMITTING",
  "REVEALING",
  "ACCEPTED",
])
  test(phase + " remains pending", () =>
    assert.equal(transactionState({ statusName: phase }).state, "pending"),
  );
for (const phase of ["CANCELED", "UNDETERMINED", "REJECTED"])
  test(phase + " does not become success", () =>
    assert.equal(transactionState({ statusName: phase }).state, "failed"),
  );
test("FINALIZED without execution is unverified", () =>
  assert.equal(
    transactionState({ statusName: "FINALIZED" }).state,
    "unverified",
  ));
test("FINALIZED execution error is failure", () =>
  assert.equal(
    transactionState({
      statusName: "FINALIZED",
      txExecutionResultName: "FINISHED_WITH_ERROR",
    }).state,
    "failed",
  ));
test("FINALIZED returned execution is success", () =>
  assert.equal(
    transactionState({
      statusName: "FINALIZED",
      txExecutionResultName: "FINISHED_WITH_RETURN",
    }).state,
    "success",
  ));
test("consensus disagreement is failure", () =>
  assert.equal(
    transactionState({
      statusName: "FINALIZED",
      resultName: "MAJORITY_DISAGREE",
      txExecutionResultName: "SUCCESS",
    }).state,
    "failed",
  ));
test("discard canceled leaders after quorum", () =>
  assert.equal(
    transactionState({
      status: "FINALIZED",
      consensus_data: {
        leader_receipt: [
          {
            execution_result: "ERROR",
            genvm_result: { error_code: "CONSENSUS_VALIDATOR_QUORUM_REACHED" },
          },
          { execution_result: "SUCCESS" },
        ],
      },
    }).state,
    "success",
  ));
test("conflicting executions remain unverified", () =>
  assert.equal(
    transactionState({
      status: "FINALIZED",
      consensus_data: {
        leader_receipt: [
          { execution_result: "ERROR" },
          { execution_result: "SUCCESS" },
        ],
      },
    }).state,
    "unverified",
  ));
test("select final leader receipt", () =>
  assert.equal(
    transactionState({
      status: "FINALIZED",
      last_leader: "0xabc",
      consensus_data: {
        leader_receipt: [
          { execution_result: "ERROR", node_config: { address: "0xdef" } },
          { execution_result: "SUCCESS", node_config: { address: "0xABC" } },
        ],
      },
    }).state,
    "success",
  ));
async function fakeRecord() {
  const raw = JSON.stringify(examples.exact);
  const evidence_sha256 = await sha256(raw);
  const owner = "0x" + "1".repeat(40);
  const id = await sha256(owner + "\n" + evidence_sha256);
  const body = {
    policy: "benchmarkfence/1",
    case_id: id,
    evidence_sha256,
    sequence: 0,
    event: "EVIDENCE_LOCKED",
    owner,
    previous_hash: "0".repeat(64),
  };
  return {
    id,
    owner,
    evidence_sha256,
    bundle: raw,
    attempts: 0,
    receipts: [{ body, hash: await sha256(canonical(body)) }],
  };
}
test("valid receipt chain", async () => {
  const r = await fakeRecord();
  assert.equal(await verifyRecord(r), r.receipts[0].hash);
});
test("edited evidence rejected", async () => {
  const r = await fakeRecord();
  r.bundle += " ";
  await assert.rejects(verifyRecord(r), /bytes/);
});
test("tampered receipt rejected", async () => {
  const r = await fakeRecord();
  r.receipts[0].body.event = "FORGED";
  await assert.rejects(verifyRecord(r), /integrity/);
});
test("rebound owner rejected", async () => {
  const r = await fakeRecord();
  r.owner = "0x" + "2".repeat(40);
  await assert.rejects(verifyRecord(r), /Case ID/);
});
test("truncated chain rejected", async () => {
  const r = await fakeRecord();
  r.attempts = 1;
  await assert.rejects(verifyRecord(r), /count/);
});
const chain = {
  id: 61999,
  name: "Studionet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: { default: { http: ["https://studio.genlayer.com/api"] } },
};
test("wallet switches and requests authorized account", async () => {
  const calls = [];
  let id = "0x1";
  const provider = {
    request: async ({ method, params }) => {
      calls.push(method);
      if (method === "eth_chainId") return id;
      if (method === "wallet_switchEthereumChain") {
        id = params[0].chainId;
        return null;
      }
      if (method === "eth_requestAccounts") return ["0x" + "1".repeat(40)];
    },
  };
  assert.match(await connectProvider(provider, chain), /^0x/);
  assert.deepEqual(calls, [
    "eth_chainId",
    "wallet_switchEthereumChain",
    "eth_requestAccounts",
    "eth_chainId",
  ]);
});
test("wallet adds missing chain", async () => {
  let added = false,
    id = "0x1";
  const provider = {
    request: async ({ method }) => {
      if (method === "eth_chainId") return id;
      if (method === "wallet_switchEthereumChain") {
        if (!added) throw { code: 4902 };
        id = "0xf22f";
      }
      if (method === "wallet_addEthereumChain") added = true;
      if (method === "eth_requestAccounts") return ["0x" + "1".repeat(40)];
    },
  };
  assert.ok(await connectProvider(provider, chain));
  assert.ok(added);
});
test("rejected signature does not silently fall back", async () => {
  const provider = {
    request: async () => {
      throw { code: 4001 };
    },
  };
  await assert.rejects(
    connectProvider(provider, chain),
    (e) => e.code === 4001,
  );
});
test("wrong network fails closed", async () => {
  const provider = {
    request: async ({ method }) =>
      method === "eth_chainId"
        ? "0x1"
        : method === "eth_requestAccounts"
          ? ["0x" + "1".repeat(40)]
          : null,
  };
  await assert.rejects(connectProvider(provider, chain), /Switch/);
});
test("missing wallet guidance", async () =>
  await assert.rejects(connectProvider(null, chain), /Studio/));
test("no signing object is exported to window", () => {
  const src = readFileSync(new URL("../web/main.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /window\.(signer|account|privateKey)\s*=/);
  assert.doesNotMatch(src, /localStorage\.setItem\([^\n]*(privateKey|signer)/);
});
