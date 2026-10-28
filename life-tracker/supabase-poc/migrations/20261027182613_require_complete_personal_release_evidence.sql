-- A PostgreSQL CHECK accepts UNKNOWN. Null JSON evidence fields must not
-- approve a personal rollout; require the complete predicate to be TRUE.
alter table mosaic_candidate_private.identity_installation
  drop constraint personal_release_evidence_shape,
  add constraint personal_release_evidence_shape check (
    personal_release_evidence is null or (
      jsonb_typeof(personal_release_evidence) = 'object' and
      personal_release_evidence @> '{"schema":14}'::jsonb and
      personal_release_evidence->>'sourceSha' ~ '^[a-f0-9]{40}$' and
      personal_release_evidence->>'signedRun' ~ '^[1-9][0-9]+$' and
      personal_release_evidence->>'restoreRun' ~ '^[1-9][0-9]+$' and
      personal_release_evidence ?& array['sourceSha','signedRun','restoreRun']
    ) is true
  );
