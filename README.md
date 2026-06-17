# Express GraphQL API with Authentication (Neo4j)

A GraphQL API built with Express.js, Apollo Server 5, and a **Neo4j** graph
database, with JWT authentication and TypeScript.

## Features

- **GraphQL API** with Apollo Server 5
- **Authentication** using JWT tokens with bcrypt password hashing
- **Neo4j graph database** via the official `neo4j-driver`
- **TypeScript** for type safety across the stack
- **Express Middleware** for authentication and CORS

## Project Structure

```
src/
├── db/
│   └── neo4j.ts       # Neo4j driver, connectivity check, schema constraints
├── graphql/
│   ├── schema.ts      # GraphQL type definitions
│   └── resolvers.ts   # GraphQL resolver implementations
├── services/
│   └── AuthService.ts # Authentication business logic (Cypher queries)
├── middleware/
│   └── auth.ts        # JWT authentication middleware
├── types/
│   └── index.ts       # TypeScript type definitions
└── index.ts           # Express server entry point
```

### Data model

A single node label is used:

```
(:User {
  id:        String  // UUID, unique
  email:     String  // unique
  name:      String
  password:  String  // bcrypt hash
  createdAt: String  // ISO 8601
  updatedAt: String  // ISO 8601
})
```

On startup the app ensures uniqueness constraints exist on `User.email` and
`User.id` (see `src/db/neo4j.ts` → `initSchema`), so you don't need to create
them by hand.

## Quick Start

```bash
corepack enable pnpm                       # makes the `pnpm` command available
git clone <repository-url> kilimoai-api && cd kilimoai-api
pnpm install
docker run -d --name kilimo-neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/change-this-password \
  neo4j:5                                  # start Neo4j locally
cp .env.example .env                       # then set NEO4J_PASSWORD + JWT_SECRET
pnpm dev                                   # http://localhost:4000/graphql
```

## Installation

### Prerequisites

- **Node.js 18+** (developed and tested on Node 20–24)
- **pnpm 9+** — easiest via Corepack, which ships with Node:
  ```bash
  corepack enable pnpm
  ```
- **A Neo4j 5 database** — run one locally with Docker (below) or use a managed
  instance such as [Neo4j Aura](https://neo4j.com/cloud/aura/).

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start Neo4j

**Option A — Docker (recommended for local dev):**

```bash
docker run -d --name kilimo-neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/change-this-password \
  neo4j:5
```

- `7687` is the Bolt protocol port the app connects to.
- `7474` is the Neo4j Browser UI — open <http://localhost:7474> and log in with
  `neo4j` / `change-this-password` to inspect data.
- To persist data across container restarts, add `-v "$PWD/neo4j-data:/data"`.

**Option B — Neo4j Aura (managed cloud):**

Create a free instance at <https://neo4j.com/cloud/aura/>. Aura gives you a
connection URI that starts with `neo4j+s://` plus a generated password — use
those values in `.env` below.

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```ini
# Neo4j connection
NEO4J_URI="bolt://localhost:7687"     # or neo4j+s://<id>.databases.neo4j.io for Aura
NEO4J_USER="neo4j"
NEO4J_PASSWORD="change-this-password"

# Auth
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRY="7d"

# Server
NODE_ENV="development"
PORT=4000
```

Generate a strong `JWT_SECRET` with:
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Development

Start the development server with hot reload:

```bash
pnpm dev
```

On boot the server verifies the Neo4j connection and creates the required
constraints, then logs:

```
Connected to Neo4j
Server running at http://localhost:4000
GraphQL endpoint: http://localhost:4000/graphql
```

### Verify it's working

Open <http://localhost:4000/graphql> for the Apollo sandbox, or smoke-test from
the terminal:

```bash
# Health check
curl http://localhost:4000/health

# Create a user
curl -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation { signup(email:\"dev@kilimo.ai\", password:\"secret123\", name:\"Dev\") { token user { id email name } } }"}'
```

### Inspecting the database

Open the Neo4j Browser at <http://localhost:7474> and run:

```cypher
MATCH (u:User) RETURN u;
```

## GraphQL Operations

### Signup

```graphql
mutation {
  signup(email: "user@example.com", password: "password123", name: "John Doe") {
    token
    user {
      id
      email
      name
    }
  }
}
```

### Login

```graphql
mutation {
  login(email: "user@example.com", password: "password123") {
    token
    user {
      id
      email
      name
    }
  }
}
```

### Get Current User (requires authentication)

```graphql
query {
  me {
    id
    email
    name
  }
}
```

Add the token to the request headers:

```
Authorization: Bearer <token>
```

### Get User by ID (requires authentication)

```graphql
query {
  user(id: "00000000-0000-0000-0000-000000000000") {
    id
    email
    name
  }
}
```

## Building for Production

```bash
pnpm run build   # compiles TypeScript to dist/
pnpm start       # runs node dist/index.js
```

## Deployment

The app connects to Neo4j over Bolt, so any host that can reach your database
works. For a managed database, [Neo4j Aura](https://neo4j.com/cloud/aura/) is
the simplest option.

Set these environment variables in your hosting provider:

- `NEO4J_URI` (e.g. `neo4j+s://<id>.databases.neo4j.io`)
- `NEO4J_USER`
- `NEO4J_PASSWORD`
- `JWT_SECRET`
- `JWT_EXPIRY` (optional, defaults to `24h`)

> **Note on serverless (e.g. Vercel):** the Neo4j driver holds a long-lived
> connection pool, which doesn't map cleanly onto short-lived serverless
> functions. A long-running host (Render, Railway, Fly.io, a container, etc.) is
> a better fit for this server.

## Security Considerations

- Change `JWT_SECRET` to a strong random value (min 32 characters)
- Never commit real `.env` values; only `.env.example` is tracked
- Use HTTPS / `neo4j+s://` (encrypted Bolt) in production
- Implement rate limiting for authentication endpoints
- Add input validation and sanitization
- Consider adding refresh tokens for longer sessions

## Future Enhancements

- [ ] Refresh tokens implementation
- [ ] Email verification
- [ ] Password reset functionality
- [ ] Role-based access control (RBAC)
- [ ] Rate limiting
- [ ] Logging and monitoring
- [ ] Unit and integration tests
- [ ] Model relationships between nodes (the reason for choosing a graph DB)
- [ ] Add CI/CD pipeline

## Troubleshooting

### `pnpm: command not found`
- Enable it via Corepack: `corepack enable pnpm` (ships with Node 18+).

### `Failed to start server` / connection refused
- Make sure Neo4j is running: `docker ps` should list `kilimo-neo4j`.
- Check `NEO4J_URI`, `NEO4J_USER`, and `NEO4J_PASSWORD` in `.env` match how the
  database was started.
- For Aura, the URI must use the `neo4j+s://` scheme.

### `Neo.ClientError.Security.Unauthorized`
- The username/password in `.env` don't match the database. For the Docker
  container, they're set by the `NEO4J_AUTH=neo4j/<password>` flag.

### Build Errors
- Run `pnpm install` to ensure all dependencies are installed
- Check that all relative imports use `.js` extensions (required for the compiled output)

## License

MIT
