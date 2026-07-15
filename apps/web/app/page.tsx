"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useId, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { HoverGridBackground } from "@/components/HoverGridBackground";
import { LandingActionButton } from "@/components/LandingActionButton";
import {
  ArrowRight,
  ArrowUpRight,
  Ban,
  ChevronDown,
  ExternalLink,
  Power,
  ScanEye,
  ShieldCheck,
} from "@/components/icons";

const pairsWith = ["AI agents", "dApps", "Bots", "Local agents"];

const steps = [
  ["01", "Pair", "An app requests scoped authority with a short pairing code — no RPC URL, no credential."],
  ["02", "Review & reduce", "You see every permission in plain language and cut the spend caps and duration before approving."],
  ["03", "Approve", "The wallet signs a scoped session token carrying your reduced values — not the app's request."],
  ["04", "Pay", "A real Fiber testnet payment settles, checked against ten policy steps and the session budget."],
] as const;

const surfaces = [
  ["01", "Permission review", "Every operation translated into a plain-language consequence, with editable caps and duration.", "yellow"],
  ["02", "10-step policy engine", "Session, signature, permission, origin, nonce, freshness, amount, asset, and atomic spend — checked in order.", "mint"],
  ["03", "Real Fiber payments", "Settled through an allow-listed gateway: new_invoice, get_invoice, send_payment, get_payment — nothing else.", "orange"],
  ["04", "Session dashboard", "Live spend meters, activity log, and expiry across every active session.", "blue"],
  ["05", "Instant revocation", "One tap moves the session to REVOKED — every later request fails, including innocent reads.", "lavender"],
  ["06", "TypeScript SDK", "connect() plus requestPayment() is the whole integration. Pair a new app in five minutes.", "violet"],
] as const;

const attacks = [
  ["permission_denied", "Requests channels:open, never granted."],
  ["session_spending_limit_exceeded", "Asks for 10 CKB with 1 CKB left."],
  ["replay_detected", "Replays a settled request — payment count stays 1."],
  ["origin_mismatch", "A copied token presented from evil.example."],
] as const;

const faqs = [
  ["What stops a stolen token?", "Origin binding, per-session nonces, signed operation requests, short expiry, and instant revocation — each demonstrated live in the security lab."],
  ["Can the app escalate privileges?", "There is no path. High-risk permissions aren't grantable in this build, raw-rpc / key-export / admin have no handler, and the signed session carries the user's reduced values — the app can never widen them."],
  ["What stops double-spending the budget?", "Atomic spend reservation inside a DB transaction with uniqueness constraints. A concurrency test proves two simultaneous requests cannot jointly exceed the cap."],
  ["What's real?", "Real Fiber testnet invoices and payments through the gateway, real policy enforcement, real revocation. The relay is a module boundary in this build, disclosed in REAL_VS_MOCKED.md and the UI banners."],
] as const;

