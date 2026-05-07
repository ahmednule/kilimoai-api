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

## Installation

### Prerequisites
- Node.js 18+ 
- pnpm (or npm/yarn)

### Setup

1. Clone the repository
```bash
git clone <repository-url>
cd express-graphql-auth
```

2. Install dependencies
```bash
pnpm install
```

3. Generate Prisma Client
```bash
pnpm exec prisma generate
```

4. Create the database
```bash
pnpm exec prisma migrate dev --name init
```

5. Set up environment variables
```bash
cp .env.example .env
```

Edit `.env` and set `JWT_SECRET` to a strong random string:
```
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-super-secret-key-change-this"
PORT=4000
```

## Development

Start the development server with hot reload:

```bash
pnpm dev
```

The server will run at `http://localhost:4000` with GraphQL endpoint at `/graphql`.

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

### Database Connection Issues
- Ensure `DATABASE_URL` is set correctly in `.env`
- Check that `dev.db` file exists in project root
- Run `pnpm exec prisma migrate dev --name init` to create schema

### JWT Token Errors
- Verify `JWT_SECRET` is set in environment
- Check that token is sent in `Authorization: Bearer <token>` header
- Ensure token hasn't expired (24 hours)

### Build Errors
- Run `pnpm install` to ensure all dependencies are installed
- Run `pnpm exec prisma generate` to generate Prisma client
- Check that all imports use `.js` extensions in compiled code

## License

MIT
