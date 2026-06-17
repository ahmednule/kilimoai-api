/**
 * Single source of truth for the Kilimo AI domain graph (see docs/PRD.md §9).
 *
 * The graph models smallholder-farmer loan eligibility as interconnected
 * relationships rather than a flat table, so that a Cypher traversal can answer
 * "which loan products does this farmer qualify for, and why?".
 *
 * Use the NodeLabel and RelType constants everywhere Cypher is written so a
 * typo becomes a TypeScript error rather than a silently-empty query.
 */

/** Node labels in the domain graph. `User` (auth) is intentionally excluded. */
export const NodeLabel = {
  Farmer: 'Farmer',
  Crop: 'Crop',
  Region: 'Region',
  Season: 'Season',
  LoanProduct: 'LoanProduct',
  Lender: 'Lender',
  RiskCategory: 'RiskCategory',
  Application: 'Application',
} as const;

export type NodeLabel = (typeof NodeLabel)[keyof typeof NodeLabel];

/** Relationship types (graph edges) connecting the nodes above. */
export const RelType = {
  /** (:Farmer)-[:GROWS]->(:Crop) */
  GROWS: 'GROWS',
  /** (:Farmer)-[:LOCATED_IN]->(:Region) */
  LOCATED_IN: 'LOCATED_IN',
  /** (:Farmer)-[:HARVESTS_IN]->(:Season) */
  HARVESTS_IN: 'HARVESTS_IN',
  /** (:Farmer)-[:HISTORICALLY_REPAID]->(:LoanProduct) */
  HISTORICALLY_REPAID: 'HISTORICALLY_REPAID',
  /** (:LoanProduct)-[:OFFERED_BY]->(:Lender) */
  OFFERED_BY: 'OFFERED_BY',
  /** (:LoanProduct)-[:QUALIFIES_FOR]->(:Crop|:Region|:Season|:RiskCategory) */
  QUALIFIES_FOR: 'QUALIFIES_FOR',
  /** (:Lender)-[:OPERATES_IN]->(:Region) */
  OPERATES_IN: 'OPERATES_IN',
  /** (:Farmer)-[:SUBMITTED]->(:Application) */
  SUBMITTED: 'SUBMITTED',
  /** (:Application)-[:FOR_PRODUCT]->(:LoanProduct) */
  FOR_PRODUCT: 'FOR_PRODUCT',
} as const;

export type RelType = (typeof RelType)[keyof typeof RelType];

/**
 * Cypher constraint statements that enforce the domain graph's integrity.
 *
 * - `id`-keyed nodes (Farmer, LoanProduct, Lender) get a uniqueness constraint
 *   on their UUID.
 * - Reference/lookup nodes (Crop, Region, Season, RiskCategory) get a
 *   uniqueness constraint on `name`, so they can be created idempotently with
 *   `MERGE (:Crop {name: $name})`.
 *
 * Each unique constraint also backs an index, keeping lookups fast. All are
 * `IF NOT EXISTS`, so running them on every startup is safe and idempotent.
 */
export const domainConstraints: readonly string[] = [
  // Identity (UUID) nodes
  `CREATE CONSTRAINT farmer_id_unique IF NOT EXISTS FOR (f:${NodeLabel.Farmer}) REQUIRE f.id IS UNIQUE`,
  `CREATE CONSTRAINT loan_product_id_unique IF NOT EXISTS FOR (p:${NodeLabel.LoanProduct}) REQUIRE p.id IS UNIQUE`,
  `CREATE CONSTRAINT lender_id_unique IF NOT EXISTS FOR (l:${NodeLabel.Lender}) REQUIRE l.id IS UNIQUE`,
  `CREATE CONSTRAINT application_id_unique IF NOT EXISTS FOR (a:${NodeLabel.Application}) REQUIRE a.id IS UNIQUE`,

  // Reference (name-keyed) nodes — enable idempotent MERGE by name
  `CREATE CONSTRAINT crop_name_unique IF NOT EXISTS FOR (c:${NodeLabel.Crop}) REQUIRE c.name IS UNIQUE`,
  `CREATE CONSTRAINT region_name_unique IF NOT EXISTS FOR (r:${NodeLabel.Region}) REQUIRE r.name IS UNIQUE`,
  `CREATE CONSTRAINT season_name_unique IF NOT EXISTS FOR (s:${NodeLabel.Season}) REQUIRE s.name IS UNIQUE`,
  `CREATE CONSTRAINT risk_category_name_unique IF NOT EXISTS FOR (rc:${NodeLabel.RiskCategory}) REQUIRE rc.name IS UNIQUE`,
] as const;
