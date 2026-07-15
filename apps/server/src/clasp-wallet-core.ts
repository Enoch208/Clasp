import type { SessionFacts } from "@clasp/protocol";
import { Store, evaluate, type StoredSession } from "@clasp/wallet-core";
import { signSession, type Keypair } from "@clasp/token";
import type { Gateway } from "@clasp/gateway";
import type {
  WalletCore,
  CreateSessionInput,
  CreateSessionResult,
  EvaluateMeta,
  SessionView,
} from "./wallet-core";

interface Deps {
  store: Store;
  gateway: Gateway;
  walletKeys: Keypair;
  now: () => number;
}

function toFacts(session: StoredSession): SessionFacts {
  return {
    sessionId: session.id,
    origin: session.origin,
    permissions: session.permissions,
    asset: session.asset,
    maxSinglePayment: session.maxSinglePayment,
    maxSessionSpend: session.maxSessionSpend,
    expiresAt: session.expiresAt,
    appPubKey: session.appPubKey,
  };
}

function toView(session: StoredSession): SessionView {
  return {
    sessionId: session.id,
    origin: session.origin,
    permissions: session.permissions,
    asset: session.asset,
    maxSinglePayment: session.maxSinglePayment,
    maxSessionSpend: session.maxSessionSpend,
    spent: session.spent,
    appPubKey: session.appPubKey,
    expiresAt: session.expiresAt,
    state: session.state,
    createdAt: new Date(session.createdAt).toISOString(),
  };
}

export function createWalletCore({ store, gateway, walletKeys, now }: Deps): WalletCore {
  let counter = 0;
  const nextSessionId = () => {
    counter += 1;
    return `sess_${now().toString(36)}_${counter}`;
  };

  return {
    createSession(input: CreateSessionInput): CreateSessionResult {
      const sessionId = nextSessionId();
      const stored = store.createSession(
        {
          sessionId,
          origin: input.origin,
          permissions: input.permissions,
          asset: input.asset,
          maxSinglePayment: input.maxSinglePayment,
          maxSessionSpend: input.maxSessionSpend,
          expiresAt: input.expiresAt,
          appPubKey: input.appPubKey,
        },
        now(),
      );
      const token = signSession(toFacts(stored), walletKeys.privateKey);
      return { sessionId, session: toView(stored), token, walletPubKey: walletKeys.publicKey };
    },

    async createInvoice(input: { amount: string; asset: string }) {
      const created = await gateway.newInvoice({ amount: input.amount, asset: input.asset });
      return { invoice: created.invoice, amount: created.amount, asset: created.asset };
    },

    getSession(sessionId: string): SessionView | null {
      const session = store.getSession(sessionId);
      return session ? toView(session) : null;
    },

    revoke(sessionId: string): SessionView | null {
      const session = store.getSession(sessionId);
      if (!session) return null;
      if (session.state !== "ACTIVE") return toView(session);
      return toView(store.revoke(sessionId, now()));
    },

    async evaluate(request, meta: EvaluateMeta) {
      const session = store.getSession(request.sessionId);
      const token = session ? signSession(toFacts(session), walletKeys.privateKey) : "";
      return evaluate(request, {
        store,
        gateway,
        walletKeys,
        now: now(),
        origin: meta.origin,
        token,
      });
    },
  };
}
