import express, { type Express } from "express";
import { z } from "zod";
import {
  amountString,
  claspError,
  delegationRequestSchema,
  isClaspError,
  operationRequestSchema,
  paymentDecisionSchema,
  revokeRequestSchema,
  sessionApprovalSchema,
} from "@clasp/protocol";
import { sealTo, openSealed, type BoxKeypair } from "@clasp/token";
import type { WalletCore } from "./wallet-core";

export function createApp(
  walletCore: WalletCore,
  opts: { mode?: "REAL" | "DEMO"; boxKeypair?: BoxKeypair; owners?: "open" | "allow-list" } = {},
): Express {
  const app = express();
  const mode = opts.mode ?? "DEMO";
  const boxKeypair = opts.boxKeypair;
  const owners = opts.owners ?? "open";

  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "content-type, x-clasp-origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      mode,
      sealing: Boolean(boxKeypair),
      owners,
      walletPubKey: walletCore.walletPublicKey,
    });
  });

  app.get("/box-key", (_req, res) => {
    if (!boxKeypair) {
      res.status(501).json({ error: "sealing_unavailable" });
      return;
    }
    res.status(200).json({ boxPublicKey: boxKeypair.publicKey });
  });

  app.post("/sealed", async (req, res) => {
    if (!boxKeypair) {
      res.status(501).json({ error: "sealing_unavailable" });
      return;
    }
    const envelope = (req.body as { envelope?: unknown }).envelope;
    if (typeof envelope !== "string") {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    let inner: { request?: unknown; origin?: unknown; replyPub?: unknown };
    try {
      inner = JSON.parse(openSealed(boxKeypair.privateKey, envelope));
    } catch {
      res.status(400).json({ error: "invalid_envelope" });
      return;
    }
    const parsed = operationRequestSchema.safeParse(inner.request);
    if (!parsed.success || typeof inner.origin !== "string" || typeof inner.replyPub !== "string") {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const result = await walletCore.evaluate(parsed.data, { origin: inner.origin });
    res.status(200).json({ envelope: sealTo(inner.replyPub, JSON.stringify(result)) });
  });

  app.post("/sessions", (req, res) => {
    const parsed = sessionApprovalSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
      return;
    }
    const result = walletCore.createSession(parsed.data);
    res.status(isClaspError(result) ? 200 : 201).json(result);
  });

  app.post("/invoices", async (req, res) => {
    const parsed = z.object({ amount: amountString, asset: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
      return;
    }
    res.status(201).json(await walletCore.createInvoice(parsed.data));
  });

  app.post("/operations", async (req, res) => {
    const parsed = operationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
      return;
    }
    const origin = req.get("x-clasp-origin") ?? req.get("origin") ?? "";
    res.status(200).json(await walletCore.evaluate(parsed.data, { origin }));
  });

  app.post("/delegations", (req, res) => {
    const parsed = delegationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
      return;
    }
    const origin = req.get("x-clasp-origin") ?? req.get("origin") ?? "";
    const result = walletCore.delegate(parsed.data, { origin });
    res.status(isClaspError(result) ? 200 : 201).json(result);
  });

  app.post("/sessions/:id/revoke", (req, res) => {
    const sessionId = req.params.id ?? "";
    const parsed = revokeRequestSchema.safeParse(req.body);
    if (!parsed.success || parsed.data.sessionId !== sessionId) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const result = walletCore.revoke(parsed.data);
    if (!result) {
      res.status(404).json(claspError("session_not_found", { sessionId }));
      return;
    }
    if (isClaspError(result)) {
      res.status(200).json(result);
      return;
    }
    res.status(200).json({ session: result });
  });

  app.get("/sessions/:id/holds", (req, res) => {
    const sessionId = req.params.id ?? "";
    const holds = walletCore.listHolds(sessionId);
    if (!holds) {
      res.status(404).json(claspError("session_not_found", { sessionId }));
      return;
    }
    res.status(200).json({ holds });
  });

  app.get("/holds/:requestId", (req, res) => {
    const hold = walletCore.getHold(req.params.requestId ?? "");
    if (!hold) {
      res.status(404).json({ error: "hold_not_found" });
      return;
    }
    res.status(200).json({ hold });
  });

  app.post("/holds/:requestId/decision", async (req, res) => {
    const requestId = req.params.requestId ?? "";
    const parsed = paymentDecisionSchema.safeParse(req.body);
    if (!parsed.success || parsed.data.requestId !== requestId) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    const result = await walletCore.decide(parsed.data);
    if (!result) {
      res.status(404).json({ error: "hold_not_found" });
      return;
    }
    res.status(200).json(isClaspError(result) ? result : { hold: result });
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

  app.get("/sessions/:id/statement", (req, res) => {
    const sessionId = req.params.id ?? "";
    const statement = walletCore.getStatement(sessionId);
    if (!statement) {
      res.status(404).json(claspError("session_not_found", { sessionId }));
      return;
    }
    res.status(200).json({ statement });
  });

  return app;
}
