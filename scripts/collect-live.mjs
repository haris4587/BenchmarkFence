// Read-only evidence collector. Each hash is an observed Studio transaction.
import { createClient, decodeInputData } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { transactionState, stringify, verifyRecord } from "../web/core.js";
import { verifyTransactionCall } from "../web/transaction.js";
const report = JSON.parse(readFileSync("evidence/deployment.json"));
const client = createClient({ chain: studionet });
const hashes = {
  "studio-submit-exact":
    "0x09c6d7e269d12c642aa6570c5ee907abb6fc93eea49e2081834eb741fdde0885",
  "studio-review-exact":
    "0x4b9b906d496422c47e73bb0fa38ce4736a007beddd6c9d25003078e09db6b3f0",
  "studio-submit-semantic":
    "0x51c26868203f4c64444314ba361110fdf827b199e1951eec2004680e5cb19fe9",
  "studio-review-semantic":
    "0xe70b1ea5cc7b9397bd7cb01acb2792bc5909c0c84df99bd01ec9aa209fe8c084",
  "studio-submit-leakage":
    "0x95e25bad1089543ea4a44087b34ba3317e032c1f4eafc6b1d91978ad54d3ddcd",
  "studio-review-leakage":
    "0x7e92c38f186a805140a1660f402ce208915a92e3c29e7557fb6262f4058378ed",
  "studio-submit-unrelated":
    "0x0cfe46c81170fa487d9ee59e5f68460dc306246538a2ed2da8d267ae8802cd1d",
  "studio-review-unrelated":
    "0xa99035ac01626777b36ec74c7493e3dbd9f9d982c04c9e7fbd905453941a2839",
  "studio-submit-uncertain":
    "0x5a74df350928cd38b166fa56220946ad5bdd24034a9ac63ded387dd814a09c9b",
  "studio-review-uncertain":
    "0x2f9433eb7b2b2dd8f31e421d2c8d51fbeb17c803bb7db631c8194eebb5bc3642",
};
report.transactions = report.transactions || {};
for (const [name, hash] of Object.entries(hashes)) {
  const tx = await client.getTransaction({ hash });
  const state = transactionState(tx);
  writeFileSync(`evidence/receipt-${name}.json`, stringify(tx) + "\n");
  const raw = tx.data.calldata.raw;
  const data = (await import("genlayer-js")).abi.calldata.decode(
    new Uint8Array(raw),
  );
  report.transactions[name] = {
    hash,
    ...state,
    from: tx.from_address,
    to: tx.to_address,
    method: data.get("method"),
    leader_only: tx.leader_only,
    initial_validators: tx.num_of_initial_validators,
    rotations: tx.rotation_count,
  };
  console.log(name, state);
  if (state.state !== "success") throw Error("Live transaction not successful");
  verifyTransactionCall(tx, {
    owner: report.studio_account,
    contract: report.address,
    method: data.get("method"),
    args: data.get("args"),
  });
}
const ids = JSON.parse(
  await client.readContract({
    address: report.address,
    functionName: "list_cases",
    args: [0, 20],
    transactionHashVariant: "finalized",
  }),
);
for (const id of ids.ids) {
  const record = JSON.parse(
    await client.readContract({
      address: report.address,
      functionName: "get_case",
      args: [id],
      transactionHashVariant: "finalized",
    }),
  );
  await verifyRecord(record);
  const d = JSON.parse(record.bundle);
  const kind = d.dataset.includes("paraphrased")
    ? "semantic"
    : d.dataset.includes("answer key")
      ? "leakage"
      : d.dataset.includes("unrelated")
        ? "unrelated"
        : d.dataset.includes("incomplete")
          ? "uncertain"
          : "exact";
  if (record.attempts) {
    report.example_cases[kind] = id;
  }
  writeFileSync(
    `evidence/export-${kind}.json`,
    stringify({
      format: "benchmarkfence/1",
      chain_id: 61999,
      contract: report.address,
      contract_source_sha256: report.source_sha256,
      record,
    }) + "\n",
  );
  console.log(kind, id, record.attempts, record.receipts.at(-1).body.verdict);
}
const deploy = JSON.parse(readFileSync("evidence/receipt-deploy.json"));
const decoded = decodeInputData("0x" + deploy.tx_data, deploy.to_address);
const code = decoded.code;
const sourceHash = createHash("sha256").update(code).digest("hex");
if (sourceHash !== report.source_sha256)
  throw Error("Deployed code does not match source");
report.onchain_source_verified = true;
// The deployed code bytes are checked separately below as SDK fields vary by release.
report.checked_at = new Date().toISOString();
writeFileSync("evidence/deployment.json", stringify(report) + "\n");
if (process.argv.includes("--publish-manifest"))
  writeFileSync("web/deployment.json", stringify(report) + "\n");
