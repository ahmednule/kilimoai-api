# Troubleshooting

## `Failed to start server` / `ServiceUnavailable`

```
Failed to start server: Neo4jError: Failed to connect to server...
code: 'ServiceUnavailable'
```

The app can't reach Neo4j. Check, in order:

1. **Is Neo4j running?**
   ```bash
   docker compose ps      # STATUS should be "healthy"
   # or, for plain Docker:
   docker ps | grep neo4j
   ```
   If not, start it: `docker compose up -d` (see
   [Database Setup](./database-setup.md)).

2. **Is it ready yet?** Neo4j takes a few seconds to accept connections after
   the container starts. Wait for `healthy`, then retry `pnpm dev`.

3. **Does `NEO4J_URI` point to the right place?** Default is
   `bolt://localhost:7687`. For Aura it must use `neo4j+s://`.

## `Neo.ClientError.Security.Unauthorized`

The username/password in `.env` don't match the database. For the Docker
setups, credentials come from `NEO4J_AUTH=neo4j/<password>` — make sure
`NEO4J_PASSWORD` in `.env` matches it. If you changed the password after the
data volume was created, reset the database with `docker compose down -v` and
bring it back up.

## `EADDRINUSE: address already in use :::4000`

Another process is using port 4000. Either stop it, or run on a different port:

```bash
PORT=4001 pnpm dev
```

## `ERR_PNPM_IGNORED_BUILDS`

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild, @apollo/protobufjs
```

pnpm 10+ blocks dependency build scripts by default. This repo ships a
`pnpm-workspace.yaml` that allow-lists the needed ones, so a clean
`pnpm install` should just work. If your pnpm still blocks them:

```bash
pnpm approve-builds      # select all, confirm
pnpm install
```

## `pnpm: command not found`

Enable pnpm via Corepack (bundled with Node 18+):

```bash
corepack enable pnpm
```

## Port 7474 / 7687 already allocated

Another Neo4j (or a previous container) is using those ports. Find and remove
the old container:

```bash
docker ps -a | grep neo4j
docker rm -f kilimo-neo4j
```

Don't run plain `docker run` and `docker compose` for Neo4j simultaneously —
they share the container name and ports.

## Build / type errors

- Run `pnpm install` to ensure dependencies are present.
- Run `pnpm run type-check` to see TypeScript errors without emitting.
- Relative imports must use `.js` extensions (required for the compiled ESM
  output) — e.g. `import { getDriver } from '../db/neo4j.js'`.

## Resetting everything

To start from a clean database:

```bash
docker compose down -v   # removes the Neo4j data volume
docker compose up -d
```
