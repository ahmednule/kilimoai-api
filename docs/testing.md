# Testing & Viewing Data

A hands-on guide to exercising the API and inspecting the graph during
development. Assumes Neo4j is up (`docker compose up -d`) and the server is
running (`pnpm dev`).

## The two tools you'll use

| Tool | URL | For |
|---|---|---|
| **Neo4j Browser** | <http://localhost:7474> | **Viewing** the data — visual graph + Cypher |
| **Apollo Sandbox** | <http://localhost:4000/graphql> | **Testing** the API interactively |

## Start the stack

```bash
docker compose up -d   # Neo4j (data persists between runs)
pnpm seed              # load 11 lenders, 23 loan products, 3 sample farmers
pnpm dev               # API at http://localhost:4000
```

`pnpm seed` is idempotent — re-run it any time to restore the sample data.

---

## 1. Viewing data — Neo4j Browser

Open <http://localhost:7474> and connect with:

- **Connect URL:** `bolt://localhost:7687`
- **Username:** `neo4j`
- **Password:** the value of `NEO4J_PASSWORD` in your `.env` (dev default: `devpassword123`)

Paste these into the query bar and run (▶). Drag nodes to explore; click a node
to expand its relationships.

```cypher
// See the whole graph (small dataset, safe to render)
MATCH (n) RETURN n LIMIT 300;
```

```cypher
// Every loan product and who offers it
MATCH (p:LoanProduct)-[:OFFERED_BY]->(l:Lender)
RETURN p.name AS product, l.name AS lender,
       p.minAmount, p.maxAmount, p.interestRate, p.term
ORDER BY lender;
```

```cypher
// Visualise ONE farmer's world: their crops/region/season
// plus the products whose eligibility touches those attributes
MATCH (f:Farmer {id: 'farmer-amina'})
OPTIONAL MATCH (f)-[r1]->(attr)
OPTIONAL MATCH (p:LoanProduct)-[:QUALIFIES_FOR]->(attr)
RETURN f, r1, attr, p;
```

```cypher
// The eligibility wiring for a single product
MATCH (p:LoanProduct {id: 'jk-input-loan'})-[r]->(x)
RETURN p, r, x;
```

```cypher
// Registered users (auth) — note emailVerified
MATCH (u:User) RETURN u.email, u.name, u.emailVerified, u.createdAt;
```

Seeded farmer ids for testing: `farmer-amina`, `farmer-joseph`, `farmer-grace`.

---

## 2. Testing the API — Apollo Sandbox

Open <http://localhost:4000/graphql>. Put a query on the left, run it (▶). For
authenticated calls, add a header under **Headers**:
`Authorization: Bearer <token>`.

### Auth flow

> Email delivery is live when SMTP is configured (see
> [Authentication](./authentication.md)). With no SMTP set, the verification
> link is printed to the **server console** instead. Either way, the steps are
> the same — use an address you can check.

```graphql
mutation {
  signup(email: "you@example.com", password: "supersecret123", name: "You") {
    success
    message
  }
}
```

Open the verification email (or grab the link from the console) and either click
it, or copy the `token` and call:

```graphql
mutation {
  verifyEmail(token: "<token-from-email>") {
    token
    user { email emailVerified }
  }
}
```

```graphql
mutation {
  login(email: "you@example.com", password: "supersecret123") {
    token
    user { id }
  }
}
```

```graphql
# With Authorization: Bearer <token> in Headers
query { me { id email name emailVerified } }
```

### Farmer onboarding → matching → explanation

Onboard a new farmer (returns its `id`):

```graphql
mutation {
  onboardFarmer(input: {
    name: "Test Farmer", farmSize: 2.0, location: "Nakuru",
    crops: ["Maize", "Beans"], region: "Nakuru", seasons: ["Long Rains"]
  }) { id name crops region seasons }
}
```

Match a farmer to loan products, with a plain-language explanation. `language`
accepts `"sw"` (Swahili) or `"en"` (English):

```graphql
query {
  farmerMatches(farmerId: "farmer-grace", limit: 4) {
    qualifies
    fitScore
    product { name interestRate term }
    lender { name }
    reasons { dimension matched }
    gaps { dimension required }
    explanation(language: "sw") { text generatedBy }
  }
}
```

`generatedBy` tells you the source: `featherless:<model>` when the live LLM
answered, or `template` when it fell back to the deterministic explanation
(no `FEATHERLESS_API_KEY`, or the model errored). See
[Configuration](./configuration.md) for the `FEATHERLESS_*` variables.

Browse the catalogue:

```graphql
query { loanProducts { name minAmount maxAmount interestRate term lender { name } } }
```

### Repayment simulation

Project repayment aligned to harvest cycles (no auth needed):

```graphql
query {
  simulateRepayment(input: {
    productId: "equity-kilimo-biashara", principal: 100000,
    expectedHarvestRevenue: 90000, harvestsPerYear: 2
  }) {
    totalRepayable
    harvestsInTerm
    harvestInstallment
    affordable
    schedule { month amountDue label }
    summary
  }
}
```

### Loan-officer view (auth required)

The reverse of matching — which farmers fit a given product. Needs an
`Authorization: Bearer <token>` header (any verified user; see the auth flow
above):

```graphql
query {
  farmersForProduct(productId: "faulu-maize-cycle", limit: 25) {
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

---

## 3. Terminal alternative (no browser)

```bash
# Peek at data without the browser UI:
docker exec kilimo-neo4j cypher-shell -u neo4j -p devpassword123 \
  "MATCH (p:LoanProduct)-[:OFFERED_BY]->(l:Lender) RETURN l.name, p.name LIMIT 10"

# Call the API with curl:
curl -s http://localhost:4000/graphql -H 'Content-Type: application/json' \
  -d '{"query":"query { farmerMatches(farmerId:\"farmer-amina\", limit:2) { product { name } qualifies } }"}'
```

---

## Cleaning up test data

```cypher
// Remove test users you created during testing
MATCH (u:User) WHERE u.email IN ['you@example.com'] DETACH DELETE u;

// Remove test farmers (keeps the three seeded ones)
MATCH (f:Farmer) WHERE NOT f.id STARTS WITH 'farmer-' DETACH DELETE f;
```

Or reset everything and re-seed:

```bash
docker exec kilimo-neo4j cypher-shell -u neo4j -p devpassword123 "MATCH (n) DETACH DELETE n"
pnpm seed
```
