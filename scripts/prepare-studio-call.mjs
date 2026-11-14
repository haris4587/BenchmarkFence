// No key, wallet or network request. Outputs a call for Studio's built-in signer.
import { readFileSync } from "node:fs";
import { validateBundle, sha256, stringify } from "../web/core.js";
const [method, input, owner] = process.argv.slice(2);
if (
  !["submit", "review"].includes(method) ||
  !input ||
  !/^0x[0-9a-fA-F]{40}$/.test(owner || "")
)
  throw Error(
    "Usage: node scripts/prepare-studio-call.mjs submit bundle.json STUDIO_ADDRESS | review CASE_ID STUDIO_ADDRESS",
  );
const deployment = JSON.parse(
  readFileSync(new URL("../web/deployment.json", import.meta.url), "utf8"),
);
let args, case_id;
if (method === "submit") {
  const raw = JSON.stringify(validateBundle(readFileSync(input, "utf8")));
  const hash = await sha256(raw);
  args = [raw, hash];
  case_id = await sha256(owner.toLowerCase() + "\n" + hash);
} else {
  if (!/^[0-9a-f]{64}$/.test(input))
    throw Error("Case ID must be 64 lowercase hex characters.");
  args = [input];
  case_id = input;
}
console.log(
  stringify({
    contract: deployment.address,
    chain_id: 61999,
    account: owner,
    method,
    args,
    case_id,
    studio_url: deployment.studio_url,
  }),
);
