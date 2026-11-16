import type {
  ClaspError,
  DelegationRequest,
  GrantablePermission,
  HoldView,
  OperationRequest,
  OperationResult,
  PaymentDecision,
  RateLimit,
  RevokeRequest,
  SessionApproval,
  SessionState,
  SessionStatement,
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
  ownerPubKey?: string;
  approvalThreshold?: string;
  rateLimit?: RateLimit;
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
  walletPublicKey: string;
  createSession(approval: SessionApproval): CreateSessionResult | ClaspError;
  createInvoice(input: { amount: string; asset: string }): Promise<InvoiceResult>;
  getSession(sessionId: string): SessionView | null;
  getStatement(sessionId: string): SessionStatement | null;
  revoke(request: RevokeRequest): SessionView | ClaspError | null;
  listHolds(sessionId: string): HoldView[] | null;
  getHold(requestId: string): HoldView | null;
  decide(decision: PaymentDecision): Promise<HoldView | ClaspError | null>;
  delegate(request: DelegationRequest, meta: EvaluateMeta): DelegateResultView | ClaspError;
  evaluate(request: OperationRequest, meta: EvaluateMeta): Promise<OperationResult | ClaspError>;
}
