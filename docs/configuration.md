# Configuration

The app is configured entirely through environment variables, loaded from a
`.env` file in development (via `dotenv`) and from the host environment in
production. Start from the template:

```bash
cp .env.example .env
```

## Variables

| Variable         | Required | Default                                 | Description                                                                 |
| ---------------- | -------- | --------------------------------------- | --------------------------------------------------------------------------- |
| `NEO4J_URI`      | yes      | `bolt://localhost:7687`                 | Bolt connection string. Use `neo4j+s://…` for TLS (e.g. Aura).              |
| `NEO4J_USER`     | yes      | `neo4j`                                 | Database username.                                                          |
| `NEO4J_PASSWORD` | yes      | `neo4j`                                 | Database password. Must match how the database was created.                |
| `JWT_SECRET`     | yes      | `your-secret-key-change-in-production`  | Secret used to sign JWTs. **Always override this** — min 32 chars.         |
| `JWT_EXPIRY`     | no       | `24h`                                   | Token lifetime. Accepts `zeit/ms` strings like `7d`, `12h`, `30m`.         |
| `NODE_ENV`       | no       | —                                       | `development` or `production`.                                              |
| `PORT`           | no       | `4000`                                  | HTTP port the server listens on.                                           |

> The "Default" column shows the value the app falls back to if the variable is
> unset. The shipped `.env.example` provides safe development starting points,
> but the fallbacks exist so the app still boots if a variable is missing — do
> not rely on them in production, especially `JWT_SECRET`.

## Example `.env`

```ini
# Neo4j connection
NEO4J_URI="bolt://localhost:7687"
NEO4J_USER="neo4j"
NEO4J_PASSWORD="devpassword123"

# Auth
JWT_SECRET="<run the generator below>"
JWT_EXPIRY="7d"

# Server
NODE_ENV="development"
PORT=4000
```

## Generating a strong `JWT_SECRET`

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Notes

- `.env` is git-ignored; only `.env.example` is committed. Never commit real
  secrets.
- Changing `NEO4J_PASSWORD` requires the database to be created with that same
  password. For the Docker setups, the password comes from
  `NEO4J_AUTH=neo4j/<password>` — keep the two in sync.
- In production, set these variables through your host's secret/environment
  management rather than a `.env` file.
