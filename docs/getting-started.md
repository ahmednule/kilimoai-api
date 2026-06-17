# Getting Started

This guide takes you from a fresh clone to a running, verified server. For
deeper detail on any step, follow the links to the other guides.

## Prerequisites

| Tool        | Version    | Notes                                                        |
| ----------- | ---------- | ------------------------------------------------------------ |
| **Node.js** | 18+        | Developed and tested on Node 20–24.                          |
| **pnpm**    | 9+         | Enable via Corepack: `corepack enable pnpm`.                 |
| **Docker**  | any recent | For running Neo4j locally. Skip if you use [Neo4j Aura](./database-setup.md#option-c--neo4j-aura-managed-cloud). |

Check what you have:

```bash
node -v          # v18 or newer
corepack enable pnpm && pnpm -v
docker --version
```

## 1. Install dependencies

```bash
pnpm install
```

If you ever see `ERR_PNPM_IGNORED_BUILDS`, see
[Troubleshooting](./troubleshooting.md#err_pnpm_ignored_builds).

## 2. Start the database

From the project root:

```bash
docker compose up -d
```

This starts Neo4j 5 (defined in `docker-compose.yml`) on ports `7687` (Bolt,
used by the app) and `7474` (the browser UI). Wait until it's healthy:

```bash
docker compose ps        # STATUS should read "healthy"
```

Other ways to run Neo4j (plain Docker, Aura) are covered in
[Database Setup](./database-setup.md).

## 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and, at minimum:

- set **`JWT_SECRET`** to a strong random string, and
- make sure **`NEO4J_PASSWORD`** matches the password in `docker-compose.yml`
  (default `devpassword123`).

Generate a strong secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Every variable is documented in [Configuration](./configuration.md).

## 4. Run the server

Development (hot reload):

```bash
pnpm dev
```

You should see:

```
Connected to Neo4j
Server running at http://localhost:4000
GraphQL endpoint: http://localhost:4000/graphql
```

On startup the app verifies the database connection and creates the uniqueness
constraints it needs. If it can't reach Neo4j it exits with a
`ServiceUnavailable` error — see
[Troubleshooting](./troubleshooting.md#failed-to-start-server--serviceunavailable).

## 5. Verify it works

```bash
# Health check
curl http://localhost:4000/health
# → {"status":"ok","timestamp":"..."}

# Create a user
curl -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation { signup(email:\"dev@kilimo.ai\", password:\"secret123\", name:\"Dev\") { token user { id email name } } }"}'
```

Or open the Apollo sandbox in your browser at
<http://localhost:4000/graphql>. See [GraphQL API](./graphql-api.md) for all
operations.

## Running in production

```bash
pnpm run build   # compile TypeScript to dist/
pnpm start       # node dist/index.js
```

Provide the same environment variables in your hosting environment. See
[Configuration](./configuration.md) and the deployment notes in
[Database Setup](./database-setup.md#production-databases).

## Next steps

- [Database Setup](./database-setup.md) — data model, persistence, Aura
- [GraphQL API](./graphql-api.md) — queries, mutations, auth headers
- [Troubleshooting](./troubleshooting.md) — when something doesn't work
