-- Unapplied candidate, #1027: invite-only fresh-account admission.
-- Enable the GoTrue hook only after disposable GoTrue and fixture acceptance.
create table mosaic_candidate_private.beta_signup_invitations (
  email text collate "C" primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint beta_invite_email_format check (
    email = lower(btrim(email)) and length(email) between 3 and 254
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+$'
  ),
  constraint beta_invite_expiry check (
    expires_at > created_at and expires_at <= created_at + interval '30 days'
  )
);
revoke all on mosaic_candidate_private.beta_signup_invitations
  from public, anon, authenticated, supabase_auth_admin;

create function mosaic_candidate_private.beta_before_user_created(event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  email_claim text := event #>> '{user,email}';
begin
  if jsonb_typeof(event) is distinct from 'object'
    or (event #>> '{metadata,name}') is distinct from 'before-user-created'
    or email_claim is null or length(email_claim) not between 3 and 254
    or email_claim <> btrim(email_claim)
    or email_claim !~ '^[^@[:space:]]+@[^@[:space:]]+$'
  then
    return jsonb_build_object('error', jsonb_build_object('http_code',403,
      'message','Registration is by invitation only.'));
  end if;
  if exists (
    select 1 from mosaic_candidate_private.beta_signup_invitations
    where email = lower(email_claim)
      and revoked_at is null and expires_at > clock_timestamp()
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code',403,
    'message','Registration is by invitation only.'));
end;
$$;
revoke all on function mosaic_candidate_private.beta_before_user_created(jsonb)
  from public, anon, authenticated, supabase_auth_admin;
grant usage on schema mosaic_candidate_private to supabase_auth_admin;
grant execute on function mosaic_candidate_private.beta_before_user_created(jsonb)
  to supabase_auth_admin;
-- Deliberately do not activate auth.hook.before_user_created.
