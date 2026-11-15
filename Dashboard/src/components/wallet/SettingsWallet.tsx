import { useWallet } from "@solana/wallet-adapter-react";
import { IconChevronDown, IconWallet } from "@tabler/icons-react";
import { useState } from "react";
import { short } from "./shared";
import { WalletCard, WalletShell } from "./WalletShell";

function WalletRow() {
  const { connected, connecting, publicKey, wallet } = useWallet();
  const [open, setOpen] = useState(false);
  const addr = connected && publicKey ? publicKey.toBase58() : null;
  const label = connecting ? "connecting…" : addr ? short(addr) : "not connected";
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 py-3 text-left text-sm"
        aria-expanded={open}
      >
        <IconWallet size={18} className="text-muted" />
        <span className="min-w-0 flex-1 truncate">
          Wallet · {label}
          {addr && wallet?.adapter.name ? <span className="text-muted"> · {wallet.adapter.name}</span> : null}
        </span>
        <IconChevronDown size={16} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="pb-3">
          <WalletCard />
        </div>
      )}
    </div>
  );
}

/** Lazy-loaded from Settings so the wallet bundle stays out of the main chunk. */
export default function SettingsWallet() {
  return (
    <WalletShell>
      <WalletRow />
    </WalletShell>
  );
}
