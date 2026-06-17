import {
  LoanProduct,
  RepaymentSimulationInput,
  RepaymentSimulation,
  RepaymentInstallment,
} from '../types/index.js';

/**
 * Projects a loan's repayment, both as even monthly instalments and — the
 * point of the product — aligned to harvest cycles, since smallholders are
 * paid in lump sums at harvest, not monthly (see docs/PRD.md §6 step 5, FR5).
 *
 * Pure computation: it takes an already-loaded LoanProduct and the farmer's
 * inputs and returns the projection. Interest is modelled as a **flat rate**
 * (the common convention in Kenyan microfinance): total interest =
 * principal × annual-rate × years. Reducing-balance is a future option.
 */
export class RepaymentService {
  simulate(product: LoanProduct, input: RepaymentSimulationInput): RepaymentSimulation {
    const principal = input.principal;
    if (!(principal > 0)) {
      throw new Error('Principal must be greater than zero');
    }
    if (principal < product.minAmount || principal > product.maxAmount) {
      throw new Error(
        `Principal must be between KES ${product.minAmount} and KES ${product.maxAmount} for ${product.name}`,
      );
    }

    const harvestsPerYear = input.harvestsPerYear && input.harvestsPerYear > 0 ? input.harvestsPerYear : 2;
    const term = product.term;
    const years = term / 12;

    const totalInterest = round2(principal * (product.interestRate / 100) * years);
    const totalRepayable = round2(principal + totalInterest);
    const monthlyInstallment = round2(totalRepayable / term);

    // A harvest occurs every `intervalMonths`; count how many fall within the term.
    const intervalMonths = 12 / harvestsPerYear;
    const harvestsInTerm = Math.max(1, Math.floor(term / intervalMonths));
    const harvestInstallment = round2(totalRepayable / harvestsInTerm);

    const schedule: RepaymentInstallment[] = [];
    for (let k = 1; k <= harvestsInTerm; k++) {
      // Last payment lands exactly at term end; clamp intermediate ones too.
      const month = k === harvestsInTerm ? term : Math.min(term, Math.round(k * intervalMonths));
      schedule.push({ month, amountDue: harvestInstallment, label: `Harvest ${k}` });
    }

    const expectedHarvestRevenue =
      input.expectedHarvestRevenue != null ? input.expectedHarvestRevenue : null;
    const affordable =
      expectedHarvestRevenue == null ? null : harvestInstallment <= expectedHarvestRevenue;

    return {
      product,
      principal,
      interestRate: product.interestRate,
      termMonths: term,
      totalInterest,
      totalRepayable,
      monthlyInstallment,
      harvestsInTerm,
      harvestInstallment,
      expectedHarvestRevenue,
      affordable,
      schedule,
      summary: buildSummary({
        product,
        principal,
        totalRepayable,
        term,
        harvestsInTerm,
        harvestInstallment,
        expectedHarvestRevenue,
        affordable,
      }),
    };
  }
}

function buildSummary(p: {
  product: LoanProduct;
  principal: number;
  totalRepayable: number;
  term: number;
  harvestsInTerm: number;
  harvestInstallment: number;
  expectedHarvestRevenue: number | null;
  affordable: boolean | null;
}): string {
  const parts = [
    `Borrowing KES ${fmt(p.principal)} on ${p.product.name} (${p.product.interestRate}% p.a., ` +
      `${p.term} months) means repaying KES ${fmt(p.totalRepayable)} in total.`,
    `Aligned to harvests, that is ${p.harvestsInTerm} payment(s) of about KES ${fmt(p.harvestInstallment)} each.`,
  ];
  if (p.expectedHarvestRevenue != null) {
    parts.push(
      p.affordable
        ? `Your expected harvest income of KES ${fmt(p.expectedHarvestRevenue)} comfortably covers each payment.`
        : `Warning: each payment (KES ${fmt(p.harvestInstallment)}) exceeds your expected harvest income of ` +
            `KES ${fmt(p.expectedHarvestRevenue)} — consider borrowing less or a longer term.`,
    );
  }
  return parts.join(' ');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-KE');
}
