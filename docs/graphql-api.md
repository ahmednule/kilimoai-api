# GraphQL API

The GraphQL endpoint is served at `POST /graphql`. In development you can
explore it interactively in the Apollo sandbox at
<http://localhost:4000/graphql>.

There are also two REST helper routes:

- `GET /` — service metadata
- `GET /health` — health check (`{"status":"ok",...}`)

## Schema

```graphql
type User {
  id: ID!
  email: String!
  name: String!
  emailVerified: Boolean!
  createdAt: String!
  updatedAt: String!
}

type AuthPayload { token: String!  user: User! }
type AuthResult { success: Boolean!  message: String! }

type Query {
  me: User           # current authenticated user
  user(id: ID!): User # look up a user by id (auth required)
}

type Mutation {
  signup(email: String!, password: String!, name: String!): AuthResult!
  login(email: String!, password: String!): AuthPayload!
  verifyEmail(token: String!): AuthPayload!
  resendVerification(email: String!): AuthResult!
}
```

The `password` field is **never** exposed through the API.

## Authentication

Accounts require **email verification** before they can log in. The full flow,
security properties, and a step-by-step testing walk-through (including the
no-SMTP console fallback) live in **[Authentication](./authentication.md)**.

In short: `signup` emails a verification link and returns no token; `verifyEmail`
and `login` return a JWT `token`. Send it on subsequent requests:

```
Authorization: Bearer <token>
```

The auth middleware decodes the token (if present) and attaches the user id to
the request context. Queries that require a user (`me`, `user`) throw
`Unauthorized` when no valid token is supplied. Tokens expire after
[`JWT_EXPIRY`](./configuration.md) (default `24h`).

## Mutations

### `signup`

Registers a user in an unverified state and emails a verification link. Returns
a generic `AuthResult` — **no token** until the email is verified.

```graphql
mutation {
  signup(email: "user@example.com", password: "supersecret123", name: "John Doe") {
    success
    message
  }
}
```

Errors: `Please provide a valid email address`, `Name is required`,
`Password must be at least 8 characters`.

### `verifyEmail`

Confirms a verification token and logs the user in.

```graphql
mutation {
  verifyEmail(token: "<token from the email link>") {
    token
    user { id email emailVerified }
  }
}
```

Errors: `Invalid or expired verification link`.

### `login`

Authenticates a **verified** user.

```graphql
mutation {
  login(email: "user@example.com", password: "supersecret123") {
    token
    user { id email name emailVerified }
  }
}
```

Errors: `Invalid email or password` (generic, by design),
`Email not verified. Check your inbox or request a new verification link.`

### `resendVerification`

Re-sends the verification link. Always returns a generic `AuthResult`.

```graphql
mutation {
  resendVerification(email: "user@example.com") { success message }
}
```

## Queries

### `me` (auth required)

Returns the currently authenticated user.

```graphql
query {
  me { id email name createdAt }
}
```

### `farmersForProduct(productId)` (auth required)

Loan-officer view — the reverse of `farmerMatches`. Returns the farmers who
(nearly) qualify for a given product, ranked by fit.

```graphql
query {
  farmersForProduct(productId: "faulu-maize-cycle", includeNearMisses: true, limit: 25) {
    qualifies
    fitScore
    farmer { name region crops }
    reasons { dimension matched }
    gaps { dimension required }
    hasRepaymentHistory
    lenderInRegion
  }
}
```

Errors: `Unauthorized` (no/invalid token), `Loan product not found: <id>`.

### `user(id)` (auth required)

Looks up any user by id.

```graphql
query {
  user(id: "00000000-0000-0000-0000-000000000000") {
    id
    email
    name
  }
}
```

Errors: `Unauthorized` (no/invalid token), `User not found`.

## Examples with `curl`

Sign up (see [Authentication](./authentication.md) for the full verify-then-login flow):

```bash
curl -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation { signup(email:\"dev@kilimo.ai\", password:\"supersecret123\", name:\"Dev\") { success message } }"}'
```

Authenticated request:

```bash
TOKEN="<paste token here>"
curl -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"{ me { id email name } }"}'
```
