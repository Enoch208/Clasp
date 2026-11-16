"use client";

import { AppShell, SurfaceHead } from "@/components/AppShell";
import { ClaspProvider, type ClaspClientConfig } from "@useclasp/react";
import { SdkSurface } from "./SdkSurface";
import { SERVER_URL } from "@/lib/serverUrl";
import { ownerWallet } from "@/lib/ownerWallet";

const config: ClaspClientConfig = {
  serverUrl: SERVER_URL,
  origin: "https://acme.example",
  app: { name: "Acme Checkout" },
  permissions: ["payments:request"],
  asset: "CKB",
  maxSinglePayment: "100000000",
  maxSessionSpend: "300000000",
  approve: (request) => ownerWallet().approve(request),
  sealed: true,
};

export default function SdkPage() {
  return (
    <AppShell>
      <SurfaceHead
        kicker="SDK · @useclasp/react"
        title="Add a Fiber wallet in a few lines."
        sub="A different app — Acme Checkout — integrates Clasp with a provider, a button, and one hook. Everything on this page is driven by @useclasp/react talking to the same policy engine."
      />
      <ClaspProvider config={config}>
        <SdkSurface serverUrl={SERVER_URL} />
      </ClaspProvider>
    </AppShell>
  );
}
