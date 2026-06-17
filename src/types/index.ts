/** A User node as stored in Neo4j (includes the hashed password). */
export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthPayload {
  token: string;
  user: UserResponse;
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
