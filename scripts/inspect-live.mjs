import { createClient, decodeInputData } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { transactionState, stringify } from "../web/core.js";
const address = "0xC6a6c2982F23229488D590A87148840469687E79";
const hash =
  "0x4c2570f26e229a962fd8da92541ab86f7b4dfd9df445ef67b283b8c4de4de87f";
const c = createClient({ chain: studionet });
const tx = await c.getTransaction({ hash });
writeFileSync("evidence/receipt-deploy.json", stringify(tx) + "\n");
const state = transactionState(tx);
console.log(
  "Deploy:",
  state,
  "sender",
  tx.from_address ?? tx.from ?? tx.sender,
);
console.log("Top fields:", Object.keys(tx));
if (state.state !== "success") throw Error("Deployment did not succeed");
console.log(
  "Info:",
  await c.readContract({
    address,
    functionName: "get_info",
    args: [],
    transactionHashVariant: "finalized",
  }),
);
const source_sha256 = createHash("sha256")
  .update(readFileSync("contracts/benchmark_fence.py"))
  .digest("hex");
const decoded = decodeInputData("0x" + tx.tx_data, tx.to_address);
if (createHash("sha256").update(decoded.code).digest("hex") !== source_sha256)
  throw Error("Deployed source differs from the local file");
const previous = existsSync("evidence/deployment.json")
  ? JSON.parse(readFileSync("evidence/deployment.json"))
  : {};
const report = {
  ...previous,
  network: "studionet",
  chain_id: 61999,
  address,
  source_sha256,
  deployment_tx: hash,
  deployment_status: state,
  studio_builtin_account: true,
  checked_at: new Date().toISOString(),
  studio_account: tx.from_address,
  onchain_source_verified: true,
  example_cases: previous.example_cases || {},
};
writeFileSync("evidence/deployment.json", stringify(report) + "\n");
// Preserve the minimal frontend manifest and its verified example index.
const web = JSON.parse(readFileSync("web/deployment.json"));
writeFileSync(
  "web/deployment.json",
  stringify({ ...web, address, source_sha256, deployment_tx: hash }) + "\n",
);
