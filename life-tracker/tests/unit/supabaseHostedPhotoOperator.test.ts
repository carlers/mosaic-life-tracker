import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(new URL('../../supabase-poc/verify-hosted-private-photo.py', import.meta.url));
function run(code: string) {
  const child = spawnSync('python3', ['-c', code, scriptPath], {
    encoding: 'utf8', timeout: 10_000,
    env: { ...process.env, MOSAIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_only' },
  });
  expect(child.status, child.stderr).toBe(0);
  return child.stdout;
}

describe('hosted signed private-photo operator guard', () => {
  it('rejects unapproved endpoints, forged identifiers, redirects and successful foreign writes', () => {
    const output = run([
      'import sys, importlib.util',
      'spec = importlib.util.spec_from_file_location("photo_test",sys.argv[1])',
      'p = importlib.util.module_from_spec(spec); spec.loader.exec_module(p)',
      'assert p.endpoint("/storage/v1/object/foo") == p.ORIGIN + "/storage/v1/object/foo"',
      'for path in ("//evil","/foo/../bar","/foo?token=x","/foo#frag","/foo@bad"):',
      '  try: p.endpoint(path); assert False',
      '  except ValueError: pass',
      'for owner in ("../../owner","abc","11111111-1111-4111-8111-111111111111"):',
      '  if owner.endswith("1111"): continue',
      '  try: p.storage_path(owner,"probe_" + "a"*24); assert False',
      '  except ValueError: pass',
      'try: p.expect_denied("Foreign owner",200); assert False',
      'except ValueError: pass',
      'assert p.expect_denied("Foreign owner",403) is None',
      'try: p.DenyRedirect().redirect_request(None,None,302,"","","https://elsewhere.test"); assert False',
      'except ValueError: pass',
      'print("OPERATOR_GUARDS_PASS")',
    ].join('\n'));
    expect(output).toContain('OPERATOR_GUARDS_PASS');
  });

  it('proves a synthetic owner upload/read/foreign denial + cleanup without network', () => {
    const output = run([
      'import sys, importlib.util,io,contextlib',
      'from unittest.mock import patch',
      'spec=importlib.util.spec_from_file_location("photo_test",sys.argv[1])',
      'p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)',
      'a="11111111-1111-4111-8111-111111111111"',
      'b="22222222-2222-4222-8222-222222222222"',
      'state={"bytes":None, "deletes":0}',
      'def signed(_key,n): return (a,"token-a" if n==1 else "token-b") if n==1 else (b,"token-b")',
      'def fake(path,key,token=None,method="GET",body=None,mime=None):',
      '  is_a=token=="token-a"',
      '  is_private="/authenticated/" in path',
      '  is_public="/public/" in path',
      '  if is_public: return 400,b""',
      '  if method=="POST":',
      '    if not is_a: return 403,b""',
      '    if state["bytes"] is not None: return 409,b""',
      '    state["bytes"]=body; return 201,b""',
      '  if method=="DELETE":',
      '    if not is_a: return 403,b""',
      '    state["bytes"]=None;state["deletes"]+=1;return 200,b""',
      '  if is_private and not is_a: return 403,b""',
      '  return (200,state["bytes"]) if state["bytes"] is not None else (404,b"")',
      'with patch.object(p,"signed_owner",side_effect=signed),patch.object(p,"request",side_effect=fake),patch.object(sys,"argv",["verify-hosted-private-photo.py"]):',
      '  out=io.StringIO()',
      '  with contextlib.redirect_stdout(out): p.main()',
      'assert state["bytes"] is None and state["deletes"]==1',
      'print(out.getvalue())',
    ].join('\n'));
    for (const marker of [
      'HOSTED_PRIVATE_PHOTO_OWNER_UPLOAD_READ_PASS',
      'HOSTED_PRIVATE_PHOTO_CROSS_OWNER_DENIAL_PASS',
      'HOSTED_PRIVATE_PHOTO_PUBLIC_ANON_DENIAL_PASS',
      'HOSTED_PRIVATE_PHOTO_IMMUTABLE_BYTES_PASS',
      'HOSTED_PRIVATE_PHOTO_FIXTURE_CLEANUP_PASS',
    ]) expect(output).toContain(marker);
  });
});
