import express, { type Express } from "express";
import { z } from "zod";
import { amountString, claspError, grantablePermission, operationRequestSchema } from "@clasp/protocol";
import type { WalletCore } from "./wallet-core";

const createSessionBodySchema = z.object({
  origin: z.string().min(1),
  permissions: z.array(grantablePermission),
  asset: z.string().min(1),
  maxSinglePayment: amountString,
  maxSessionSpend: amountString,
  expiresAt: z.string().min(1),
  appPubKey: z.string().min(1),
});

export function createApp(walletCore: WalletCore): Express {
  const app = express();
  app.use(express.json());

  app.post("/sessions", (req, res) => {
    const parsed = createSessionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
      return;
    }
    res.status(201).json(walletCore.createSession(parsed.data));
  });

  app.post("/operations", async (req, res) => {
    const parsed = operationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
      return;
    }
    const origin = req.get("origin") ?? req.get("x-clasp-origin") ?? "";
    res.status(200).json(await walletCore.evaluate(parsed.data, { origin }));
  });

  app.post("/sessions/:id/revoke", (req, res) => {
    const sessionId = req.params.id ?? "";
    const session = walletCore.revoke(sessionId);
    if (!session) {
      res.status(404).json(claspError("session_not_found", { sessionId }));
      return;
    }
    res.status(200).json({ session });
  });

  app.get("/sessions/:id", (req, res) => {
    const sessionId = req.params.id ?? "";
    const session = walletCore.getSession(sessionId);
    if (!session) {
      res.status(404).json(claspError("session_not_found", { sessionId }));
      return;
    }
    res.status(200).json({ session });
  });

  return app;
}
