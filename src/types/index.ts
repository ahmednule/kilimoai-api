/** A User node as stored in Neo4j (includes the hashed password). */
export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  /** Whether the user has confirmed ownership of their email address. */
  emailVerified: boolean;
  /** SHA-256 hash of the pending email-verification token (null once used). */
  verificationTokenHash?: string | null;
  /** ISO 8601 expiry of the pending verification token (null once used). */
  verificationTokenExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthPayload {
  token: string;
  user: UserResponse;
}

/** Result of an action that does not (yet) issue a session, e.g. signup. */
export interface AuthResult {
  success: boolean;
  message: string;
}

export interface SignupInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// ---------------------------------------------------------------------------
// Domain graph node shapes (see docs/PRD.md §9 and src/domain/schema.ts).
// These describe node *properties* as stored in Neo4j; relationships between
// them are edges in the graph, not fields on these objects.
// ---------------------------------------------------------------------------

/** A smallholder farmer seeking input financing. */
export interface Farmer {
  id: string;
  name: string;
  /** Farm size in acres. */
  farmSize: number;
  /** Free-text location label; also linked to a Region node via LOCATED_IN. */
  location: string;
  /** Short summary of prior borrowing/repayment behaviour, if any. */
  financialHistory: string;
  /** Preferred conversation language, e.g. "sw" or "en". */
  language: string;
  createdAt: string;
  updatedAt: string;
}

/** A farmer plus its graph relationships, flattened for the GraphQL layer. */
export interface FarmerWithRelations extends Farmer {
  crops: string[];
  /** The farmer's region (LOCATED_IN); null if none recorded. */
  region: string | null;
  seasons: string[];
}

/** Input for onboarding a farmer through the conversational flow. */
export interface OnboardFarmerInput {
  name: string;
  farmSize: number;
  location: string;
  financialHistory?: string;
  language?: string;
  crops: string[];
  region: string;
  seasons: string[];
}

/** A crop a farmer grows; reference node keyed by name. */
export interface Crop {
  name: string;
}

/** A geographic region; reference node keyed by name. */
export interface Region {
  name: string;
}

/** A planting/harvest season; reference node keyed by name. */
export interface Season {
  name: string;
}

/** A risk category used to gate eligibility; reference node keyed by name. */
export interface RiskCategory {
  name: string;
}

/** A financing product a farmer can apply for. */
export interface LoanProduct {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  /** Annual interest rate as a percentage, e.g. 14.5. */
  interestRate: number;
  /** Repayment term in months. */
  term: number;
  /** Plain-language eligibility notes for explanations. */
  eligibilityNotes: string;
}

/** An institution offering loan products (MFI, SACCO, bank, agri-input co.). */
export interface Lender {
  id: string;
  name: string;
  /** One of: "MFI" | "SACCO" | "BANK" | "AGRI_INPUT". */
  type: string;
}

// ---------------------------------------------------------------------------
// Matching results (see src/services/MatchingService.ts).
// ---------------------------------------------------------------------------

/** A dimension on which the farmer satisfies a product's requirement. */
export interface MatchReason {
  /** "crop" | "region" | "season" */
  dimension: string;
  /** The farmer's values that matched the product's requirement. */
  matched: string[];
}

/** A required dimension the farmer does NOT yet satisfy (the "qualify-yet" path). */
export interface MatchGap {
  /** "crop" | "region" | "season" */
  dimension: string;
  /** What the product requires on this dimension. */
  required: string[];
}

/** One loan product evaluated against a farmer, with the reasons it (nearly) fits. */
export interface ProductMatch {
  product: LoanProduct;
  lender: Lender;
  /** True when every required dimension is satisfied. */
  qualifies: boolean;
  /** Higher is a better fit; used for ranking. */
  fitScore: number;
  /** Why the farmer qualifies (matched dimensions). */
  reasons: MatchReason[];
  /** What the farmer would need to change to qualify (empty when `qualifies`). */
  gaps: MatchGap[];
  /** Risk categories the product is scoped to (informational, for explanations). */
  riskCategories: string[];
  /** The farmer has repaid at least one prior loan (a trust signal). */
  hasRepaymentHistory: boolean;
  /** The lender operates in the farmer's region. */
  lenderInRegion: boolean;
}

/** A plain-language, graph-grounded explanation of a single product match. */
export interface MatchExplanation {
  text: string;
  /** Language the explanation is written in, e.g. "sw" or "en". */
  language: string;
  /** Provenance: "featherless:<model>" when the LLM produced it, else "template". */
  generatedBy: string;
}

/**
 * The reverse of ProductMatch: one farmer evaluated against a given loan
 * product, for the loan-officer discovery view (see docs/PRD.md §6 step 7).
 */
export interface FarmerMatch {
  farmer: FarmerWithRelations;
  qualifies: boolean;
  fitScore: number;
  reasons: MatchReason[];
  gaps: MatchGap[];
  /** The farmer has repaid at least one prior loan (a trust signal). */
  hasRepaymentHistory: boolean;
  /** The product's lender operates in the farmer's region. */
  lenderInRegion: boolean;
}

// ---------------------------------------------------------------------------
// Repayment simulation (see src/services/RepaymentService.ts, PRD FR5).
// ---------------------------------------------------------------------------

export interface RepaymentSimulationInput {
  productId: string;
  /** Amount to borrow (must be within the product's min/max). */
  principal: number;
  /** Expected income per harvest, for the affordability check. Optional. */
  expectedHarvestRevenue?: number;
  /** Harvests per year (Kenya typically 2: long + short rains). Defaults to 2. */
  harvestsPerYear?: number;
}

/** One scheduled repayment, aligned to a harvest cycle. */
export interface RepaymentInstallment {
  /** Months after disbursement that this payment falls due. */
  month: number;
  amountDue: number;
  /** Human label, e.g. "Harvest 1". */
  label: string;
}

export interface RepaymentSimulation {
  product: LoanProduct;
  principal: number;
  /** Annual interest rate as a percentage. */
  interestRate: number;
  termMonths: number;
  totalInterest: number;
  totalRepayable: number;
  /** Even monthly repayment over the term. */
  monthlyInstallment: number;
  /** Number of harvest cycles that fall within the term. */
  harvestsInTerm: number;
  /** Repayment per harvest if paid from harvest income. */
  harvestInstallment: number;
  /** Echoed input; null if not provided. */
  expectedHarvestRevenue: number | null;
  /** Whether a harvest's income covers a harvest installment; null if no revenue given. */
  affordable: boolean | null;
  /** Harvest-aligned repayment schedule. */
  schedule: RepaymentInstallment[];
  /** Plain-language summary of the plan. */
  summary: string;
}

export interface GraphQLContext {
  userId?: string;
  user?: User;
}

export interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}
