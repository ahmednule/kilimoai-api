# Documentation

Guides for setting up, configuring, and running the Kilimo AI API — an
Express + Apollo GraphQL server backed by a Neo4j graph database.

## Contents

0. [Product Requirements (PRD)](./PRD.md) — what we're building for the Kenya AI
   Challenge 2026 and why: the vision, scope, data model, sprint plan, and risks.
1. [Getting Started](./getting-started.md) — the fastest path from a fresh
   clone to a running server.
2. [Database Setup](./database-setup.md) — running Neo4j with Docker Compose,
   plain Docker, or Neo4j Aura, plus the data model and how to inspect data.
3. [Configuration](./configuration.md) — every environment variable explained.
4. [GraphQL API](./graphql-api.md) — the available queries and mutations, with
   examples and authentication details.
5. [Troubleshooting](./troubleshooting.md) — common errors and how to fix them.

## At a glance

```bash
corepack enable pnpm           # 1. get pnpm
pnpm install                   # 2. install deps
docker compose up -d           # 3. start Neo4j
cp .env.example .env           # 4. configure (set JWT_SECRET + NEO4J_PASSWORD)
pnpm dev                       # 5. run → http://localhost:4000/graphql
```

See [Getting Started](./getting-started.md) for the full walk-through.
