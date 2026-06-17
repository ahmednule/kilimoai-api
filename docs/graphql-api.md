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
  createdAt: String!
  updatedAt: String!
}

type AuthPayload {
  token: String!
  user: User!
}

type Query {
  me: User           # current authenticated user
  user(id: ID!): User # look up a user by id (auth required)
}

type Mutation {
  signup(email: String!, password: String!, name: String!): AuthPayload!
  login(email: String!, password: String!): AuthPayload!
}
```

The `password` field is **never** exposed through the API.

## Authentication

`signup` and `login` return a JWT `token`. Send it on subsequent requests in
the `Authorization` header:

```
Authorization: Bearer <token>
```

The auth middleware decodes the token (if present) and attaches the user id to
the request context. Queries that require a user (`me`, `user`) throw
`Unauthorized` when no valid token is supplied. Tokens expire after
[`JWT_EXPIRY`](./configuration.md) (default `24h`).

## Mutations

### `signup`

Creates a user and returns a token.

```graphql
mutation {
  signup(email: "user@example.com", password: "password123", name: "John Doe") {
    token
    user { id email name }
  }
}
```

Errors: `User with this email already exists`.

### `login`

Authenticates an existing user.

```graphql
mutation {
  login(email: "user@example.com", password: "password123") {
    token
    user { id email name }
  }
}
```

Errors: `User not found`, `Invalid password`.

## Queries

### `me` (auth required)

Returns the currently authenticated user.

```graphql
query {
  me { id email name createdAt }
}
```

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

Sign up:

```bash
curl -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation { signup(email:\"dev@kilimo.ai\", password:\"secret123\", name:\"Dev\") { token user { id } } }"}'
```

Authenticated request:

```bash
TOKEN="<paste token here>"
curl -X POST http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"{ me { id email name } }"}'
```
