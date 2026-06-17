# Express GraphQL API with Authentication

A production-ready Express.js GraphQL API with Prisma ORM, JWT authentication, and TypeScript.

## Features

- **GraphQL API** with Apollo Server 5
- **Authentication** using JWT tokens with bcrypt password hashing
- **Database ORM** with Prisma and SQLite
- **TypeScript** for type safety across the stack
- **Express Middleware** for authentication and CORS
- **Vercel Deployment** ready configuration

## Project Structure

```
src/
├── graphql/
│   ├── schema.ts      # GraphQL type definitions
│   └── resolvers.ts   # GraphQL resolver implementations
├── services/
│   └── AuthService.ts # Authentication business logic
├── middleware/
│   └── auth.ts        # JWT authentication middleware
├── types/
│   └── index.ts       # TypeScript type definitions
└── index.ts           # Express server entry point

prisma/
├── schema.prisma      # Prisma database schema
└── migrations/        # Database migrations
```

## Quick Start

For the impatient — the full sequence that takes you from a fresh clone to a
running server (each step is explained in detail below):

```bash
corepack enable pnpm            # makes the `pnpm` command available
git clone <repository-url> kilimoai-api && cd kilimoai-api
pnpm install                    # if it warns about "Ignored build scripts", see step 3
cp .env.example .env            # then edit .env and set a strong JWT_SECRET
pnpm exec prisma migrate dev    # creates dev.db and applies migrations
pnpm dev                        # http://localhost:4000/graphql
```

## Installation

### Prerequisites

- **Node.js 18+** (developed and tested on Node 20–24)
- **pnpm 9+** — this repo is pinned to pnpm. The easiest way to get it is
  Corepack, which ships with Node:
  ```bash
  corepack enable pnpm
  ```
  (Alternatively: `npm install -g pnpm`.)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url> kilimoai-api
   cd kilimoai-api
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Approve native build scripts (pnpm 10+ only)**

   For security, recent pnpm versions do **not** run dependency build scripts by
   default. If you see a message like:

   ```
   [ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: @prisma/client, prisma, esbuild, ...
   ```

   then Prisma's client was not generated and `tsx`/`esbuild` won't run. Approve
   the builds once and reinstall:

   ```bash
   pnpm approve-builds        # interactive — select all and confirm
   pnpm install
   ```

   This repo already ships a `pnpm-workspace.yaml` that allow-lists these builds
   (`@prisma/client`, `prisma`, `@prisma/engines`, `esbuild`, `@apollo/protobufjs`),
   so on a clean clone the scripts should run automatically. The manual step above
   is only needed if your local pnpm still blocks them.

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set `JWT_SECRET` to a strong random string (min 32 chars).
   The defaults look like this:

   ```ini
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="your-super-secret-jwt-key-change-in-production"
   JWT_EXPIRY="7d"
   NODE_ENV="development"
   # Optional — server defaults to 4000 if unset
   # PORT=4000
   ```

   Generate a strong secret with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

5. **Create the database**

   This generates the Prisma client and applies the existing migration, creating
   the local SQLite file (`dev.db`):

   ```bash
   pnpm exec prisma migrate dev
   ```

   (If you only want to regenerate the Prisma client without touching the DB, run
   `pnpm exec prisma generate`.)

## Development

Start the development server with hot reload:

```bash
pnpm dev
```

The server will run at `http://localhost:4000` with GraphQL endpoint at `/graphql`.

### Verify it's working

Open `http://localhost:4000/graphql` in your browser for the Apollo sandbox, or
smoke-test from the terminal:

```bash
# Health check
curl http://localhost:4000/health

# Create a user
curl -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation { signup(email:\"dev@kilimo.ai\", password:\"secret123\", name:\"Dev\") { token user { id email name } } }"}'
```

### Database Management

View and manage your database using Prisma Studio:
```bash
pnpm exec prisma studio
```

Create a new migration after schema changes:
```bash
pnpm exec prisma migrate dev --name <migration-name>
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

Add the token to the GraphQL request header:
```
Authorization: Bearer <token>
```

### Get User by ID
```graphql
query {
  user(id: "user-id") {
    id
    email
    name
  }
}
```

## Building for Production

Build the TypeScript code:
```bash
pnpm run build
```

The compiled code will be in the `dist/` directory.

## Deployment to Vercel

### Method 1: Using Vercel CLI

1. Install Vercel CLI
```bash
npm i -g vercel
```

2. Deploy
```bash
vercel
```

3. Set environment variables in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add `JWT_SECRET` with a strong random string

### Method 2: GitHub Integration

1. Push your code to GitHub
2. Import the project in Vercel dashboard
3. Add environment variables: `JWT_SECRET`
4. Deploy

### Important Notes for Vercel Deployment

- **SQLite Database**: SQLite works with Vercel but data is ephemeral. For production, migrate to PostgreSQL (Supabase, Neon, or Vercel Postgres).
- **Environment Variables**: Set `JWT_SECRET` in Vercel dashboard
- **Prisma**: Migrations run automatically during deployment

## Security Considerations

- Change `JWT_SECRET` to a strong random value (min 32 characters)
- Use HTTPS only in production
- Implement rate limiting for authentication endpoints
- Add input validation and sanitization
- Use environment variables for sensitive data
- Consider adding refresh tokens for longer sessions

## Future Enhancements

- [ ] Refresh tokens implementation
- [ ] Email verification
- [ ] Password reset functionality
- [ ] Role-based access control (RBAC)
- [ ] Rate limiting
- [ ] Logging and monitoring
- [ ] Unit and integration tests
- [ ] Migrate to PostgreSQL for production
- [ ] Add CI/CD pipeline

## Troubleshooting

### `ERR_PNPM_IGNORED_BUILDS` / Prisma client not found
- pnpm 10+ blocks dependency build scripts by default, so the Prisma client is
  never generated. Run `pnpm approve-builds` (select all), then `pnpm install`.
  See step 3 of [Setup](#setup).

### `pnpm: command not found`
- Enable it via Corepack: `corepack enable pnpm` (ships with Node 18+).

### Database Connection Issues
- Ensure `DATABASE_URL` is set correctly in `.env`
- Check that `dev.db` file exists in project root
- Run `pnpm exec prisma migrate dev` to create the schema

### JWT Token Errors
- Verify `JWT_SECRET` is set in environment
- Check that the token is sent in the `Authorization: Bearer <token>` header
- Ensure the token hasn't expired. Note: tokens are currently signed with a
  hard-coded 24h expiry in `AuthService.ts`; the `JWT_EXPIRY` env var is not yet
  wired up.

### Build Errors
- Run `pnpm install` to ensure all dependencies are installed
- Run `pnpm exec prisma generate` to generate the Prisma client
- Check that all imports use `.js` extensions in compiled code

## License

MIT
