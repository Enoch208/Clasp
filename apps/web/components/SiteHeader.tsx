import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "./icons";

export function SiteHeader() {
  return (
    <header className="of-header">
      <Link className="of-header-brand" href="/" aria-label="Clasp home">
        <Image
          className="clasp-header-logo"
          src="/clasp-3d.png"
          alt=""
          width={1254}
          height={1254}
          priority
        />
        <span className="of-header-brand-copy">
          <strong>CLASP</strong>
          <small>App-to-wallet session layer</small>
        </span>
      </Link>

      <div className="of-header-actions">
        <div className="of-header-status" aria-label="Network: Fiber testnet">
          <span>Network</span>
          <b>
            <i aria-hidden="true" /> Fiber testnet
          </b>
        </div>
        <Link className="of-header-history" href="/dashboard">
          Dashboard
        </Link>
        <Link className="of-header-launch" href="/demo">
          <span className="of-header-launch-icon" aria-hidden="true">
            <ArrowRight />
          </span>
          <span className="of-header-launch-label">Try the demo</span>
        </Link>
      </div>
    </header>
  );
}
