/**
 * Seeds the Kilimo AI domain graph with a realistic slice of the Kenyan
 * agri-finance market: lenders, loan products, and the crop/region/season/risk
 * eligibility relationships that drive matching (see docs/PRD.md §9 and §7).
 *
 * Data is modelled on publicly described products from Kenyan MFIs, SACCOs,
 * banks, and agri-input companies. It is illustrative, not an official source
 * of loan terms — real partner feeds replace it post-challenge.
 *
 * Idempotent: every node is MERGEd on a stable key, so running it repeatedly
 * converges to the same graph. Run with:  pnpm seed
 *
 * Amounts are in KES; interestRate is an annual percentage; term is in months.
 */
import 'dotenv/config';
import { getDriver, closeDriver, initSchema } from './neo4j.js';

interface SeedLender {
  id: string;
  name: string;
  type: 'MFI' | 'SACCO' | 'BANK' | 'AGRI_INPUT';
  /** Regions the lender operates in (OPERATES_IN). */
  regions: string[];
}

interface SeedProduct {
  id: string;
  name: string;
  lenderId: string;
  minAmount: number;
  maxAmount: number;
  interestRate: number;
  term: number;
  eligibilityNotes: string;
  /** Eligibility scoping (QUALIFIES_FOR). Empty array = open on that dimension. */
  crops: string[];
  regions: string[];
  seasons: string[];
  riskCategories: string[];
}

interface SeedFarmer {
  id: string;
  name: string;
  farmSize: number;
  location: string;
  financialHistory: string;
  language: string;
  crops: string[];
  region: string;
  seasons: string[];
  /** LoanProduct ids the farmer has previously repaid (HISTORICALLY_REPAID). */
  repaidProductIds: string[];
}

const SEASONS = ['Long Rains', 'Short Rains', 'Dry Season'];

const RISK_CATEGORIES = [
  'New Borrower',
  'Returning Borrower',
  'Group Guaranteed',
  'Collateral Backed',
];

const LENDERS: SeedLender[] = [
  { id: 'juhudi-kilimo', name: 'Juhudi Kilimo', type: 'MFI', regions: ['Kiambu', 'Murang’a', 'Meru', 'Nakuru', 'Kisii'] },
  { id: 'musoni', name: 'Musoni Microfinance', type: 'MFI', regions: ['Kiambu', 'Machakos', 'Embu', 'Meru'] },
  { id: 'kwft', name: 'Kenya Women Microfinance Bank', type: 'MFI', regions: ['Nakuru', 'Bungoma', 'Kakamega', 'Kisii', 'Murang’a'] },
  { id: 'faulu', name: 'Faulu Microfinance Bank', type: 'MFI', regions: ['Kiambu', 'Nakuru', 'Uasin Gishu', 'Trans Nzoia'] },
  { id: 'equity-kilimo', name: 'Equity Bank — Kilimo Biashara', type: 'BANK', regions: ['Nakuru', 'Uasin Gishu', 'Trans Nzoia', 'Meru', 'Kirinyaga', 'Bungoma'] },
  { id: 'coop-kilimo', name: 'Co-operative Bank — Co-op Kilimo', type: 'BANK', regions: ['Kiambu', 'Nyeri', 'Kirinyaga', 'Meru', 'Kisii'] },
  { id: 'afc', name: 'Agricultural Finance Corporation', type: 'BANK', regions: ['Uasin Gishu', 'Trans Nzoia', 'Narok', 'Nakuru'] },
  { id: 'one-acre-fund', name: 'One Acre Fund (Tupande)', type: 'AGRI_INPUT', regions: ['Bungoma', 'Kakamega', 'Trans Nzoia'] },
  { id: 'apollo-agriculture', name: 'Apollo Agriculture', type: 'AGRI_INPUT', regions: ['Nakuru', 'Uasin Gishu', 'Trans Nzoia', 'Bungoma', 'Narok'] },
  { id: 'unaitas', name: 'Unaitas SACCO', type: 'SACCO', regions: ['Murang’a', 'Kiambu', 'Nyeri', 'Kirinyaga'] },
  { id: 'wakulima-dairy', name: 'Wakulima Dairy SACCO', type: 'SACCO', regions: ['Nyeri', 'Murang’a', 'Kiambu'] },
];

