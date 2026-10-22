#!/usr/bin/env bash
# #1027: disposable synthetic PostgreSQL/age recovery only. No live credentials.
set -euo pipefail
test "$GITHUB_ACTIONS" = true && test "$MOSAIC_SYNTHETIC_RESTORE_LAB" = 1
unset PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD PGSERVICE PGOPTIONS
root="$(cd "$(dirname "$0")/.." && pwd -P)"
tmp="$(mktemp -d)"
chmod 700 "$tmp"
trap 'rm -rf -- "$tmp"' EXIT
sudo service postgresql start >/dev/null
sudo -u postgres psql -Xq -v ON_ERROR_STOP=1 -d postgres <<'SQL'
DO $d$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $d$;
SQL
sudo -u postgres createdb mosaic_synth_src
sudo -u postgres createdb mosaic_synth_dst
bootstrap() {
  sudo -u postgres psql -qX -v ON_ERROR_STOP=1 -d "$1" <<'SQL'
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE auth.sessions(id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users(id));
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $f$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $f$
 SELECT jsonb_build_object('session_id',current_setting('request.jwt.claim.session_id',true)) $f$;
CREATE PUBLICATION supabase_realtime;
SQL
  for name in 20261018_candidate_task_category_owner_schema 20261018_candidate_revoke_default_delete \
    20261019_candidate_atomic_cas_rpc 20261020_candidate_task_protected_fields \
    20261020_core_fresh_identity_authority 20261021_core_realtime_publication \
    20261022_candidate_private_diary_domain 20261022_candidate_category_retirement \
    20261023_candidate_atomic_category_delete 20261022_candidate_private_diary_realtime; do
    sudo -u postgres psql -qX -v ON_ERROR_STOP=1 -d "$1" \
      -f "$root/supabase-poc/migrations/$name.sql" >"$tmp/migrations.log" 2>&1 || {
       echo "Migration failed: $name" >&2; tail -12 "$tmp/migrations.log" >&2; exit 1;
      }
  done
}
bootstrap mosaic_synth_src
bootstrap mosaic_synth_dst
sudo -u postgres psql -qX -v ON_ERROR_STOP=1 -d mosaic_synth_src <<'SQL'
DO $seed$
DECLARE owner uuid; session_id uuid; suffix text;
BEGIN
 FOR suffix IN SELECT unnest(ARRAY['a','b']) LOOP
   owner := (repeat(suffix,8)||'-'||repeat(suffix,4)||'-'||repeat(suffix,4)||'-'||repeat(suffix,4)||'-'||repeat(suffix,12))::uuid;
   session_id := (repeat(suffix,8)||'-'||repeat(suffix,4)||'-'||repeat(suffix,4)||'-'||repeat(suffix,4)||'-000000000001')::uuid;
   INSERT INTO auth.users(id) VALUES(owner);
   INSERT INTO auth.sessions(id,user_id) VALUES(session_id,owner);
   PERFORM set_config('request.jwt.claim.sub',owner::text,true);
   PERFORM set_config('request.jwt.claim.session_id',session_id::text,true);
   PERFORM public.mosaic_core_session('acquire');
   INSERT INTO public.mosaic_candidate_categories(owner_id,id,name,color,order_index)
     VALUES(owner,'cat_'||suffix,'Synthetic','#ddd',0);
   INSERT INTO public.mosaic_candidate_tasks(owner_id,id,title,category_id,order_index,task_date,created_at,updated_at)
     VALUES(owner,'task_'||suffix,'Synthetic','cat_'||suffix,0,'2026-10-22','2026-10-22T00:00:00Z','2026-10-22T00:00:00Z');
   INSERT INTO public.mosaic_candidate_diary(owner_id,id,entry_date,content,created_at,updated_at)
     VALUES(owner,'diary_'||suffix,'2026-10-22','Private','2026-10-22T00:00:00Z','2026-10-22T00:00:00Z');
 END LOOP;
END $seed$;
SQL
sudo -u postgres pg_dump -Fc --no-owner mosaic_synth_src >"$tmp/source.dump"
age-keygen -o "$tmp/key" >"$tmp/key.log" 2>&1
age -r "$(age-keygen -y "$tmp/key")" "$tmp/source.dump" >"$tmp/backup.age"
age -d -i "$tmp/key" "$tmp/backup.age" >"$tmp/recovered.dump"
cmp -s "$tmp/source.dump" "$tmp/recovered.dump"
cp "$tmp/backup.age" "$tmp/truncated.age"
truncate -s -1 "$tmp/truncated.age"
if age -d -i "$tmp/key" "$tmp/truncated.age" >/dev/null 2>&1; then exit 1; fi
node "$root/supabase-poc/inspect-archive-toc.mjs" < <(pg_restore -l "$tmp/recovered.dump") >"$tmp/toc-summary.json"
# Only these disposable fake records are relaxed for local postgres access.
chmod 711 "$tmp"
chmod 644 "$tmp/recovered.dump"
if sudo -u postgres pg_restore --no-owner --single-transaction --exit-on-error \
  -d mosaic_synth_dst "$tmp/recovered.dump" >"$tmp/raw-failure.log" 2>&1; then
  echo 'Unsafe whole-archive replay succeeded' >&2; exit 1
