"use client";

import Link from "next/link";
import { SkyStandalone } from "@/components/landing/SkyStandalone";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <SkyStandalone kicker="Something broke" title="The wallet stayed shut.">
      <p>An unexpected error interrupted this page. Nothing was signed, spent or granted. Clasp fails closed.</p>
      <div className="sky-standalone__actions">
        <button type="button" className="ui-btn ui-btn-primary" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/" className="ui-btn ui-btn-ghost">
          Back to Clasp
        </Link>
      </div>
    </SkyStandalone>
  );
}
