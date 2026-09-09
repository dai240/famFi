# famFi: Shared Database Rules

Read `docs/shared-database.md` before any database, Auth, environment-variable, or migration work.

- famFi does not own an entire Supabase project. Its intended database is the shared `personal-apps` project (`fpptihhtyhehpjvmtuqt`). Other personal apps use the same project.
- The `sateni` tennis project (`jyweoovtkxfyyfqhidgx`) is unrelated and must not be modified for famFi work.
- famFi owns only the `famfi` schema. Do not create application tables in `public` or modify another app's schema.
- Canonical migrations and shared operational instructions live in `https://github.com/dai240/personal-apps-infra` (local checkout: `/Users/dai/study/app/personal-apps-infra`). Read that repository's `AGENTS.md` and `docs/status.md` before changes.
- Do not run a remote DB reset, `prisma migrate reset`, or `prisma db push --accept-data-loss` against the shared project. Review ORM-generated SQL before applying it.
- `prisma/schema.prisma` contains the expense MVP models, all scoped to `famfi`. The canonical SQL is in the infrastructure repository; never use Prisma migrations as a competing history. The old model draft is archived under `docs/drafts/` and must not be applied.
- Shared Auth does not grant every user access to every app. Validate the signed-in user on the server and check famFi access separately. Do not trust a client-supplied `userId`.
- Use an app-specific runtime DB role, never `postgres`, a table owner, `service_role`, or a secret Supabase key for ordinary application queries. Never put a DB password or secret key in `NEXT_PUBLIC_*`, Git, logs, or chat.
- The expense APIs use server-verified Supabase Auth, `famfi.memberships`, and transaction-local `app.user_id`. All queries must stay inside `withUserDb`. The actual LOGIN role is `famfi_app`, inheriting `famfi_runtime`. Preserve strict TLS verification with the public CA in `certs/`.
- Runtime INSERT grants deliberately exclude metadata columns. The parameterized expense INSERT names only allowed columns; do not broaden grants just to accommodate ORM-generated INSERTs.
- Check the infrastructure status for owner invitation/membership provisioning. Do not describe the app as ready for real usage until actual email login, own-data CRUD, and initial backup/restore are verified. Local Auth fixtures are not evidence of email delivery. First-time invitation codes use `/login?mode=invite`; later email codes use `/login`.
- Verify intended access plus rejection of other users, other application schemas, and unauthenticated requests before deploying DB-backed features.
- Preserve other apps' Auth redirect URLs and settings. Document shared-impact changes in the infrastructure repository.

For long tasks, report approximate progress for the current prompt, completed work, remaining work, and any user-input dependency. Do not confuse this percentage with the entire project's completion.
