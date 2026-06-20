# Product Requirements Document — Kilimo AI

**Agri-Input Financing Assistant, powered by a Neo4j matching graph**

| | |
|---|---|
| **Document status** | Draft v1.0 — for team alignment |
| **Last updated** | 2026-06-17 |
| **Challenge** | Kenya AI Challenge 2026 — AgriFin × AI |
| **Partner** | Mercy Corps AgriFin |
| **Final sprint** | 27–28 June 2026, Nairobi |
| **Source brief** | `docs/kenya_ai_challenge_projects.pdf` (Project 02 + Project 03) |

---

## 1. Executive Summary

Kilimo AI is a **multilingual (Swahili / English) conversational assistant that walks a
smallholder farmer from "I need money for seed" to a submitted, eligible loan
application** — and underneath the conversation runs a **Neo4j graph that decides which
loan products the farmer genuinely qualifies for**.

It is the Kenya AI Challenge "every angle" play: the **conversational front-end of
Project 02** (highest win probability, highest demo power) fused with the
**graph-matching intelligence of Project 03** (deepest technical showcase, Neo4j as the
sponsor's core). The conversation gives judges something they can talk to live; the graph
gives technical judges real depth and cures the "it's just a chatbot" objection.

> **Vision:** Every smallholder farmer in Kenya can find, understand, and apply for the
> right financing in their own language, in minutes — without a payslip, a bank branch,
> or knowing the products exist.

---

## 2. Background & Context

### The challenge
The Kenya AI Challenge 2026 (AgriFin × AI), partnered with **Mercy Corps AgriFin**, asks
teams to build AI tools that unlock agricultural finance for Kenyan smallholders. Projects
are judged on **technical depth, demo power, commercial value, and impact/win
probability**, with strong signal for meaningful use of the sponsor tool stack (Neo4j,
Featherless LLMs, Lovable, Masumi).

### Why this project, and why this shape
Mercy Corps AgriFin's documented #1 finding: the biggest blocker to agricultural finance
is **not the absence of loan products — it is that farmers cannot navigate them**
(information asymmetry) and **lenders cannot cheaply assess fit** (manual eligibility).

- **Project 02** solves the farmer side (information asymmetry) and demos brilliantly, but
  risks being seen as a thin chatbot.
- **Project 03** solves the matching problem with a Neo4j graph and impresses engineers,
  but risks looking like a database browser, not a product.

Fusing them removes both weaknesses while reusing the team's existing investment: the repo
is already a **Neo4j + GraphQL + JWT foundation** (see §10), built by deliberately
migrating off Prisma/SQLite to a graph database. The README already flags the next step:
"Model relationships between nodes (the reason for choosing a graph DB)." This PRD *is*
that step.

---

## 3. Problem Statement

Smallholder farmers in Kenya need seed, fertiliser, and input financing, but:

1. **They don't know what exists.** Dozens of products across MFIs, SACCOs, banks, and
   agri-input companies — no single place that explains them, in Swahili, in plain terms.
2. **They don't know what they qualify for.** Eligibility depends on interconnected facts
   (crop, region, season, yield history, off-taker, repayment record) — not a flat
   checklist. Farmers waste time applying for products they'll be rejected for.
3. **They don't understand repayment in their context.** Post-harvest cash flow, drought
   risk, and seasonal timing make a generic repayment schedule meaningless.
4. **Lenders burn money on last-mile education and on processing ineligible applicants.**

The result: viable farmers stay "finance invisible," and lenders leave good loans
unmade.

---

## 4. Goals & Success Metrics

### Product goals
- **G1** — A farmer can describe their situation in Swahili or English and receive the
  2–3 best-fit loan products *they actually qualify for*, with a plain-language
  explanation of why.
- **G2** — A farmer can simulate repayment against their harvest cycle before committing.
- **G3** — A farmer can initiate (pre-fill / submit) an application to an AgriFin partner
  from inside the conversation.
- **G4** — A loan officer can query the same graph in reverse: "which farmers in my region
  fit my product?"

### Challenge success metrics (what winning looks like)
| Judging dimension | Target | How we hit it |
|---|---|---|
| Demo power | ★★★★★ | Live, talk-to-it Swahili conversation on stage |
| Technical depth | ★★★★☆ | Neo4j Cypher eligibility traversal, RAG grounding |
| Commercial value | ★★★★☆ | B2B SaaS for lenders + clear AgriFin deployment path |
| Impact / win prob | ★★★★★ | Solves Mercy Corps' documented #1 pain point |
| Sponsor tool use | High | Neo4j (core), Featherless, Lovable, Masumi all used meaningfully |

### Demo-readiness acceptance criteria (sprint definition of done)
- [ ] A judge can type/say a farmer scenario in Swahili and get a ranked, explained match.
- [ ] At least one match shows a "you don't qualify *yet* — here's what to change" path.
- [ ] Repayment simulation renders against a harvest timeline.
- [ ] Graph visual is shown at least once to prove the intelligence is real, not scripted.
- [ ] LLM answers loan facts **only** from the graph/product DB (no hallucinated terms).

---

## 5. Target Users & Personas

| Persona | Goal | Channel (sprint) | Channel (roadmap) |
|---|---|---|---|
| **Amina — smallholder farmer** | Find & apply for input financing she qualifies for, in Swahili | Web chat (mobile-first) | WhatsApp / USSD / SMS |
| **John — MFI/SACCO loan officer** | Find eligible farmers in his region; keep his product data current | Web portal | Lender admin API |
| **Mercy Corps AgriFin** | Deploy across partner network; reduce last-mile cost | — | White-label |

---

## 6. Solution Overview

Two surfaces over one graph brain:

```
┌─────────────────────────────┐     ┌──────────────────────────────┐
│  Farmer assistant (chat)     │     │  Loan-officer portal          │
│  Swahili / English           │     │  reverse matching + admin     │
└──────────────┬──────────────┘     └───────────────┬──────────────┘
               │                                      │
               ▼              GraphQL API             ▼
        ┌──────────────────────────────────────────────────┐
        │  Express + Apollo GraphQL  (existing foundation)   │
        │  • Auth (JWT)   • Matching   • Conversation   • Sim │
        └───────┬───────────────────┬───────────────┬───────┘
                │                   │               │
        ┌───────▼──────┐   ┌────────▼───────┐  ┌────▼─────────┐
        │   Neo4j      │   │ Featherless LLM│  │   Masumi     │
        │ eligibility  │   │ Swahili convo +│  │ (optional)   │
        │ graph (core) │   │ explanations   │  │ deposit/fee  │
        └──────────────┘   └────────────────┘  └──────────────┘
```

**How it works, step by step:**
1. **Conversational onboarding** — Farmer chats in Swahili/English. The LLM asks
   clarifying questions (farm size, crops, location, season, financial history) and
   captures structured attributes.
2. **Graph population** — Captured attributes create/update a `Farmer` node and its
   relationships in Neo4j.
3. **Match traversal** — A Cypher query traverses `Farmer → Crop / Region / Season →
   qualifies_for → LoanProduct`, returning only products whose conditions are all met,
   ranked by a fit score.
4. **Explanation (RAG)** — Featherless LLM turns each match into a plain-language Swahili
   explanation grounded **only** in graph facts ("you qualify because… ; to unlock a
   bigger loan, you'd need…").
5. **Repayment simulation** — Farmer inputs expected yield/price; the assistant projects
   repayment across harvest cycles.
6. **Application initiation** — Assistant pre-fills the application and either submits to
   the partner or produces a ready-to-submit document; **Masumi** optionally collects a
   deposit/processing fee in-conversation.
7. **Loan-officer reverse query** — Officers query the graph for qualifying farmers in
   their region and keep their own product nodes current via an admin API.

---

## 7. Scope

### In scope (sprint MVP)
- Web, mobile-first chat UI (Lovable) — Swahili + English.
- Conversational attribute capture + RAG-grounded answers (Featherless).
- Neo4j eligibility graph seeded with **20+ real loan products** from public MFI/SACCO
  product sheets.
- Cypher matching with fit-ranking + "qualify-yet" gap path.
- Repayment simulator (harvest-cycle aware).
- Application pre-fill / submission stub.
- Loan-officer reverse-match view + product admin (minimal).
- Existing JWT auth reused for officer accounts.

### Out of scope (roadmap, stated explicitly for judges)
- WhatsApp Business API / USSD / SMS channels (signup/approval can't complete in-sprint).
- Live data feeds from AgriFin partner systems (seeded data for the sprint).
- Offline caching.
- Real money movement beyond a demo Masumi deposit.
- ML credit scoring (that is Project 01's territory — deliberately not in v1).

---

## 8. Functional Requirements & User Stories

**Farmer assistant**
- FR1: As a farmer, I can converse in Swahili or English and be understood. *(LLM)*
- FR2: As a farmer, I am asked only the questions needed to determine eligibility.
- FR3: As a farmer, I receive the 2–3 best-fit products I qualify for, ranked.
- FR4: As a farmer, each result explains *why* I qualify and what would unlock more.
- FR5: As a farmer, I can simulate repayment against my harvest before applying.
- FR6: As a farmer, I can initiate an application without leaving the chat.
- FR7 *(optional)*: As a farmer, I can pay a deposit/fee in-conversation via Masumi.

**Loan-officer portal**
- FR8: As an officer, I can sign in (existing JWT auth).
- FR9: As an officer, I can list farmers in my region who match my product criteria.
- FR10: As an officer, I can add/update my loan products (graph nodes).

**System / trust**
- FR11: The LLM must answer loan facts (rates, terms, eligibility) **only** from the
  graph/product DB — never from model knowledge (structural anti-hallucination).
- FR12: Personal data is anonymisable; the system complies with Kenya's Data Protection
  Act 2019.

---

## 9. Data Model (Neo4j)

Builds on the existing `User` node (reused for loan officers). New domain graph:

**Nodes**
- `Farmer { id, name, farmSize, location, financialHistory, language, createdAt }`
- `Crop { name }`
- `Region { name }`
- `Season { name }`
- `LoanProduct { id, name, minAmount, maxAmount, interestRate, term, eligibilityNotes }`
- `Lender { id, name, type }`  *(MFI / SACCO / bank / agri-input)*
- `RiskCategory { name }`

**Relationships**
- `(:Farmer)-[:GROWS]->(:Crop)`
- `(:Farmer)-[:LOCATED_IN]->(:Region)`
- `(:Farmer)-[:HARVESTS_IN]->(:Season)`
- `(:Farmer)-[:HISTORICALLY_REPAID]->(:LoanProduct)`
- `(:LoanProduct)-[:OFFERED_BY]->(:Lender)`
- `(:LoanProduct)-[:QUALIFIES_FOR]->(:Crop|:Region|:Season|:RiskCategory)`
- `(:Lender)-[:OPERATES_IN]->(:Region)`

**Why a graph, not SQL** (judge-ready): eligibility is a chain of interconnected
relationships, not a flat checklist. Graph traversal captures it naturally; SQL would
require dozens of joins. Add uniqueness constraints on every `*.id` (extend the existing
`initSchema` in `src/db/neo4j.ts`).

---

## 10. Current Foundation (already built)

The repo is a working starting point — generic and reusable for this product:

- **Express + Apollo Server 5** GraphQL API (`src/index.ts`, `src/graphql/`).
- **Neo4j** via official `neo4j-driver`, with startup connectivity check and uniqueness
  constraints (`src/db/neo4j.ts` → `initSchema`).
- **JWT auth + bcrypt**, `User` node, `signup`/`login`/`me`/`user` (`src/services/AuthService.ts`,
  `src/middleware/auth.ts`, `src/graphql/schema.ts`).
- **Docker Compose** for local Neo4j; Vercel deploy config; TypeScript throughout.

**What to extend, not rebuild:** add the domain nodes/relationships of §9 to the schema
and resolvers; add matching, conversation, and simulation services alongside `AuthService`;
reuse `User`/JWT for loan officers.

---

## 11. Tech Stack & Sponsor Tool Mapping

| Layer | Tool | Role | Sponsor |
|---|---|---|---|
| Graph DB | **Neo4j** | Eligibility graph + matching (the intelligence) | ✅ |
| LLM | **Featherless** open-source LLMs (Aya / mT5-style for Swahili) | Conversation + grounded explanations | ✅ |
| Frontend | **Lovable** | Mobile-first chat UI + loan-officer portal | ✅ |
| Payments | **Masumi** | Optional in-conversation deposit/fee | ✅ |
| Backend | Express + Apollo GraphQL + TypeScript | API, matching, RAG orchestration | (existing) |
| Auth | JWT + bcrypt | Loan-officer accounts | (existing) |

---

## 12. Non-Functional Requirements

- **Language quality:** Swahili responses must be coherent and correct on loan facts —
  validated in week 1 (top risk).
- **Latency:** match + explanation under ~3s for a smooth live demo.
- **Trust:** no hallucinated financial terms (FR11); explanations always trace to graph
  facts.
- **Security/privacy:** strong `JWT_SECRET`, encrypted Bolt (`neo4j+s://`) in prod,
  anonymisable PII, DPA 2019 alignment.
- **Resilience:** graceful fallback if the LLM is unavailable (return matches without
  prose explanation rather than failing).

---

## 13. Sprint Plan (to 27–28 June 2026)

| Phase | Work |
|---|---|
| **Week 1 — de-risk** | Test Swahili LLM quality on Featherless; lock model. Design + seed Neo4j schema with 20+ real products. |
| **Week 2 — core** | Cypher matching + fit ranking; GraphQL resolvers; RAG explanation grounded in graph. |
| **Week 3 — surfaces** | Lovable chat UI (Swahili/English); repayment simulator; loan-officer reverse-match view. |
| **Sprint (27–28 Jun)** | Application initiation + optional Masumi deposit; graph visual for demo; rehearse judge Q&A; polish. |

---

## 14. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Swahili LLM quality inconsistent | High | Test in week 1; pick best Swahili-capable model; constrain to RAG so facts are never model-generated |
| Seen as "just a chatbot" | Med | Show the Neo4j graph + Cypher traversal live; lead with eligibility depth |
| Demo looks like a database browser | Med | Conversational Swahili front-end is the hero; graph is supporting proof |
| No real partner product data | Med | Seed 20+ products from public MFI/SACCO sheets; frame live feeds as post-challenge |
| LLM hallucinates loan terms | High | Structural RAG (FR11): model answers facts only from the product DB |
| WhatsApp not buildable in-sprint | Low | Web demo proves the core; WhatsApp scoped as first post-challenge step |

---

## 15. Judge Q&A Readiness

Drawn from the brief's simulated panel — rehearse these:

- **"Why not just WhatsApp?"** → Web demo proves the AI core; WhatsApp Business API is the
  first deployment step, already scoped.
- **"What if the LLM gives wrong loan terms?"** → RAG: the model only answers from a
  verified product graph; hallucination is structurally prevented.
- **"Why a graph instead of SQL?"** → Eligibility is chained relationships (crop × region ×
  season × history × off-taker), not a flat filter; SQL needs dozens of joins.
- **"How is this different from a USSD menu / aggregator?"** → Natural-language, handles
  follow-ups, explains trade-offs, simulates personalised repayment, and returns only
  products you qualify for — ranked, with reasons.
- **"What stops a bank building this in 3 months?"** → AgriFin-specific product graph,
  Swahili fine-tuning, partner-network integration; open to white-labelling.
- **"Is this legal / private?"** → Decision-support, not a regulated lender; DPA 2019
  compliant; data anonymisable.

---

## 16. Go-to-Market (post-challenge)

- **Revenue:** B2B SaaS — lenders subscribe to list products and access farmer leads;
  farmers use it free; optional per-successful-referral fee. (Masumi enables in-flow fees.)
- **Beachhead:** pilot with one AgriFin-connected MFI or SACCO.
- **Moat:** the AgriFin-specific eligibility graph + Swahili language layer + partner
  network — not quick to replicate.
- **Channel expansion:** WhatsApp → USSD/SMS for non-smartphone reach.

---

## 17. Open Questions

1. Which Featherless-hosted Swahili model performs best? *(week-1 spike)*
2. Can we obtain any real (even sample) AgriFin partner product data, or seed entirely
   from public sheets?
3. Is the Masumi deposit step worth sprint time, or demo-only?
4. Loan-officer auth: reuse `User` as-is, or add a `role` field now (RBAC is on the
   README roadmap)?
