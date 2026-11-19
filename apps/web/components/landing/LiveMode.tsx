"use client";

import { useEffect, useState } from "react";
import { SERVER_URL } from "@/lib/serverUrl";

type Mode = "checking" | "REAL" | "DEMO" | "unavailable";

const LABEL: Record<Mode, string> = {
  checking: "Checking network…",
  REAL: "Live on Fiber testnet",
  DEMO: "Demo mode, no network payments",
  unavailable: "Status unavailable",
};

export function LiveMode() {
  const [mode, setMode] = useState<Mode>("checking");

  useEffect(() => {
    let alive = true;
    fetch(`${SERVER_URL}/health`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("health"))))
      .then((body: { mode?: string }) => {
        if (alive) setMode(body.mode === "REAL" ? "REAL" : "DEMO");
      })
      .catch(() => {
        if (alive) setMode("unavailable");
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <span className="sky-footer__status" data-mode={mode} role="status">
      <i aria-hidden="true" />
      {LABEL[mode]}
    </span>
  );
}
