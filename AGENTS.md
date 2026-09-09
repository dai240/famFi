# famFi: Shared Database Rules

Read `docs/shared-database.md` before any database, Auth, environment-variable, or migration work.

- famFi does not own an entire Supabase project. Its intended database is the shared `personal-apps` project (`fpptihhtyhehpjvmtuqt`). Other personal apps use the same project.
- The `sateni` tennis project (`jyweoovtkxfyyfqhidgx`) is unrelated and must not be modified for famFi work.
- famFi owns only the `famfi` schema. Do not create application tables in `public` or modify another app's schema.
- Canonical migrations and shared operational instructions live in `https://github.com/dai240/personal-apps-infra` (local checkout: `/Users/dai/study/app/personal-apps-infra`). Read that repository's `AGENTS.md` and `docs/status.md` before changes.
- Do not run a remote DB reset, `prisma migrate reset`, or `prisma db push --accept-data-loss` against the shared project. Review ORM-generated SQL before applying it.
- `prisma/schema.prisma` is a draft application model, not proof that the remote DB has these tables. Before connecting it, scope every model to `famfi`, reconcile UI/API fields, and register the reviewed migration in the infrastructure repository.
- Shared Auth does not grant every user access to every app. Validate the signed-in user on the server and check famFi access separately. Do not trust a client-supplied `userId`.
- Use an app-specific runtime DB role, never `postgres`, a table owner, `service_role`, or a secret Supabase key for ordinary application queries. Never put a DB password or secret key in `NEXT_PUBLIC_*`, Git, logs, or chat.
- The current UI uses sample data and the API lacks authentication. Do not wire production DB credentials into these endpoints before implementing authorization and RLS for the actual runtime connection.
- Verify intended access plus rejection of other users, other application schemas, and unauthenticated requests before deploying DB-backed features.
- Preserve other apps' Auth redirect URLs and settings. Document shared-impact changes in the infrastructure repository.
