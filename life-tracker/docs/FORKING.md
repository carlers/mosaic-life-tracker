# Forking and independent recovery

Mosaic is designed so a new maintainer can run an independent community without access to
the original maintainer's Appwrite project. The application repository contains the schema,
trusted Function source, and bootstrap tooling needed to provision a fresh Appwrite project.

This repository currently has no explicit open-source license file. The bootstrap makes
recovery technically portable, but public visibility alone is not the same as a formal
reuse license. Add an explicit license before treating unrestricted third-party reuse as a
durable legal guarantee.

Cloudflare R2 is **not required to run Mosaic**. R2 is only needed for administrator disaster
recovery. A fork can start with Appwrite alone and add DR later.

## Fresh fork: shortest path

Requirements:

- Node 22
- a clone/fork of this repository
- a new, empty Appwrite project
- the API endpoint shown by that project, for example
  `https://fra.cloud.appwrite.io/v1`
- a temporary Appwrite project API key used only for provisioning

From `life-tracker/`:

1. Install dependencies:

   ```bash
   npm ci
   ```

2. See the exact temporary API-key scopes required by the current repository:

   ```bash
   npm run mosaic:bootstrap -- --print-scopes
   ```

   Create a temporary API key in the **new empty project** with those scopes. Do not put
   the key in a Vite/browser variable and do not commit it.

3. Bootstrap the backend:

   ```bash
   APPWRITE_API_KEY='<temporary-key>' npm run mosaic:bootstrap -- \
     --project '<project-id>' \
     --endpoint 'https://<region>.cloud.appwrite.io/v1' \
     --web-hostname localhost
   ```

   The command refuses a project that already contains users, databases, Storage buckets,
   or Functions. On success it creates the active Mosaic TablesDB schema, the image bucket,
   deploys the trusted `message-action` Function, registers the requested Web platform,
   and writes `.env.local` with the matching browser configuration.

4. **Immediately revoke/delete the temporary provisioning API key.** It is not needed by
   the browser or normal Mosaic operation.

5. Start Mosaic:

   ```bash
   npm run dev
   ```

A fresh fork is now its own Mosaic universe. Accounts, friendships, messages, files, and
tasks created there belong only to that Appwrite project.

## Deploying the fork

Copy the generated `VITE_APPWRITE_*` values from `.env.local` into the hosting provider's
build environment. Never publish `APPWRITE_API_KEY`; only the `VITE_*` values are browser
configuration.

Set `VITE_PUBLIC_APP_ORIGIN` to the deployment's canonical HTTPS origin (for example,
`https://mosaic.example.com`). Password recovery emails target
`<VITE_PUBLIC_APP_ORIGIN>/reset-password`; the app uses the current browser origin only when
that variable is absent. Add the same hostname as an Appwrite **Web platform** in the Console
so Appwrite allows the recovery callback. Preview or alternate hostnames that should receive
recovery links must each be registered as Web platforms as well.

Before using a production hostname, add it as an Appwrite Web platform. You can do that in
the Appwrite Console, or create another short-lived provisioning API key and run:

```bash
APPWRITE_API_KEY='<temporary-key>' npm run mosaic:bootstrap -- \
  --project '<project-id>' \
  --endpoint 'https://<region>.cloud.appwrite.io/v1' \
  --platform-only \
  --web-hostname mosaic.example.com \
  --no-env-file
```

Revoke that key afterward.

Unconfigured forks deliberately use an invalid Appwrite endpoint instead of falling back to
the original public Mosaic backend. The production fallback IDs in source are enabled only
for builds made by the official Mosaic GitHub/Vercel project; a normal fork must provide its
own generated environment values.

## What the bootstrap creates

The versioned manifest at `infrastructure/mosaic-backend.mjs` is the source of truth for a
fresh project. It creates the currently active runtime surface:

- TablesDB database `life_tracker`
- `tasks`, `categories`, `diary`, `settings`, `friendships`, `profiles`, and
  `messages`
- Storage bucket `task_images`
- the trusted `message-action` Function, including its scopes, schedule, variables, and
  deployment
- requested Appwrite Web platforms/CORS hostnames

Historical empty tables that Mosaic no longer uses are intentionally not provisioned.

By default the bootstrap uses Function ID `message_action` in a fresh project. The generated
browser config points Mosaic at that ID automatically, so it does not need to match the
original production Function ID.

## Optional disaster recovery

A fork does not need Cloudflare to operate. If the new maintainer wants full administrator
DR, configure the R2/encryption secrets described in
[Disaster recovery](DISASTER_RECOVERY.md) and bootstrap a **new empty project** with
`--with-dr`. The DR Function is created schedule-disabled. The normal DR rule still
applies: do not enable automated backups until an isolated restore drill has passed.

Because normal bootstrap intentionally refuses non-empty projects, adding DR to an already
running fork is an administrator operation rather than a reason to rerun the fresh-project
bootstrap. Follow the DR runbook to provision/configure that Function safely.

## If the original maintainer is unavailable

There are two independent recovery paths.

### Personal continuity

Each person can create an account in a newly bootstrapped Mosaic and import their own Mosaic
backup. Personal restore carries tasks, categories, diary entries, settings/preferences, and
included images into the currently signed-in account.

Personal restore intentionally does **not** recreate login identity, messages, or reciprocal
friendship/social state. Friends can add each other again in the new community and continue
from there. See [Backup and restore](BACKUP_RESTORE.md).

### Full-community continuity

A trusted successor who also has the administrator DR package (R2 recovery credentials plus
the escrowed encryption key) can restore the whole backend instead: account IDs/password
hashes where supported, tables, rows, friendships, messages, profiles, permissions, and
files. See [Disaster recovery](DISASTER_RECOVERY.md).

## Failure safety

The normal bootstrap is intentionally not an in-place migration tool. It checks the target
before making the first write and refuses any project with existing users, databases,
Storage buckets, or Functions.

Appwrite infrastructure creation is not one atomic transaction. If a fresh bootstrap fails
after resources have begun to be created, the safest recovery is to delete that disposable
test project, create another empty project, and rerun the command. Do not point the fresh
bootstrap at a community that already contains data.

Existing Mosaic installations evolve through the repository's migrations/operational
procedures, not through `mosaic:bootstrap`.