export default function Home() {
  const heroArtRef = useRef<HTMLDivElement | null>(null);
  const securityRef = useRef<HTMLElement | null>(null);
  const router = useRouter();

  return (
    <main className="overflow-theme intro-done">
      <SiteHeader />

      <section className="of-hero-flow of-grid-paper">
        <div className="of-hero-flow-copy">
          <section id="overview" className="of-hero-copy">
            <p className="of-kicker">
              <span>Fiber Network</span> Category 1 — Wallet &amp; Payment UX Infrastructure
            </p>
            <h1>Clasp</h1>
            <h2>Connect apps to Fiber wallets. Never hand over the keys.</h2>
            <p className="of-hero-text">
              Clasp is the secure application-to-wallet session layer for Fiber: a pairing protocol, wallet
              policy engine, allow-listed gateway, and TypeScript SDK that let any app or AI agent connect with
              limited, user-edited, time-boxed, revocable authority — instead of permanent RPC credentials or
              private keys.
            </p>
            <div className="of-hero-actions">
              <LandingActionButton tone="dark" onClick={() => router.push("/demo")}>
                Try the demo
              </LandingActionButton>
              <LandingActionButton tone="yellow" onClick={() => router.push("/wallet")}>
                See the wallet
              </LandingActionButton>
            </div>
            <div className="of-safety-notes">
              <p className="of-safety-line">
                <ShieldCheck size={17} strokeWidth={2.25} /> Real Fiber testnet. Enforcement proven live.
              </p>
              <p>No private keys. No permanent credentials. No unlimited access.</p>
            </div>
          </section>

          <section id="install" className="of-compatible-copy-panel">
            <div className="of-section-top dark">
              <span>The whole integration</span>
              <span>&lt;sdk&gt; connect() then requestPayment() &lt;/sdk&gt;</span>
            </div>
            <div className="of-compatible-copy">
              <h2>Two calls. Any app becomes a Fiber-paying client.</h2>
              <p>
                A stranger can pair a new app against the hosted wallet in five minutes. The app requests
                authority; the wallet has final control and can only ever hand back less than was asked.
              </p>
              <div className="of-compatible-inline-list">
                {pairsWith.map((name) => (
                  <span key={name}>{name}</span>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside className="of-hero-rail" aria-label="Clasp session">
          <div ref={heroArtRef} className="of-asset-stage" aria-label="Permissioned session">
            <HoverGridBackground
              className="of-hover-grid-bg"
              gridClassName="of-hover-grid"
              squareSize={48}
              targetRef={heroArtRef}
            />
            <p className="clasp-wordmark">
              Clasp
              <small>never hand over the keys</small>
            </p>
          </div>
        </aside>
      </section>

      <section id="flow" className="of-flow of-grid-paper">
        <div className="of-section-top">
          <span>How it works</span>
          <span>&lt;flow&gt; pair / review / approve / pay &lt;/flow&gt;</span>
        </div>
        <div className="of-section-heading">
          <h2>From pairing code to a real, rule-checked payment.</h2>
          <p>The app requests authority, you reduce it, the wallet signs it, and every payment is enforced.</p>
        </div>
        <div className="of-flow-grid">
          {steps.map(([number, title, body], index) => (
            <article className={`of-step step-${index}`} key={title}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{body}</p>
              <ArrowRight aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>

      <section className="of-features">
        <div className="of-section-top dark">
          <span>Product surfaces</span>
          <span>&lt;authority&gt; visible, editable, revocable &lt;/authority&gt;</span>
        </div>
        <div className="of-section-heading">
          <h2>Everything to see and control authority before it is used.</h2>
        </div>
        <div className="of-feature-grid">
          {surfaces.map(([number, title, body, tone], index) => (
            <article className={`of-feature feature-${index} tone-${tone}`} key={title}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{body}</p>
              <ArrowUpRight aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>

      <section ref={securityRef} id="security" className="of-demo of-grid-paper">
        <HoverGridBackground
          className="of-hover-grid-bg of-demo-hover-grid-bg"
          gridClassName="of-hover-grid of-demo-hover-grid"
          squareSize={48}
          targetRef={securityRef}
        />
        <div className="of-demo-copy">
          <p className="of-kicker">Security lab</p>
          <h2>Attack the wallet. Watch it win.</h2>
          <p>
            The same paired app turns malicious and runs four live attacks. Every one is blocked by the real
            policy engine with a machine-readable reason on a visible timeline. Nothing is simulated.
          </p>
          <button className="of-inline-link" type="button">
            Structured errors, every time <ExternalLink size={18} />
          </button>
        </div>
        <div className="of-demo-chain" aria-label="Attacks blocked">
          <DemoPanel index="01" title="App turns malicious" body="Forbidden op, over-limit spend, replay, stolen token." icon={<Ban />} />
          <div className="of-chain-arrow" aria-hidden="true">
            <ArrowRight />
          </div>
          <DemoPanel index="02" title="Policy engine blocks" body="Ten ordered checks reject the request before any spend." icon={<ScanEye />} />
          <div className="of-chain-arrow" aria-hidden="true">
            <ArrowRight />
          </div>
          <DemoPanel index="03" title="Reason logged" body="permission_denied · limit_exceeded · replay · origin_mismatch." icon={<ShieldCheck />} />
        </div>
      </section>

      <section id="revoke" className="of-flow of-grid-paper">
        <div className="of-section-top">
          <span>Revocation</span>
          <span>&lt;revoke/&gt; authority ends when you say so</span>
        </div>
        <div className="of-section-heading">
          <h2>One tap and it is over.</h2>
          <p>
            Most projects demo connection and payment. Almost none demo the user taking authority back. Revoke a
            session and every later request — even an innocent read — fails with a single structured error.
          </p>
        </div>
        <div className="of-feature-grid">
          {attacks.map(([code, detail]) => (
            <article className="of-feature tone-orange" key={code}>
              <span className="mono">BLOCKED</span>
              <h3 className="mono">{code}</h3>
              <p>{detail}</p>
              <Power aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>

      <section id="docs" className="of-stack">
        <div className="of-section-top">
          <span>Built with</span>
          <span>&lt;stack&gt; Fiber-first, agent-ready &lt;/stack&gt;</span>
        </div>
        <div className="of-stack-content">
          <div>
            <h2>Infrastructure you can inspect.</h2>
            <p>Fiber testnet payments, a 10-step policy engine, signed scoped tokens, and an allow-listed gateway.</p>
          </div>
          <div className="of-stack-table">
            {["Fiber Network", "TypeScript SDK", "Policy engine", "SQLite", "Ed25519 / Biscuit", "Allow-listed gateway"].map((item, index) => (
              <span key={item}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="of-faq">
        <div className="of-section-top dark">
          <span>Judge Q&amp;A</span>
          <span>&lt;safety&gt; clear boundaries, explicit approval &lt;/safety&gt;</span>
        </div>
        <div className="of-faq-list">
          {faqs.map(([question, answer]) => (
            <FaqItem key={question} question={question} answer={answer} />
          ))}
        </div>
      </section>

      <footer id="start" className="of-follow">
        <div className="of-follow-inner">
          <div>
            <p className="of-kicker">The missing trust layer.</p>
            <h2>Pair. Review. Pay. Revoke.</h2>
          </div>
          <div className="of-follow-actions">
            <LandingActionButton tone="dark" size="follow" onClick={() => router.push("/demo")}>
              Try the demo
            </LandingActionButton>
            <button className="of-outline-button" type="button" onClick={() => router.push("/lab")}>
              Attack the wallet <ArrowUpRight />
            </button>
          </div>
        </div>
        <div className="of-footer-links">
          <span>Clasp</span>
          <a href="#flow">How it works</a>
          <a href="#security">Security lab</a>
          <a href="#revoke">Revocation</a>
          <a href="#docs">Stack</a>
        </div>
      </footer>
    </main>
  );
}

function DemoPanel({ index, title, body, icon }: { index: string; title: string; body: string; icon: ReactNode }) {
  return (
    <article className="of-demo-panel">
      <div>
        <span>{index}</span>
        {icon}
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const answerId = useId();
  return (
    <article className={`of-faq-item ${open ? "open" : ""}`}>
      <button
        className="of-faq-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={answerId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{question}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      <div id={answerId} className="of-faq-answer" aria-hidden={!open}>
        <div>
          <p>{answer}</p>
        </div>
      </div>
    </article>
  );
}
