import neo4j, { Driver } from 'neo4j-driver';

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
 * Ensures the constraints the app relies on exist. The unique constraint on
 * User.email also creates an index, so lookups by email stay fast.
 */
export async function initSchema(): Promise<void> {
  const session = getDriver().session();
  try {
    await session.run(
      'CREATE CONSTRAINT user_email_unique IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE'
    );
    await session.run(
      'CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE'
    );
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
