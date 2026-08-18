# Database

Ordered, reversible migrations are managed by `node-pg-migrate`. Domain tables are intentionally deferred until their requirements are approved.

Migration scripts load the root `.env` file before running. Create `.env` from `.env.example` and set `DATABASE_URL` before running migrations.
