-- Protected rollout attestation. Migration alone never activates six domains.
alter table mosaic_candidate_private.identity_installation
  add column personal_release_evidence jsonb,
  add constraint personal_release_evidence_shape check (
    personal_release_evidence is null or (
      jsonb_typeof(personal_release_evidence) = 'object' and
      personal_release_evidence @> '{"schema":14}'::jsonb and
      personal_release_evidence->>'sourceSha' ~ '^[a-f0-9]{40}$' and
      personal_release_evidence->>'signedRun' ~ '^[1-9][0-9]+$' and
      personal_release_evidence->>'restoreRun' ~ '^[1-9][0-9]+$' and
      personal_release_evidence ?& array['sourceSha','signedRun','restoreRun']
    )
  );

create function public.mosaic_personal_readiness()
returns jsonb language plpgsql security definer set search_path='' as $$
declare account jsonb;
begin
  account := public.mosaic_account_status();
  -- This path starts independent NEW data. It cannot authorize a legacy import
  -- or attest that suspended Appwrite has fenced historical account writers.
  if account->>'provenance' <> 'server-enrolled' or
     account->>'historyState' not in ('fresh','recovery-pending') then
    raise exception 'Independent account consent required' using errcode='42501';
  end if;
  return account || jsonb_build_object('personalReady',
    (select personal_release_evidence is not null
     from mosaic_candidate_private.identity_installation));
end;
$$;
revoke all on function public.mosaic_personal_readiness() from public, anon, authenticated;
grant execute on function public.mosaic_personal_readiness() to authenticated;

-- Owner-filtered INSERT/UPDATE notifications only wake the signed pull path.
do $personal_realtime$
declare tab text; target regclass;
begin
  foreach tab in array array['mosaic_candidate_settings','mosaic_candidate_buckets','mosaic_candidate_bucket_task_links'] loop
    target := to_regclass('public.' || tab);
    if target is null or not exists(select 1 from pg_class where oid=target and relrowsecurity) or
       has_table_privilege('anon',target,'SELECT') or
       has_table_privilege('authenticated',target,'UPDATE') or
       has_table_privilege('authenticated',target,'DELETE') or
       not has_table_privilege('authenticated',target,'SELECT') or
       not exists(select 1 from pg_policies where schemaname='public' and tablename=tab
         and cmd='SELECT' and 'authenticated'=any(roles) and qual like '%owner_id%' and qual like '%uid()%') then
      raise exception 'Personal Realtime requires private owner SELECT and CAS-only writes';
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
      and schemaname='public' and tablename=tab) then
      execute format('alter publication supabase_realtime add table public.%I',tab);
    end if;
  end loop;
end $personal_realtime$;
