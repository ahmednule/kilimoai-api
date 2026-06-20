# Database Setup

The API stores data in a [Neo4j](https://neo4j.com/) 5 graph database and
connects to it over the Bolt protocol (`bolt://` or `neo4j+s://`). You can run
Neo4j locally with Docker, or use a managed instance.

## Option A — Docker Compose (recommended)

A ready-to-use `docker-compose.yml` lives in the project root.

```bash
docker compose up -d      # start in the background
docker compose ps         # check status (wait for "healthy")
docker compose logs -f    # follow logs
docker compose down       # stop (data is kept)
docker compose down -v    # stop and DELETE all data
```

- **Bolt** is exposed on `7687` — this is what the app connects to.
- **Browser UI** is on `7474` — see [Inspecting the data](#inspecting-the-data).
- Data is stored in a named Docker volume (`neo4j-data`), so it survives
  `down`/`up` cycles. Use `down -v` to wipe it.

> The password is set by `NEO4J_AUTH=neo4j/devpassword123` in
> `docker-compose.yml`. If you change it, update `NEO4J_PASSWORD` in `.env` to
> match.

## Option B — Plain Docker

If you prefer not to use Compose:

```bash
docker run -d --name kilimo-neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/devpassword123 \
  -v "$PWD/neo4j-data:/data" \
  neo4j:5
```

Manage it with `docker start kilimo-neo4j` / `docker stop kilimo-neo4j`. The
`-v` flag persists data to `./neo4j-data` (git-ignored). Omit it for an
ephemeral database.

> Don't run this **and** Docker Compose at the same time — both use the
> container name `kilimo-neo4j` and port `7687`. Remove one first:
> `docker rm -f kilimo-neo4j`.

## Option C — Neo4j Aura (managed cloud)

Create a free instance at <https://neo4j.com/cloud/aura/>. Aura provides:

- a connection URI of the form `neo4j+s://<id>.databases.neo4j.io`
- the username `neo4j`
- a generated password (shown once at creation — save it)

Put those into `.env`:

```ini
NEO4J_URI="neo4j+s://<id>.databases.neo4j.io"
NEO4J_USER="neo4j"
NEO4J_PASSWORD="<generated-password>"
```

The `neo4j+s://` scheme enables TLS, which Aura requires. No Docker needed.

## Data model

The app uses a single node label:

```
(:User {
  id:        String   // UUID, unique
  email:     String   // unique
  name:      String
  password:  String   // bcrypt hash — never returned by the API
  createdAt: String    // ISO 8601 timestamp
  updatedAt: String    // ISO 8601 timestamp
})
```

### Constraints

On startup the app runs `initSchema()` (`src/db/neo4j.ts`), which creates these
constraints if they don't already exist:

```cypher
CREATE CONSTRAINT user_email_unique IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE;
CREATE CONSTRAINT user_id_unique    IF NOT EXISTS FOR (u:User) REQUIRE u.id    IS UNIQUE;
```

A uniqueness constraint also creates a backing index, so lookups by `email` and
`id` stay fast. You don't need to create anything by hand.

## Inspecting the data

Open the Neo4j Browser at <http://localhost:7474> and log in with the user
(`neo4j`) and password from your `.env`. Useful queries:

```cypher
// All users
MATCH (u:User) RETURN u;

// Count users
MATCH (u:User) RETURN count(u) AS users;

// List constraints
SHOW CONSTRAINTS;

// Delete everything (development only!)
MATCH (n) DETACH DELETE n;
```

## Production databases

- **[Neo4j Aura](https://neo4j.com/cloud/aura/)** is the simplest managed
  option; use the `neo4j+s://` URI it gives you.
- The Neo4j driver keeps a long-lived connection pool, which does **not** map
  well onto short-lived serverless functions (e.g. Vercel). Prefer a
  long-running host such as Render, Railway, Fly.io, or a container platform.

See [Configuration](./configuration.md) for the variables to set in your host.
