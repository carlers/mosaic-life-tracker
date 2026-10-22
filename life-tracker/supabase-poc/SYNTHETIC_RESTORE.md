# Synthetic encrypted-restore rehearsal (#1027)

The GitHub **Supabase Synthetic Restore Lab** creates local PostgreSQL source and
target databases on a disposable runner, runs the real Mosaic task/category/Diary
SQL migrations, and generates two **fake** owner identities and sessions.

It checks age encryption/authentication, rejects a truncated ciphertext,
confirms that replaying every raw archive object into an initialized database
fails atomically, then restores only nine enumerated table-data objects (including synthetic Auth identities).
It compares all recovered data columns and checks signed-claim row-level
read isolation (two owners) plus anonymous Diary-read denial.

The runner contains no hosted Supabase, Vercel, Appwrite, SMTP or user credentials
and does not contact an external database. The Auth schema/functions are minimal
*stubs*, NOT the real GoTrue Auth service. Source and target are separate
databases in one disposable PostgreSQL cluster, NOT independent Supabase stacks.
The distinct **Supabase Core App Lab** exercises actual local GoTrue.

This synthetic rehearsal CANNOT prove recovery of the private Fedora
mosaic-dev backup, real password hashes, Auth identities, hosted Roles/Realtime/
Storage/SMTP settings, or deployed PWA upgrades. It is not authorization for a
hosted migration, public signup, Production rollout or release. Never upload
the real backup or age private key into this job or Vercel.
