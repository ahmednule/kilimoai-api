import { LoanProduct } from '../types/index.js';

/**
 * Helpers for turning raw Neo4j values into the plain shapes the API returns.
 * The driver represents integers as `neo4j.Integer` objects, so numeric props
 * must be coerced before they cross the GraphQL boundary.
 */

/** Coerces a neo4j Integer | number | null into a plain JS number. */
export function toNumber(value: any): number {
  if (value == null) return value;
  if (typeof value === 'number') return value;
  if (typeof value.toNumber === 'function') return value.toNumber();
  return Number(value);
}

/** Maps raw LoanProduct node properties to the typed, number-normalised shape. */
export function normaliseProduct(props: any): LoanProduct {
  return {
    id: props.id,
    name: props.name,
    minAmount: toNumber(props.minAmount),
    maxAmount: toNumber(props.maxAmount),
    interestRate: toNumber(props.interestRate),
    term: toNumber(props.term),
    eligibilityNotes: props.eligibilityNotes,
  };
}
