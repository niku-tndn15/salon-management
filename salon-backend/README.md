# Salon Backend

Node.js + Express backend for the Salon Management Web App.

## M0 Status

This scaffold boots without a database connection. Until `DATABASE_URL` is set, `GET /health` returns `db: "not_configured"`.

## Scripts

```bash
npm install
npm run dev
npm run db:migrate
npm test
```

## Environment

Copy `.env.example` to `.env` when you are ready to connect a database. For production, set `DATABASE_URL` to the Supabase Session mode pooler connection string.

## Database Migrations

Migrations live in `src/db/migrations` and are applied alphabetically. The runner records completed files in `schema_migrations`, so re-running `npm run db:migrate` skips migrations that were already applied.
