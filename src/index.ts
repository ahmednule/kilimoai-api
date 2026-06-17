import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { expressMiddleware } from '@as-integrations/express4';
import { typeDefs } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';
import { authMiddleware } from './middleware/auth.js';
import type { AuthRequest } from './middleware/auth.js';
import type { GraphQLContext } from './types/index.js';
import { verifyConnection, initSchema, closeDriver } from './db/neo4j.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(authMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Express GraphQL API',
    version: '1.0.0',
    endpoints: {
      graphql: '/graphql',
      health: '/health',
    },
  });
});

// Apollo Server setup
const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [ApolloServerPluginLandingPageLocalDefault({ footer: false })],
});

// Start Apollo Server
async function startServer() {
  // Fail fast if the database is unreachable, and make sure constraints exist.
  await verifyConnection();
  await initSchema();
  console.log('Connected to Neo4j');

  await apolloServer.start();

  app.use(
    '/graphql',
    expressMiddleware(apolloServer, {
      context: async ({ req }) => ({
        userId: (req as AuthRequest).userId,
      } as GraphQLContext),
    })
  );

  const server = app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
  });

  // Close the Neo4j driver cleanly on shutdown.
  const shutdown = async () => {
    server.close();
    await closeDriver();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch(async (error) => {
  console.error('Failed to start server:', error);
  await closeDriver();
  process.exit(1);
});