const PRODUCTS: SeedProduct[] = [
  // Juhudi Kilimo
  { id: 'jk-input-loan', name: 'Farm Input Loan', lenderId: 'juhudi-kilimo', minAmount: 10000, maxAmount: 150000, interestRate: 18, term: 12, eligibilityNotes: 'For seed and fertiliser; group or individual.', crops: ['Maize', 'Beans'], regions: ['Kiambu', 'Nakuru', 'Kisii'], seasons: ['Long Rains'], riskCategories: ['Group Guaranteed'] },
  { id: 'jk-dairy-cow', name: 'Dairy Cow Loan', lenderId: 'juhudi-kilimo', minAmount: 60000, maxAmount: 300000, interestRate: 19, term: 24, eligibilityNotes: 'Asset finance for in-calf dairy cows.', crops: ['Dairy'], regions: ['Kiambu', 'Murang’a', 'Meru'], seasons: [], riskCategories: ['Collateral Backed'] },
  // Musoni
  { id: 'musoni-kilimo-bora', name: 'Kilimo Bora Loan', lenderId: 'musoni', minAmount: 15000, maxAmount: 200000, interestRate: 20, term: 12, eligibilityNotes: 'Mobile-first input loan disbursed via M-Pesa.', crops: ['Maize', 'Beans', 'Potatoes'], regions: ['Machakos', 'Embu', 'Meru'], seasons: ['Long Rains', 'Short Rains'], riskCategories: ['New Borrower'] },
  { id: 'musoni-horticulture', name: 'Horticulture Working Capital', lenderId: 'musoni', minAmount: 30000, maxAmount: 400000, interestRate: 21, term: 9, eligibilityNotes: 'Short-cycle working capital for vegetable growers.', crops: ['Tomatoes', 'French Beans'], regions: ['Kiambu', 'Embu'], seasons: [], riskCategories: ['Returning Borrower'] },
  // KWFT
  { id: 'kwft-women-agri', name: 'Women in Agriculture Loan', lenderId: 'kwft', minAmount: 10000, maxAmount: 120000, interestRate: 17, term: 12, eligibilityNotes: 'Group-guaranteed loan for women smallholders.', crops: ['Maize', 'Beans', 'Dairy'], regions: ['Bungoma', 'Kakamega', 'Kisii'], seasons: ['Long Rains'], riskCategories: ['Group Guaranteed'] },
  { id: 'kwft-poultry', name: 'Poultry & Smallstock Loan', lenderId: 'kwft', minAmount: 8000, maxAmount: 80000, interestRate: 18, term: 10, eligibilityNotes: 'For poultry units and feed.', crops: [], regions: ['Nakuru', 'Murang’a'], seasons: [], riskCategories: ['New Borrower', 'Group Guaranteed'] },
  // Faulu
  { id: 'faulu-maize-cycle', name: 'Maize Cycle Loan', lenderId: 'faulu', minAmount: 20000, maxAmount: 250000, interestRate: 19, term: 12, eligibilityNotes: 'Repayment aligned to the maize harvest.', crops: ['Maize'], regions: ['Uasin Gishu', 'Trans Nzoia', 'Nakuru'], seasons: ['Long Rains'], riskCategories: ['Returning Borrower'] },
  { id: 'faulu-agri-asset', name: 'Agri Asset Finance', lenderId: 'faulu', minAmount: 50000, maxAmount: 500000, interestRate: 20, term: 24, eligibilityNotes: 'Equipment and water tanks; collateral required.', crops: [], regions: ['Kiambu', 'Nakuru'], seasons: [], riskCategories: ['Collateral Backed'] },
  // Equity Kilimo Biashara
  { id: 'equity-kilimo-biashara', name: 'Kilimo Biashara Loan', lenderId: 'equity-kilimo', minAmount: 30000, maxAmount: 1000000, interestRate: 16, term: 18, eligibilityNotes: 'Flagship agri loan; inputs to mechanisation.', crops: ['Maize', 'Wheat', 'Potatoes'], regions: ['Uasin Gishu', 'Trans Nzoia', 'Narok', 'Nakuru'], seasons: ['Long Rains'], riskCategories: ['Returning Borrower'] },
  { id: 'equity-coffee-advance', name: 'Coffee Cherry Advance', lenderId: 'equity-kilimo', minAmount: 20000, maxAmount: 300000, interestRate: 15, term: 12, eligibilityNotes: 'Advance against expected coffee delivery.', crops: ['Coffee'], regions: ['Meru', 'Kirinyaga'], seasons: ['Short Rains'], riskCategories: ['Collateral Backed'] },
  { id: 'equity-tea-advance', name: 'Tea Bonus Advance', lenderId: 'equity-kilimo', minAmount: 15000, maxAmount: 250000, interestRate: 15, term: 12, eligibilityNotes: 'Advance against tea green-leaf payments.', crops: ['Tea'], regions: ['Kirinyaga', 'Meru'], seasons: [], riskCategories: ['Returning Borrower'] },
  // Co-op Kilimo
  { id: 'coop-mavuno', name: 'Mavuno Input Loan', lenderId: 'coop-kilimo', minAmount: 15000, maxAmount: 180000, interestRate: 17, term: 12, eligibilityNotes: 'Input finance for cereal and legume growers.', crops: ['Maize', 'Beans', 'Sorghum'], regions: ['Kiambu', 'Nyeri', 'Kisii'], seasons: ['Long Rains', 'Short Rains'], riskCategories: ['New Borrower'] },
  { id: 'coop-dairy', name: 'Maziwa Dairy Loan', lenderId: 'coop-kilimo', minAmount: 40000, maxAmount: 350000, interestRate: 18, term: 24, eligibilityNotes: 'Dairy expansion via cooperative milk payments.', crops: ['Dairy'], regions: ['Nyeri', 'Kiambu', 'Meru'], seasons: [], riskCategories: ['Returning Borrower'] },
  { id: 'coop-avocado', name: 'Avocado Export Loan', lenderId: 'coop-kilimo', minAmount: 50000, maxAmount: 600000, interestRate: 16, term: 18, eligibilityNotes: 'For avocado growers with export off-take.', crops: ['Avocado'], regions: ['Murang’a', 'Kisii'], seasons: [], riskCategories: ['Collateral Backed'] },
  // AFC
  { id: 'afc-seasonal-crop', name: 'Seasonal Crop Credit', lenderId: 'afc', minAmount: 50000, maxAmount: 2000000, interestRate: 12, term: 12, eligibilityNotes: 'Subsidised seasonal credit for cereal farmers.', crops: ['Maize', 'Wheat'], regions: ['Uasin Gishu', 'Trans Nzoia', 'Narok'], seasons: ['Long Rains'], riskCategories: ['Collateral Backed'] },
  { id: 'afc-mechanisation', name: 'Farm Mechanisation Loan', lenderId: 'afc', minAmount: 200000, maxAmount: 5000000, interestRate: 13, term: 36, eligibilityNotes: 'Tractors and implements; title deed security.', crops: [], regions: ['Uasin Gishu', 'Trans Nzoia', 'Narok'], seasons: [], riskCategories: ['Collateral Backed'] },
  // One Acre Fund
  { id: 'oaf-input-package', name: 'Tupande Input Package', lenderId: 'one-acre-fund', minAmount: 5000, maxAmount: 40000, interestRate: 0, term: 9, eligibilityNotes: 'Seed and fertiliser on credit, repaid post-harvest. Service fee, no interest.', crops: ['Maize', 'Beans'], regions: ['Bungoma', 'Kakamega', 'Trans Nzoia'], seasons: ['Long Rains'], riskCategories: ['Group Guaranteed', 'New Borrower'] },
  { id: 'oaf-solar-addon', name: 'Solar Light Add-on', lenderId: 'one-acre-fund', minAmount: 2000, maxAmount: 15000, interestRate: 0, term: 9, eligibilityNotes: 'Solar lighting bundled with input package.', crops: [], regions: ['Bungoma', 'Kakamega'], seasons: [], riskCategories: ['Group Guaranteed'] },
  // Apollo Agriculture
  { id: 'apollo-input-bundle', name: 'Apollo Input Bundle', lenderId: 'apollo-agriculture', minAmount: 8000, maxAmount: 120000, interestRate: 0, term: 9, eligibilityNotes: 'Satellite-underwritten inputs + advice; one-off finance charge.', crops: ['Maize'], regions: ['Nakuru', 'Uasin Gishu', 'Narok', 'Bungoma'], seasons: ['Long Rains'], riskCategories: ['New Borrower'] },
  { id: 'apollo-returning', name: 'Apollo Returning Farmer Bundle', lenderId: 'apollo-agriculture', minAmount: 15000, maxAmount: 250000, interestRate: 0, term: 9, eligibilityNotes: 'Larger bundle for farmers who repaid a prior season.', crops: ['Maize', 'Potatoes'], regions: ['Nakuru', 'Uasin Gishu', 'Trans Nzoia'], seasons: ['Long Rains', 'Short Rains'], riskCategories: ['Returning Borrower'] },
  // Unaitas
  { id: 'unaitas-kilimo', name: 'Unaitas Kilimo Loan', lenderId: 'unaitas', minAmount: 20000, maxAmount: 300000, interestRate: 17, term: 18, eligibilityNotes: 'Member loan against share contributions.', crops: ['Maize', 'Beans', 'Potatoes', 'Coffee'], regions: ['Murang’a', 'Nyeri', 'Kirinyaga'], seasons: [], riskCategories: ['Returning Borrower'] },
  // Wakulima Dairy SACCO
  { id: 'wakulima-milk-advance', name: 'Milk Cheque Advance', lenderId: 'wakulima-dairy', minAmount: 5000, maxAmount: 100000, interestRate: 14, term: 6, eligibilityNotes: 'Advance against monthly milk deliveries.', crops: ['Dairy'], regions: ['Nyeri', 'Murang’a'], seasons: [], riskCategories: ['Returning Borrower'] },
  { id: 'wakulima-feed', name: 'Dairy Feed Loan', lenderId: 'wakulima-dairy', minAmount: 8000, maxAmount: 120000, interestRate: 15, term: 12, eligibilityNotes: 'Working capital for dairy meal and fodder.', crops: ['Dairy'], regions: ['Nyeri', 'Murang’a', 'Kiambu'], seasons: ['Dry Season'], riskCategories: ['Group Guaranteed'] },
];

