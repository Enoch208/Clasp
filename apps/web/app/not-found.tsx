import Link from "next/link";
import { SkyStandalone } from "@/components/landing/SkyStandalone";

export default function NotFound() {
  return (
    <SkyStandalone kicker="Error 404" title="No session here.">
      <p>That page isn’t part of any session, and nothing was granted authority to reach it.</p>
      <div className="sky-standalone__actions">
        <Link href="/" className="ui-btn ui-btn-primary">
          Back to Clasp
        </Link>
        <Link href="/demo" className="ui-btn ui-btn-ghost">
          Open the demo
        </Link>
      </div>
    </SkyStandalone>
  );
}
