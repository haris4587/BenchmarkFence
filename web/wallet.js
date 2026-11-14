export async function connectProvider(provider, chain) {
  if (!provider?.request)
    throw Error(
      "No browser wallet found. Use the GenLayer Studio account option.",
    );
  const chainId = "0x" + chain.id.toString(16);
  if (
    String(await provider.request({ method: "eth_chainId" })).toLowerCase() !==
    chainId
  ) {
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId }],
      });
    } catch (e) {
      if (e.code !== 4902) throw e;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId,
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: chain.rpcUrls.default.http,
            blockExplorerUrls: ["https://explorer-studio.genlayer.com"],
          },
        ],
      });
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId }],
      });
    }
  }
  const addresses = await provider.request({ method: "eth_requestAccounts" });
  const address = addresses?.[0];
  if (!/^0x[0-9a-fA-F]{40}$/.test(address || ""))
    throw Error("Wallet did not provide a valid account.");
  if (
    String(await provider.request({ method: "eth_chainId" })).toLowerCase() !==
    chainId
  )
    throw Error("Switch the wallet to Studionet (61999).");
  return address;
}