const FARMERS: SeedFarmer[] = [
  {
    id: 'farmer-amina', name: 'Amina Wanjiru', farmSize: 1.5, location: 'Nakuru', language: 'sw',
    financialHistory: 'First-time borrower; sells maize at the local market.',
    crops: ['Maize', 'Beans'], region: 'Nakuru', seasons: ['Long Rains'], repaidProductIds: [],
  },
  {
    id: 'farmer-joseph', name: 'Joseph Kiprono', farmSize: 6, location: 'Uasin Gishu', language: 'en',
    financialHistory: 'Repaid two prior input loans on time; commercial maize farmer.',
    crops: ['Maize', 'Wheat'], region: 'Uasin Gishu', seasons: ['Long Rains'],
    repaidProductIds: ['apollo-input-bundle', 'faulu-maize-cycle'],
  },
  {
    id: 'farmer-grace', name: 'Grace Mwende', farmSize: 0.8, location: 'Meru', language: 'sw',
    financialHistory: 'Dairy and coffee; member of a local cooperative.',
    crops: ['Dairy', 'Coffee'], region: 'Meru', seasons: ['Short Rains'], repaidProductIds: [],
  },
];

async function seed(): Promise<void> {
  await initSchema();
  const session = getDriver().session();
  try {
    // Reference nodes ------------------------------------------------------
    const crops = [...new Set(PRODUCTS.flatMap((p) => p.crops).concat(FARMERS.flatMap((f) => f.crops)))];
    const regions = [...new Set(
      LENDERS.flatMap((l) => l.regions)
        .concat(PRODUCTS.flatMap((p) => p.regions))
        .concat(FARMERS.map((f) => f.region)),
    )];

    await session.run('UNWIND $names AS name MERGE (:Crop {name: name})', { names: crops });
    await session.run('UNWIND $names AS name MERGE (:Region {name: name})', { names: regions });
    await session.run('UNWIND $names AS name MERGE (:Season {name: name})', { names: SEASONS });
    await session.run('UNWIND $names AS name MERGE (:RiskCategory {name: name})', { names: RISK_CATEGORIES });

    // Lenders + OPERATES_IN ------------------------------------------------
    await session.run(
      `UNWIND $lenders AS l
       MERGE (lender:Lender {id: l.id})
         SET lender.name = l.name, lender.type = l.type
       WITH lender, l
       UNWIND l.regions AS regionName
         MATCH (r:Region {name: regionName})
         MERGE (lender)-[:OPERATES_IN]->(r)`,
      { lenders: LENDERS },
    );

    // Loan products + OFFERED_BY + QUALIFIES_FOR ---------------------------
    await session.run(
      `UNWIND $products AS p
       MERGE (product:LoanProduct {id: p.id})
         SET product.name = p.name,
             product.minAmount = p.minAmount,
             product.maxAmount = p.maxAmount,
             product.interestRate = p.interestRate,
             product.term = p.term,
             product.eligibilityNotes = p.eligibilityNotes
       WITH product, p
       MATCH (lender:Lender {id: p.lenderId})
       MERGE (product)-[:OFFERED_BY]->(lender)
       WITH product, p
       FOREACH (name IN p.crops          | MERGE (c:Crop {name: name})         MERGE (product)-[:QUALIFIES_FOR]->(c))
       FOREACH (name IN p.regions        | MERGE (r:Region {name: name})       MERGE (product)-[:QUALIFIES_FOR]->(r))
       FOREACH (name IN p.seasons        | MERGE (s:Season {name: name})       MERGE (product)-[:QUALIFIES_FOR]->(s))
       FOREACH (name IN p.riskCategories | MERGE (rc:RiskCategory {name: name}) MERGE (product)-[:QUALIFIES_FOR]->(rc))`,
      { products: PRODUCTS },
    );

    // Sample farmers + relationships --------------------------------------
    const now = new Date().toISOString();
    await session.run(
      `UNWIND $farmers AS fr
       MERGE (f:Farmer {id: fr.id})
         SET f.name = fr.name,
             f.farmSize = fr.farmSize,
             f.location = fr.location,
             f.financialHistory = fr.financialHistory,
             f.language = fr.language,
             f.createdAt = coalesce(f.createdAt, $now),
             f.updatedAt = $now
       WITH f, fr
       MATCH (r:Region {name: fr.region})
       MERGE (f)-[:LOCATED_IN]->(r)
       WITH f, fr
       FOREACH (name IN fr.crops   | MERGE (c:Crop {name: name})   MERGE (f)-[:GROWS]->(c))
       FOREACH (name IN fr.seasons | MERGE (s:Season {name: name}) MERGE (f)-[:HARVESTS_IN]->(s))
       FOREACH (pid IN fr.repaidProductIds | MERGE (p:LoanProduct {id: pid}) MERGE (f)-[:HISTORICALLY_REPAID]->(p))`,
      { farmers: FARMERS, now },
    );

    // Summary --------------------------------------------------------------
    const counts = await session.run(
      `MATCH (l:Lender) WITH count(l) AS lenders
       MATCH (p:LoanProduct) WITH lenders, count(p) AS products
       MATCH (f:Farmer) WITH lenders, products, count(f) AS farmers
       RETURN lenders, products, farmers`,
    );
    const r = counts.records[0];
    console.log(
      `Seeded graph ✅  lenders=${r.get('lenders')}  products=${r.get('products')}  farmers=${r.get('farmers')}`,
    );
  } finally {
    await session.close();
    await closeDriver();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
