# Express GraphQL API with Authentication (Neo4j)

A GraphQL API built with Express.js, Apollo Server 5, and a **Neo4j** graph
database, with JWT authentication and TypeScript.

## Features

- **GraphQL API** with Apollo Server 5
- **Authentication** using JWT tokens with bcrypt password hashing
- **Neo4j graph database** via the official `neo4j-driver`
- **TypeScript** for type safety across the stack
- **Express Middleware** for authentication and CORS

## Documentation

Full guides live in [`docs/`](./docs):

- **[Getting Started](./docs/getting-started.md)** — from a fresh clone to a
  running server
- **[Database Setup](./docs/database-setup.md)** — Neo4j via Docker Compose,
  plain Docker, or Aura; the data model; inspecting data
- **[Configuration](./docs/configuration.md)** — every environment variable
- **[GraphQL API](./docs/graphql-api.md)** — queries, mutations, and auth
- **[Troubleshooting](./docs/troubleshooting.md)** — common errors and fixes

## Quick Start

```bash
corepack enable pnpm                       # makes the `pnpm` command available
git clone <repository-url> kilimoai-api && cd kilimoai-api
pnpm install                               # install dependencies
docker compose up -d                       # start Neo4j locally
cp .env.example .env                       # set JWT_SECRET + NEO4J_PASSWORD
pnpm dev                                   # http://localhost:4000/graphql
```

See **[Getting Started](./docs/getting-started.md)** for the full walk-through,
including prerequisites and verification.

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

docs/                  # Setup, configuration, API, and troubleshooting guides
docker-compose.yml     # Local Neo4j for development
```

### Data model

A single `User` node label is used:

```
(:User {
  id:        String  // UUID, unique
  email:     String  // unique
  name:      String
  password:  String  // bcrypt hash (never returned by the API)
  createdAt: String  // ISO 8601
  updatedAt: String  // ISO 8601
})
```

On startup the app ensures uniqueness constraints exist on `User.email` and
`User.id` (see `src/db/neo4j.ts` → `initSchema`), so you don't need to create
them by hand. More detail in [Database Setup](./docs/database-setup.md).

## Common commands

```bash
pnpm dev          # dev server with hot reload
pnpm run build    # compile TypeScript to dist/
pnpm start        # run the compiled server
pnpm run type-check
docker compose up -d   # start Neo4j
docker compose down    # stop Neo4j (data preserved)
```

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

## License

MIT
