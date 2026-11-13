import { WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { useStandardWalletAdapters } from "@solana/wallet-standard-wallet-adapter-react";
import { registerMwa } from "@solana-mobile/wallet-standard-mobile";
import { IconPlugConnected } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { WALLET } from "../../lib/config";
import { short } from "./shared";

registerMwa({
  appIdentity: { name: "FiMs Dashboard", uri: "https://dashboard.fims.fi", icon: "/icons/icon-192.png" },
  chains: ["solana:mainnet"],
});

export function WalletCard() {
  const { wallets, wallet, publicKey, connected, connecting, select, connect, disconnect } = useWallet();
  const wrongWallet = connected && publicKey && publicKey.toBase58() !== WALLET;
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          {connected && publicKey ? (
            <>
              <div className="truncate text-sm font-semibold">{short(publicKey.toBase58())}</div>
              <div className="text-[11px] text-muted">{wallet?.adapter.name}</div>
            </>
          ) : (
            <div className="text-sm text-muted">Not connected</div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {connected ? (
            <button
              onClick={() => void disconnect()}
              className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-card2"
            >
              Disconnect
            </button>
          ) : null}
        </div>
      </div>
      {wrongWallet && <p className="mt-2 text-xs font-semibold text-danger">Wrong wallet — connect {short(WALLET)}</p>}
      {!connected && wallets.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-1.5">
          {wallets.map(w => (
            <button
              key={w.adapter.name}
              disabled={connecting}
              onClick={async () => {
                select(w.adapter.name);
                try {
                  await connect();
                } catch {
                  /* user cancelled */
                }
              }}
              className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm hover:bg-card2 disabled:opacity-50"
            >
              <IconPlugConnected size={16} className="shrink-0 text-accent" />
              <span className="truncate">{w.adapter.name}</span>
            </button>
          ))}
        </div>
      )}
      {!connected && wallets.length === 0 && <p className="mt-2 text-xs text-muted">No Solana wallet detected.</p>}
    </div>
  );
}

export function WalletShell({ children }: { children: ReactNode }) {
  const adapters = useStandardWalletAdapters([]);
  return (
    <WalletProvider wallets={adapters} autoConnect>
      {children}
    </WalletProvider>
  );
}
