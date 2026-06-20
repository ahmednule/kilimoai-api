import neo4j, { Driver } from 'neo4j-driver';
import { domainConstraints } from '../domain/schema.js';

let driver: Driver | null = null;

/**
 * Returns a lazily-initialised, shared Neo4j driver. The driver manages its own
 * connection pool, so a single instance should be reused across the whole app.
 */
export function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'neo4j';

    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }

  return driver;
}

/** Throws if the database cannot be reached — used as a startup health check. */
export async function verifyConnection(): Promise<void> {
  await getDriver().verifyConnectivity();
}

/**
 * Ensures the constraints the app relies on exist: the auth `User` constraints
 * plus every domain-graph constraint (see src/domain/schema.ts). Unique
 * constraints also create indexes, so lookups stay fast. All statements are
 * idempotent (`IF NOT EXISTS`), so this is safe to run on every startup.
 */
export async function initSchema(): Promise<void> {
  const session = getDriver().session();
  try {
    const statements = [
      'CREATE CONSTRAINT user_email_unique IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE',
      'CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE',
      // Speeds up verifyEmail's lookup by the pending token hash.
      'CREATE INDEX user_verification_token IF NOT EXISTS FOR (u:User) ON (u.verificationTokenHash)',
      ...domainConstraints,
    ];

    for (const statement of statements) {
      await session.run(statement);
    }
  } finally {
    await session.close();
  }
}

/** Closes the driver and its connection pool. Call once on shutdown. */
export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