fi
sudo -u postgres psql -Xq -v ON_ERROR_STOP=1 -d mosaic_synth_dst <<'SQL'
ALTER TABLE auth.users DISABLE TRIGGER mosaic_enroll_fresh_core_owner;
ALTER TABLE public.mosaic_candidate_categories DISABLE TRIGGER USER;
ALTER TABLE public.mosaic_candidate_tasks DISABLE TRIGGER USER;
ALTER TABLE public.mosaic_candidate_diary DISABLE TRIGGER USER;
SQL
pg_restore -l "$tmp/recovered.dump" >"$tmp/list"
restore() {
  awk -v schema="$1" -v table="$2" '
    /^;/ {print;next} /TABLE DATA/ {
      if ($0 ~ ("TABLE DATA " schema " " table " ")) print
    }' "$tmp/list" >"$tmp/selection"
  test "$(grep -c 'TABLE DATA' "$tmp/selection")" -eq 1
  chmod 644 "$tmp/selection"
  sudo -u postgres pg_restore --exit-on-error --no-owner --data-only \
    -L "$tmp/selection" -d mosaic_synth_dst "$tmp/recovered.dump"
}
restore auth users
restore auth sessions
restore mosaic_candidate_private core_authorities
restore mosaic_candidate_private core_sessions
restore mosaic_candidate_private owner_revisions
restore public mosaic_candidate_categories
restore public mosaic_candidate_tasks
restore public mosaic_candidate_diary
sudo -u postgres psql -Xq -v ON_ERROR_STOP=1 -d mosaic_synth_dst <<'SQL'
ALTER TABLE auth.users ENABLE TRIGGER mosaic_enroll_fresh_core_owner;
ALTER TABLE public.mosaic_candidate_categories ENABLE TRIGGER USER;
ALTER TABLE public.mosaic_candidate_tasks ENABLE TRIGGER USER;
ALTER TABLE public.mosaic_candidate_diary ENABLE TRIGGER USER;
SQL
for t in auth.users auth.sessions mosaic_candidate_private.core_authorities \
 mosaic_candidate_private.core_sessions mosaic_candidate_private.owner_revisions \
 public.mosaic_candidate_categories public.mosaic_candidate_tasks public.mosaic_candidate_diary; do
  q="SELECT md5(coalesce(string_agg(row_to_json(x)::text,'|' ORDER BY row_to_json(x)::text),'')) FROM $t x"
  a="$(sudo -u postgres psql -AtX -d mosaic_synth_src -c "$q")"
  b="$(sudo -u postgres psql -AtX -d mosaic_synth_dst -c "$q")"
  test "$a" = "$b" || { echo "Mismatch $t" >&2; exit 1; }
done
sudo -u postgres psql -Xq -v ON_ERROR_STOP=1 -d mosaic_synth_dst <<'SQL'
DO $check$ BEGIN
 IF (SELECT count(*) FROM auth.users)<>2 OR
  (SELECT count(*) FROM public.mosaic_candidate_diary)<>2 OR
  has_table_privilege('anon','public.mosaic_candidate_diary','SELECT') OR
  NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.mosaic_candidate_diary'::regclass)
 THEN RAISE EXCEPTION 'Restore privacy contract failed'; END IF;
END $check$;
BEGIN;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',true);
SELECT set_config('request.jwt.claim.session_id','aaaaaaaa-aaaa-aaaa-aaaa-000000000001',true);
SET LOCAL ROLE authenticated;
DO $check$ BEGIN
 IF (SELECT count(*) FROM public.mosaic_candidate_tasks)<>1 OR
    (SELECT count(*) FROM public.mosaic_candidate_diary)<>1
 THEN RAISE EXCEPTION 'Owner A isolation failed'; END IF;
END $check$;
ROLLBACK;
BEGIN;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true);
SELECT set_config('request.jwt.claim.session_id','bbbbbbbb-bbbb-bbbb-bbbb-000000000001',true);
SET LOCAL ROLE authenticated;
DO $check$ BEGIN
 IF (SELECT count(*) FROM public.mosaic_candidate_tasks)<>1 OR
    (SELECT count(*) FROM public.mosaic_candidate_diary)<>1
 THEN RAISE EXCEPTION 'Owner B isolation failed'; END IF;
END $check$;
ROLLBACK;
SQL
echo 'SYNTHETIC_RESTORE_PASS (two owners, eight data tables, matching hashes, no anonymous Diary read)'
