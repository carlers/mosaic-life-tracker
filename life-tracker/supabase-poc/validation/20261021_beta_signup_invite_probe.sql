-- Scratch database only, after manually applying the unapplied candidate.
-- Simulates hook decisions with synthetic non-deliverable addresses.
begin;
set local statement_timeout='10s';
insert into mosaic_candidate_private.beta_signup_invitations(email, created_at, expires_at)
values ('allowed@example.invalid',now(),now()+interval '1 day'),
       ('revoked@example.invalid',now(),now()+interval '1 day'),
       ('expired@example.invalid',now()-interval '2 days',now()-interval '1 day');
update mosaic_candidate_private.beta_signup_invitations
  set revoked_at=now() where email='revoked@example.invalid';
do $test$
declare
  actual jsonb;
  attempted text;
begin
  actual := mosaic_candidate_private.beta_before_user_created(
    '{"metadata":{"name":"before-user-created"},"user":{"email":"ALLOWED@example.invalid"}}'::jsonb);
  if actual <> '{}'::jsonb then raise exception 'allowed invite rejected'; end if;
  foreach attempted in array array[
    'outsider@example.invalid','revoked@example.invalid','expired@example.invalid',
    'allowed@example.invalid ','not-an-email',''
  ] loop
    actual := mosaic_candidate_private.beta_before_user_created(
      jsonb_build_object('metadata',jsonb_build_object('name','before-user-created'),
        'user',jsonb_build_object('email',attempted)));
    if actual #>> '{error,http_code}' <> '403' then
      raise exception 'uninvited or invalid address accepted';
    end if;
  end loop;
  actual := mosaic_candidate_private.beta_before_user_created(
    '{"metadata":{"name":"unknown-hook"},"user":{"email":"allowed@example.invalid"}}'::jsonb);
  if actual #>> '{error,http_code}' <> '403' then
    raise exception 'invalid hook event accepted';
  end if;
  if not has_function_privilege('supabase_auth_admin',
      'mosaic_candidate_private.beta_before_user_created(jsonb)', 'EXECUTE') then
    raise exception 'Auth administrator cannot execute invitation hook';
  end if;
  if has_table_privilege('supabase_auth_admin',
      'mosaic_candidate_private.beta_signup_invitations', 'SELECT') then
    raise exception 'Auth administrator can read private invitation table';
  end if;
  if has_function_privilege('anon',
      'mosaic_candidate_private.beta_before_user_created(jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated',
      'mosaic_candidate_private.beta_before_user_created(jsonb)', 'EXECUTE') then
    raise exception 'Client roles can directly execute invitation hook';
  end if;
end $test$;
-- The local 'postgres' login cannot SET ROLE supabase_auth_admin. Actual
-- Auth-role invocation must be tested via GoTrue in another isolated phase;
-- catalogue privilege checks above protect this scratch-only probe.
rollback;
