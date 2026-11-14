import test from "node:test";
import assert from "node:assert/strict";
import { abi } from "genlayer-js";
import { verifyTransactionCall } from "../web/transaction.js";
const owner = "0x" + "1".repeat(40),
  contract = "0x" + "2".repeat(40),
  args = ["case"];
function tx() {
  return {
    from_address: owner,
    to_address: contract,
    data: {
      calldata: {
        raw: Array.from(
          abi.calldata.encode(
            new Map([
              ["method", "review"],
              ["args", args],
            ]),
          ),
        ),
      },
    },
  };
}
const expected = { owner, contract, method: "review", args };
test("verify signed Studio call sender, destination and args", () =>
  assert.equal(verifyTransactionCall(tx(), expected), true));
test("reject wrong sender", () => {
  const t = tx();
  t.from_address = "0x" + "3".repeat(40);
  assert.throws(() => verifyTransactionCall(t, expected), /sender/);
});
test("reject wrong contract", () => {
  const t = tx();
  t.to_address = "0x" + "3".repeat(40);
  assert.throws(() => verifyTransactionCall(t, expected), /contract/);
});
test("reject wrong method", () =>
  assert.throws(
    () => verifyTransactionCall(tx(), { ...expected, method: "submit" }),
    /method/,
  ));
test("reject wrong case argument", () =>
  assert.throws(
    () => verifyTransactionCall(tx(), { ...expected, args: ["other"] }),
    /arguments/,
  ));
test("missing calldata remains unverified", () => {
  const t = tx();
  delete t.data;
  assert.throws(() => verifyTransactionCall(t, expected), /unavailable/);
});
