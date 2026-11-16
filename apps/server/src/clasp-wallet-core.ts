import { isClaspError, subAmounts, type ClaspError, type SessionStatement } from "@clasp/protocol";
import {
  Store,
  evaluate,
  delegate,
  createApprovedSession,
  decideHold,
  expireHoldIfDue,
  holdView,
  listSessionHolds,
  revokeSession,
  sessionToFacts,
  type StoredSession,
} from "@clasp/wallet-core";
import { signSession, signStatement, type Keypair } from "@clasp/token";
import type { Gateway } from "@clasp/gateway";
import type { WalletCore, CreateSessionResult, DelegateResultView, EvaluateMeta, SessionView } from "./wallet-core";

interface Deps {
  store: Store;
  gateway: Gateway;
  walletKeys: Keypair;
  now: () => number;
  owners?: readonly string[] | null;
}

const toFacts = sessionToFacts;

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
    ...(session.ownerPubKey ? { ownerPubKey: session.ownerPubKey } : {}),
    ...(session.approvalThreshold ? { approvalThreshold: session.approvalThreshold } : {}),
    ...(session.rateLimit ? { rateLimit: session.rateLimit } : {}),
  };
}

export function createWalletCore({ store, gateway, walletKeys, now, owners = null }: Deps): WalletCore {
  let counter = 0;
  const nextSessionId = () => {
    counter += 1;
    return `sess_${now().toString(36)}_${counter}`;
  };

  return {
    walletPublicKey: walletKeys.publicKey,

    createSession(approval): CreateSessionResult | ClaspError {
      const created = createApprovedSession(approval, {
        store,
        walletKeys,
        now: now(),
        newSessionId: nextSessionId,
        owners,
      });
      if (isClaspError(created)) return created;
      return {
        sessionId: created.sessionId,
        session: toView(created.session),
        token: created.token,
        walletPubKey: walletKeys.publicKey,
      };
    },

    async createInvoice(input: { amount: string; asset: string }) {
      const created = await gateway.newInvoice({ amount: input.amount, asset: input.asset });
      return { invoice: created.invoice, amount: created.amount, asset: created.asset };
    },

    getSession(sessionId: string): SessionView | null {
      store.expireDueHolds(sessionId, now());
      const session = store.getSession(sessionId);
      return session ? toView(session) : null;
    },

    getStatement(sessionId: string): SessionStatement | null {
      store.expireDueHolds(sessionId, now());
      const session = store.getSession(sessionId);
      if (!session) return null;
      return signStatement(
        {
          version: "1",
          sessionId: session.id,
          origin: session.origin,
          asset: session.asset,
          maxSessionSpend: session.maxSessionSpend,
          spent: session.spent,
          sessionRemaining: subAmounts(session.maxSessionSpend, session.spent),
          paymentCount: store.countPayments(session.id),
          state: session.state,
          expiresAt: session.expiresAt,
          issuedAt: new Date(now()).toISOString(),
        },
        walletKeys.privateKey,
      );
    },

    revoke(request): SessionView | ClaspError | null {
      const result = revokeSession(request, store, now());
      if (result === null || isClaspError(result)) return result;
      return toView(result);
    },

    listHolds(sessionId) {
      return listSessionHolds(store, sessionId, now());
    },

    getHold(requestId) {
      const hold = expireHoldIfDue(store, requestId, now());
      return hold ? holdView(hold) : null;
    },

    decide(decision) {
      return decideHold(decision, { store, gateway, walletKeys, now: now(), owners });
    },

    delegate(request, meta: EvaluateMeta): DelegateResultView | ClaspError {
      const parent = store.getSession(request.parentSessionId);
      const parentToken = parent ? signSession(toFacts(parent), walletKeys.privateKey) : "";
      const result = delegate(request, parentToken, {
        store,
        walletKeys,
        now: now(),
        origin: meta.origin,
        newSessionId: nextSessionId,
      });
      if (isClaspError(result)) return result;
      return {
        childSessionId: result.childSessionId,
        session: toView(result.child),
        token: result.childToken,
        walletPubKey: walletKeys.publicKey,
      };
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
