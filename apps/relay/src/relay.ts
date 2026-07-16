import express, { type Express } from "express";

export interface RelayOptions {
  coreUrl: string;
  fetchImpl?: typeof fetch;
  transform?: (path: string, body: string) => string;
  rewriteHeaders?: (headers: Record<string, string>) => Record<string, string>;
}

const FORWARD_HEADERS = ["content-type", "x-clasp-origin", "origin", "accept"];

export function createRelay(options: RelayOptions): Express {
  const app = express();
  const coreUrl = options.coreUrl.replace(/\/$/, "");
  const doFetch: typeof fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));

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

  app.get("/__relay", (_req, res) => {
    res.status(200).json({ role: "relay", core: coreUrl, holdsKeys: false });
  });

  app.use(express.raw({ type: "*/*", limit: "1mb" }));

  app.use(async (req, res) => {
    const url = `${coreUrl}${req.originalUrl}`;
    let headers: Record<string, string> = {};
    for (const name of FORWARD_HEADERS) {
      const value = req.get(name);
      if (value) headers[name] = value;
    }
    if (options.rewriteHeaders) headers = options.rewriteHeaders(headers);

    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    let body: string | undefined;
    if (hasBody) {
      const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
      body = options.transform ? options.transform(req.path, raw) : raw;
    }

    try {
      const upstream = await doFetch(url, { method: req.method, headers, body: hasBody ? body : undefined });
      const text = await upstream.text();
      const contentType = upstream.headers.get("content-type");
      if (contentType) res.setHeader("content-type", contentType);
      res.status(upstream.status).send(text);
    } catch {
      res.status(502).json({
        code: "gateway_failure",
        message: "The relay could not reach the wallet core.",
        retryable: true,
        nextAction: "retry",
      });
    }
  });

  return app;
}
