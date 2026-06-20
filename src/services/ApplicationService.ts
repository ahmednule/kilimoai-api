import { randomUUID, randomBytes } from 'crypto';
import { Driver } from 'neo4j-driver';
import {
  ApplyForLoanInput,
  LoanApplication,
  FarmerWithRelations,
  LoanProduct,
  Lender,
} from '../types/index.js';
import { toNumber } from '../db/mappers.js';
import { FarmerService } from './FarmerService.js';
import { MatchingService } from './MatchingService.js';
import { RepaymentService } from './RepaymentService.js';

/**
 * Initiates and reads loan applications (see docs/PRD.md §6 step 6, FR6).
 *
 * Applying creates an Application node linked to the farmer and the product
 * ((:Farmer)-[:SUBMITTED]->(:Application)-[:FOR_PRODUCT]->(:LoanProduct)) and
 * assembles a pre-filled, ready-to-submit document from the graph plus an
 * indicative repayment plan. In keeping with the project's "decision support,
 * not a lender" stance, an application is accepted even if the farmer does not
 * fully qualify — eligibility is reported, the lender decides.
 */
export class ApplicationService {
  constructor(
    private driver: Driver,
    private farmers: FarmerService,
    private matching: MatchingService,
    private repayments: RepaymentService,
  ) {}

  async apply(input: ApplyForLoanInput): Promise<LoanApplication> {
    const farmer = await this.farmers.getFarmerById(input.farmerId);
    if (!farmer) throw new Error(`Farmer not found: ${input.farmerId}`);

    const product = await this.farmers.getLoanProductById(input.productId);
    if (!product) throw new Error(`Loan product not found: ${input.productId}`);

    if (input.requestedAmount < product.minAmount || input.requestedAmount > product.maxAmount) {
      throw new Error(
        `Requested amount must be between KES ${product.minAmount} and KES ${product.maxAmount} for ${product.name}`,
      );
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    const referenceNumber = `KLM-${randomBytes(3).toString('hex').toUpperCase()}`;

    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (f:Farmer {id: $farmerId})
         MATCH (p:LoanProduct {id: $productId})
         CREATE (a:Application {
           id: $id,
           referenceNumber: $referenceNumber,
           status: 'SUBMITTED',
           requestedAmount: $requestedAmount,
           createdAt: $now,
           updatedAt: $now
         })
         CREATE (f)-[:SUBMITTED]->(a)
         CREATE (a)-[:FOR_PRODUCT]->(p)`,
        {
          farmerId: input.farmerId,
          productId: input.productId,
          id,
          referenceNumber,
          requestedAmount: input.requestedAmount,
          now,
        },
      );
    } finally {
      await session.close();
    }

    return this.assemble(
      { id, referenceNumber, status: 'SUBMITTED', requestedAmount: input.requestedAmount, createdAt: now, updatedAt: now },
      farmer,
      product,
    );
  }

  async getApplicationById(id: string): Promise<LoanApplication | null> {
    const session = this.driver.session();
    let farmerId: string;
    let productId: string;
    let props: any;
    try {
      const result = await session.run(
        `MATCH (f:Farmer)-[:SUBMITTED]->(a:Application {id: $id})-[:FOR_PRODUCT]->(p:LoanProduct)
         RETURN a, f.id AS farmerId, p.id AS productId`,
        { id },
      );
      if (result.records.length === 0) return null;
      const rec = result.records[0];
      props = rec.get('a').properties;
      farmerId = rec.get('farmerId');
      productId = rec.get('productId');
    } finally {
      await session.close();
    }

    const farmer = await this.farmers.getFarmerById(farmerId);
    const product = await this.farmers.getLoanProductById(productId);
    if (!farmer || !product) return null;
    return this.assemble(normaliseApplication(props), farmer, product);
  }

  async listForFarmer(farmerId: string): Promise<LoanApplication[]> {
    const session = this.driver.session();
    let rows: { props: any; productId: string }[];
    try {
      const result = await session.run(
        `MATCH (f:Farmer {id: $farmerId})-[:SUBMITTED]->(a:Application)-[:FOR_PRODUCT]->(p:LoanProduct)
         RETURN a, p.id AS productId ORDER BY a.createdAt DESC`,
        { farmerId },
      );
      rows = result.records.map((r) => ({ props: r.get('a').properties, productId: r.get('productId') }));
    } finally {
      await session.close();
    }

    const farmer = await this.farmers.getFarmerById(farmerId);
    if (!farmer) return [];

    const out: LoanApplication[] = [];
    for (const row of rows) {
      const product = await this.farmers.getLoanProductById(row.productId);
      if (product) out.push(await this.assemble(normaliseApplication(row.props), farmer, product));
    }
    return out;
  }

  /** Loads the lender + eligibility and builds the document for an application. */
  private async assemble(
    app: { id: string; referenceNumber: string; status: string; requestedAmount: number; createdAt: string; updatedAt: string },
    farmer: FarmerWithRelations,
    product: LoanProduct,
  ): Promise<LoanApplication> {
    const lender = (await this.farmers.getLenderForProduct(product.id)) ?? { id: '', name: 'Unknown', type: '' };
    const qualifies = await this.farmerQualifies(farmer.id, product.id);

    return {
      ...app,
      farmer,
      product,
      lender,
      qualifies,
      document: this.buildDocument(app, farmer, product, lender, qualifies),
    };
  }

  /** True if the product appears as a qualifying match for the farmer. */
  private async farmerQualifies(farmerId: string, productId: string): Promise<boolean> {
    const matches = await this.matching.matchFarmer(farmerId, { includeNearMisses: true, limit: 100 });
    const m = matches.find((x) => x.product.id === productId);
    return Boolean(m?.qualifies);
  }

  private buildDocument(
    app: { referenceNumber: string; status: string; requestedAmount: number; createdAt: string },
    farmer: FarmerWithRelations,
    product: LoanProduct,
    lender: Lender,
    qualifies: boolean,
  ): string {
    let repayment = '';
    try {
      const sim = this.repayments.simulate(product, { productId: product.id, principal: app.requestedAmount });
      repayment = sim.summary;
    } catch {
      repayment = 'Repayment plan unavailable for the requested amount.';
    }

    return [
      'KILIMO AI — LOAN APPLICATION',
      `Reference: ${app.referenceNumber}`,
      `Date: ${app.createdAt}`,
      `Status: ${app.status}`,
      '',
      'APPLICANT',
      `  Name: ${farmer.name}`,
      `  Region: ${farmer.region ?? farmer.location}`,
      `  Farm size: ${farmer.farmSize} acres`,
      `  Crops: ${farmer.crops.join(', ') || '—'}`,
      `  Harvest season(s): ${farmer.seasons.join(', ') || '—'}`,
      '',
      'PRODUCT',
      `  Lender: ${lender.name} (${lender.type})`,
      `  Product: ${product.name}`,
      `  Requested amount: KES ${fmt(app.requestedAmount)}`,
      `  Terms: ${product.interestRate}% p.a. over ${product.term} months`,
      '',
      'ELIGIBILITY',
      `  Currently qualifies: ${qualifies ? 'Yes' : 'No (lender to review)'}`,
      '',
      'INDICATIVE REPAYMENT',
      `  ${repayment}`,
    ].join('\n');
  }
}

function normaliseApplication(props: any) {
  return {
    id: props.id,
    referenceNumber: props.referenceNumber,
    status: props.status,
    requestedAmount: toNumber(props.requestedAmount),
    createdAt: props.createdAt,
    updatedAt: props.updatedAt,
  };
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-KE');
}
