"use client";

import { AppShell, SurfaceHead } from "@/components/AppShell";
import { ClaspProvider, type ClaspClientConfig } from "@clasp/react";
import { SdkSurface } from "./SdkSurface";

const SERVER_URL = process.env.NEXT_PUBLIC_CLASP_SERVER_URL ?? "http://localhost:8787";

const config: ClaspClientConfig = {
  serverUrl: SERVER_URL,
  origin: "https://acme.example",
  app: { name: "Acme Checkout" },
  permissions: ["payments:request"],
  asset: "CKB",
  maxSinglePayment: "100000000",
  maxSessionSpend: "300000000",
  sealed: true,
};

export default function SdkPage() {
  return (
    <AppShell>
      <SurfaceHead
        kicker="SDK · @clasp/react"
        title="Add a Fiber wallet in a few lines."
        sub="A different app — Acme Checkout — integrates Clasp with a provider, a button, and one hook. Everything on this page is driven by @clasp/react talking to the same policy engine."
      />
      <ClaspProvider config={config}>
        <SdkSurface serverUrl={SERVER_URL} />
      </ClaspProvider>
    </AppShell>
  );
}
