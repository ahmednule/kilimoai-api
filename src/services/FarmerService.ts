import { randomUUID } from 'crypto';
import { Driver } from 'neo4j-driver';
import {
  FarmerWithRelations,
  OnboardFarmerInput,
  LoanProduct,
  Lender,
} from '../types/index.js';
import { toNumber, normaliseProduct } from '../db/mappers.js';

/**
 * Reads and writes Farmer nodes and their eligibility relationships, plus the
 * loan-product catalogue, for the GraphQL layer (see docs/PRD.md §6, §8).
 *
 * Onboarding is farmer-facing: the conversational assistant captures attributes
 * and calls onboardFarmer, which creates the Farmer node and its GROWS /
 * LOCATED_IN / HARVESTS_IN edges. Crop/Region/Season reference nodes are MERGEd
 * (their name uniqueness constraints make this idempotent).
 */
export class FarmerService {
  constructor(private driver: Driver) {}

  async onboardFarmer(input: OnboardFarmerInput): Promise<FarmerWithRelations> {
    const session = this.driver.session();
    try {
      const now = new Date().toISOString();
      const id = randomUUID();
      const result = await session.run(
        `CREATE (f:Farmer {
           id: $id,
           name: $name,
           farmSize: $farmSize,
           location: $location,
           financialHistory: $financialHistory,
           language: $language,
           createdAt: $now,
           updatedAt: $now
         })
         WITH f
         MERGE (r:Region {name: $region})
         MERGE (f)-[:LOCATED_IN]->(r)
         FOREACH (name IN $crops   | MERGE (c:Crop {name: name})   MERGE (f)-[:GROWS]->(c))
         FOREACH (name IN $seasons | MERGE (s:Season {name: name}) MERGE (f)-[:HARVESTS_IN]->(s))
         RETURN f,
           [(f)-[:GROWS]->(c:Crop)         | c.name] AS crops,
           [(f)-[:LOCATED_IN]->(rg:Region) | rg.name][0] AS region,
           [(f)-[:HARVESTS_IN]->(s:Season) | s.name] AS seasons`,
        {
          id,
          name: input.name,
          farmSize: input.farmSize,
          location: input.location,
          financialHistory: input.financialHistory ?? '',
          language: input.language ?? 'en',
          region: input.region,
          crops: input.crops,
          seasons: input.seasons,
          now,
        },
      );
      return this.toFarmer(result.records[0]);
    } finally {
      await session.close();
    }
  }

  async getFarmerById(id: string): Promise<FarmerWithRelations | null> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (f:Farmer {id: $id})
         RETURN f,
           [(f)-[:GROWS]->(c:Crop)         | c.name] AS crops,
           [(f)-[:LOCATED_IN]->(rg:Region) | rg.name][0] AS region,
           [(f)-[:HARVESTS_IN]->(s:Season) | s.name] AS seasons`,
        { id },
      );
      if (result.records.length === 0) return null;
      return this.toFarmer(result.records[0]);
    } finally {
      await session.close();
    }
  }

  async listLoanProducts(): Promise<LoanProduct[]> {
    const session = this.driver.session();
    try {
      const result = await session.run('MATCH (p:LoanProduct) RETURN p ORDER BY p.name');
      return result.records.map((r) => normaliseProduct(r.get('p').properties));
    } finally {
      await session.close();
    }
  }

  async getLoanProductById(id: string): Promise<LoanProduct | null> {
    const session = this.driver.session();
    try {
      const result = await session.run('MATCH (p:LoanProduct {id: $id}) RETURN p', { id });
      if (result.records.length === 0) return null;
      return normaliseProduct(result.records[0].get('p').properties);
    } finally {
      await session.close();
    }
  }

  /** Resolves the lender that offers a product (LoanProduct.lender field). */
  async getLenderForProduct(productId: string): Promise<Lender | null> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (:LoanProduct {id: $productId})-[:OFFERED_BY]->(l:Lender) RETURN l',
        { productId },
      );
      if (result.records.length === 0) return null;
      return result.records[0].get('l').properties as Lender;
    } finally {
      await session.close();
    }
  }

  private toFarmer(rec: any): FarmerWithRelations {
    const props = rec.get('f').properties;
    return {
      id: props.id,
      name: props.name,
      farmSize: toNumber(props.farmSize),
      location: props.location,
      financialHistory: props.financialHistory,
      language: props.language,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      crops: rec.get('crops') as string[],
      region: (rec.get('region') as string | null) ?? null,
      seasons: rec.get('seasons') as string[],
    };
  }
}
