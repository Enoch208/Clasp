import type {
  ClaspError,
  DelegationRequest,
  GrantablePermission,
  OperationRequest,
  OperationResult,
  SessionState,
} from "@clasp/protocol";

export interface SessionView {
  sessionId: string;
  origin: string;
  permissions: GrantablePermission[];
  asset: string;
  maxSinglePayment: string;
  maxSessionSpend: string;
  spent: string;
  appPubKey: string;
  expiresAt: string;
  state: SessionState;
  createdAt: string;
}

export interface CreateSessionInput {
  origin: string;
  permissions: GrantablePermission[];
  asset: string;
  maxSinglePayment: string;
  maxSessionSpend: string;
  expiresAt: string;
  appPubKey: string;
}

export interface CreateSessionResult {
  sessionId: string;
  session: SessionView;
  token: string;
  walletPubKey: string;
}

export interface EvaluateMeta {
  origin: string;
}

export interface InvoiceResult {
  invoice: string;
  amount: string;
  asset: string;
}

export interface DelegateResultView {
  childSessionId: string;
  session: SessionView;
  token: string;
  walletPubKey: string;
}

export interface WalletCore {
  createSession(input: CreateSessionInput): CreateSessionResult;
  createInvoice(input: { amount: string; asset: string }): Promise<InvoiceResult>;
  getSession(sessionId: string): SessionView | null;
  revoke(sessionId: string): SessionView | null;
  delegate(request: DelegationRequest, meta: EvaluateMeta): DelegateResultView | ClaspError;
  evaluate(request: OperationRequest, meta: EvaluateMeta): Promise<OperationResult | ClaspError>;
}
