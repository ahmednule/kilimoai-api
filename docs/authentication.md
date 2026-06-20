# Authentication & Email Verification

Kilimo AI uses JWT-based authentication with **mandatory email verification**.
A new account cannot log in until the owner confirms their email address.

## How it works

1. **Sign up** (`signup`) — creates the user in an **unverified** state, emails a
   verification link, and returns a generic `AuthResult`. **No token is issued.**
2. **Verify** — the user clicks the emailed link (`GET /verify-email?token=…`) or
   the client calls the `verifyEmail(token)` mutation. Verification marks the
   account active and **logs the user in** (returns an `AuthPayload` with a JWT).
3. **Log in** (`login`) — works only for verified accounts; returns a JWT.
4. **Authenticated requests** — send the JWT as `Authorization: Bearer <token>`.

### Security properties

- **Passwords** are hashed with bcrypt (cost factor 12) and never returned by the API.
- **Verification tokens** are 256-bit random values; only their SHA-256 hash is
  stored, they expire after **24 hours**, and they are **single-use** (cleared on
  verification).
- **Login errors are generic** (`Invalid email or password`) so the API does not
  reveal which emails are registered.
- **Signup / resend responses are identical** whether or not the email already
  exists, preventing account enumeration. A stalled, unverified signup quietly
  receives a fresh link.
- **Emails are normalised** (trimmed + lower-cased); passwords must be ≥ 8 chars.

## Configuration

Email is sent over SMTP. See [Configuration](./configuration.md) for the full
list; the relevant variables are `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
`SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, and `APP_URL` (used to build the link).

> **No SMTP configured?** If `SMTP_HOST` is unset, the server **logs the
> verification link to the console** instead of sending it. This makes the whole
> flow testable in development before real SMTP credentials are supplied.

## API reference

```graphql
type Mutation {
  signup(email: String!, password: String!, name: String!): AuthResult!
  login(email: String!, password: String!): AuthPayload!
  verifyEmail(token: String!): AuthPayload!
  resendVerification(email: String!): AuthResult!
}

type AuthResult { success: Boolean!  message: String! }
type AuthPayload { token: String!  user: User! }
type User { id: ID!  email: String!  name: String!  emailVerified: Boolean!  createdAt: String!  updatedAt: String! }
```

## Testing the flow

### Without SMTP (console fallback)

Start the server (`pnpm dev`). Then:

```bash
# 1. Sign up — returns a generic success message, no token.
curl -s http://localhost:4000/graphql -H 'Content-Type: application/json' \
  -d '{"query":"mutation { signup(email:\"dev@kilimo.ai\", password:\"supersecret123\", name:\"Dev\") { success message } }"}'

# 2. Grab the verification link printed in the server console, e.g.:
#    [EmailService] SMTP not configured. Verify dev@kilimo.ai at:
#      http://localhost:4000/verify-email?token=abc123...

# 3a. Verify via the link (browser or curl) — shows a confirmation page:
curl -s "http://localhost:4000/verify-email?token=<TOKEN>"

#  …or 3b. verify via GraphQL (also logs you in, returns a JWT):
curl -s http://localhost:4000/graphql -H 'Content-Type: application/json' \
  -d '{"query":"mutation { verifyEmail(token:\"<TOKEN>\") { token user { email emailVerified } } }"}'

# 4. Log in (now succeeds) and capture the token:
curl -s http://localhost:4000/graphql -H 'Content-Type: application/json' \
  -d '{"query":"mutation { login(email:\"dev@kilimo.ai\", password:\"supersecret123\") { token user { id } } }"}'

# 5. Use the token on an authenticated request:
TOKEN="<paste token>"
curl -s http://localhost:4000/graphql -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"{ me { id email name emailVerified } }"}'
```

Expected failures to confirm hardening:

```bash
# Login before verifying → "Email not verified. ..."
# Password shorter than 8 chars → "Password must be at least 8 characters"
# Reusing a verification token → "Invalid or expired verification link"
```

### With real SMTP

Set the SMTP variables in `.env` and restart. The verification email is then
delivered to the inbox instead of logged. For local end-to-end testing of real
delivery without a live mailbox, point SMTP at a catch-all dev server such as
[Mailpit](https://github.com/axllent/mailpit) (`SMTP_HOST=localhost`,
`SMTP_PORT=1025`) or [Ethereal](https://ethereal.email).

> After changing auth, the `me` and `user` queries still require a valid token;
> see [GraphQL API](./graphql-api.md).
