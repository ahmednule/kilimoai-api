import gql from 'graphql-tag';

export const typeDefs = gql`
  type User {
    id: ID!
    email: String!
    name: String!
    emailVerified: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  "Result of an action that does not issue a session (e.g. signup, resend)."
  type AuthResult {
    success: Boolean!
    message: String!
  }

  # --- Domain: farmers, lenders, loan products, and matching (PRD §6, §9) ---

  type Lender {
    id: ID!
    name: String!
    "MFI | SACCO | BANK | AGRI_INPUT"
    type: String!
  }

  type LoanProduct {
    id: ID!
    name: String!
    minAmount: Float!
    maxAmount: Float!
    "Annual interest rate as a percentage."
    interestRate: Float!
    "Repayment term in months."
    term: Int!
    eligibilityNotes: String!
    lender: Lender
  }

  type Farmer {
    id: ID!
    name: String!
    "Farm size in acres."
    farmSize: Float!
    location: String!
    financialHistory: String!
    "Preferred language, e.g. \\"sw\\" or \\"en\\"."
    language: String!
    crops: [String!]!
    region: String
    seasons: [String!]!
    createdAt: String!
    updatedAt: String!
  }

  "A dimension on which the farmer satisfies a product's requirement."
  type MatchReason {
    "crop | region | season"
    dimension: String!
    matched: [String!]!
  }

  "A required dimension the farmer does not yet satisfy (the qualify-yet path)."
  type MatchGap {
    "crop | region | season"
    dimension: String!
    required: [String!]!
  }

  "A plain-language, graph-grounded explanation of a single match."
  type MatchExplanation {
    text: String!
    "Language of the explanation, e.g. \\"sw\\" or \\"en\\"."
    language: String!
    "Provenance: \\"featherless:<model>\\" or \\"template\\"."
    generatedBy: String!
  }

  "A loan product evaluated against a farmer, with the reasons it (nearly) fits."
  type ProductMatch {
    product: LoanProduct!
    lender: Lender!
    qualifies: Boolean!
    "Higher is a better fit; used for ranking."
    fitScore: Int!
    reasons: [MatchReason!]!
    gaps: [MatchGap!]!
    riskCategories: [String!]!
    hasRepaymentHistory: Boolean!
    lenderInRegion: Boolean!
    "Plain-language explanation (Swahili/English). Generated on demand."
    explanation(language: String): MatchExplanation!
  }

  "The reverse of ProductMatch: a farmer evaluated against a loan product (loan-officer view)."
  type FarmerMatch {
    farmer: Farmer!
    qualifies: Boolean!
    "Higher is a better fit; used for ranking."
    fitScore: Int!
    reasons: [MatchReason!]!
    gaps: [MatchGap!]!
    hasRepaymentHistory: Boolean!
    lenderInRegion: Boolean!
  }

  "One scheduled repayment, aligned to a harvest cycle."
  type RepaymentInstallment {
    "Months after disbursement this payment is due."
    month: Int!
    amountDue: Float!
    label: String!
  }

  "A repayment projection for a loan, both monthly and harvest-aligned."
  type RepaymentSimulation {
    product: LoanProduct!
    principal: Float!
    interestRate: Float!
    termMonths: Int!
    totalInterest: Float!
    totalRepayable: Float!
    monthlyInstallment: Float!
    harvestsInTerm: Int!
    harvestInstallment: Float!
    expectedHarvestRevenue: Float
    "Whether harvest income covers a harvest installment; null if no revenue given."
    affordable: Boolean
    schedule: [RepaymentInstallment!]!
    summary: String!
  }

  input RepaymentSimulationInput {
    productId: ID!
    principal: Float!
    "Expected income per harvest, for the affordability check."
    expectedHarvestRevenue: Float
    "Harvests per year (defaults to 2: long + short rains)."
    harvestsPerYear: Int
  }

  input OnboardFarmerInput {
    name: String!
    farmSize: Float!
    location: String!
    financialHistory: String
    "Preferred language; defaults to \\"en\\"."
    language: String
    crops: [String!]!
    region: String!
    seasons: [String!]!
  }

  type Query {
    me: User
    user(id: ID!): User

    "Fetch a farmer and their graph relationships."
    farmer(id: ID!): Farmer
    "Loan products a farmer (nearly) qualifies for, ranked by fit."
    farmerMatches(farmerId: ID!, includeNearMisses: Boolean, limit: Int): [ProductMatch!]!
    loanProducts: [LoanProduct!]!
    loanProduct(id: ID!): LoanProduct

    "Loan-officer view: farmers who (nearly) qualify for a product, ranked by fit. Requires auth."
    farmersForProduct(productId: ID!, includeNearMisses: Boolean, limit: Int): [FarmerMatch!]!

    "Project repayment for a loan, aligned to harvest cycles."
    simulateRepayment(input: RepaymentSimulationInput!): RepaymentSimulation!
  }

  type Mutation {
    "Register a user (unverified) and email a verification link. Does not issue a token."
    signup(email: String!, password: String!, name: String!): AuthResult!
    "Authenticate a verified user and return a JWT."
    login(email: String!, password: String!): AuthPayload!
    "Confirm an email-verification token and log the user in."
    verifyEmail(token: String!): AuthPayload!
    "Re-send the email-verification link. Always returns a generic result."
    resendVerification(email: String!): AuthResult!

    "Capture a farmer's profile (farmer-facing onboarding) so they can be matched."
    onboardFarmer(input: OnboardFarmerInput!): Farmer!
  }
`;
