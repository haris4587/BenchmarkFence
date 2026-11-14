import { abi, decodeInputData } from "genlayer-js";
import { canonical } from "./core.js";
// Verify the signed call itself before associating its success with a UI action.
export function verifyTransactionCall(tx, expected) {
  if (
    (tx.from_address ?? tx.from ?? tx.sender)?.toLowerCase() !==
      expected.owner.toLowerCase() ||
    (tx.to_address ?? tx.to ?? tx.recipient)?.toLowerCase() !==
      expected.contract.toLowerCase()
  )
    throw Error(
      "Transaction sender or contract does not match the prepared call.",
    );
  let call;
  if (Array.isArray(tx.data?.calldata?.raw))
    call = abi.calldata.decode(new Uint8Array(tx.data.calldata.raw));
  else {
    const encoded = tx.tx_data;
    if (typeof encoded !== "string")
      throw Error(
        "Transaction calldata is unavailable; cannot verify this call.",
      );
    call = decodeInputData(
      encoded.startsWith("0x") ? encoded : "0x" + encoded,
      expected.contract,
    )?.callData;
  }
  const field = (k) => (call instanceof Map ? call.get(k) : call?.[k]);
  if (
    field("method") !== expected.method ||
    canonical(field("args")) !== canonical(expected.args)
  )
    throw Error(
      "Transaction method or arguments do not match the prepared call.",
    );
  return true;
}
