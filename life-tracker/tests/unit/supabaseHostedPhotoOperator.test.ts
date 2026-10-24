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
      'state={"bytes":{}, "deletes":0}',
      'def signed(_key,n): return (a,"token-a" if n==1 else "token-b") if n==1 else (b,"token-b")',
      'def fake(path,key,token=None,method="GET",body=None,mime=None):',
      '  is_a=token=="token-a"',
      '  is_private="/authenticated/" in path',
      '  is_public="/public/" in path',
      '  obj=path.replace("/authenticated/","/").replace("/public/","/")',
      '  if is_public: return 400,b""',
      '  if method=="POST":',
      '    if not is_a: return 403,b""',
      '    if obj in state["bytes"]: return 409,b""',
      '    state["bytes"][obj]=body; return 201,b""',
      '  if method=="DELETE":',
      '    if not is_a: return 403,b""',
      '    state["bytes"].pop(obj,None);state["deletes"]+=1;return 200,b""',
      '  if is_private and not is_a: return 403,b""',
      '  return (200,state["bytes"][obj]) if obj in state["bytes"] else (404,b"")',
      'with patch.object(p,"signed_owner",side_effect=signed),patch.object(p,"request",side_effect=fake),patch.object(p,"encrypted_roundtrip",side_effect=lambda blob: blob),patch.object(sys,"argv",["verify-hosted-private-photo.py"]):',
      '  out=io.StringIO()',
      '  with contextlib.redirect_stdout(out): p.main()',
      'assert state["bytes"]=={} and state["deletes"]==2',
      'print(out.getvalue())',
    ].join('\n'));
    for (const marker of [
      'HOSTED_PRIVATE_PHOTO_OWNER_UPLOAD_READ_PASS',
      'HOSTED_PRIVATE_PHOTO_CROSS_OWNER_DENIAL_PASS',
      'HOSTED_PRIVATE_PHOTO_PUBLIC_ANON_DENIAL_PASS',
      'HOSTED_PRIVATE_PHOTO_IMMUTABLE_BYTES_PASS',
      'HOSTED_PRIVATE_PHOTO_ENCRYPTED_BYTE_RESTORE_PASS',
      'HOSTED_PRIVATE_PHOTO_FIXTURE_CLEANUP_PASS',
    ]) expect(output).toContain(marker);
  });
  it('tests real encrypted-file workflow without requiring age or remote credentials in CI', () => {
    const output = run([
      'import sys, importlib.util,tempfile,stat',
      'from pathlib import Path',
      'from types import SimpleNamespace',
      'from unittest.mock import patch',
      'spec=importlib.util.spec_from_file_location("photo_test",sys.argv[1])',
      'p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)',
      'with tempfile.TemporaryDirectory() as tmp:',
      '  root=Path(tmp)',
      '  key=root/".config/mosaic/supabase-backup.agekey"',
      '  key.parent.mkdir(parents=True,mode=0o700)',
      '  key.write_text("synthetic-test-key-only")',
      '  folder=root/"mosaic-secure-backups";folder.mkdir(mode=0o700)',
      '  def fake_age(cmd,**kw):',
      '    if cmd[0]=="age-keygen": return SimpleNamespace(stdout="age1"+"x"*58)',
      '    if cmd[1]=="--encrypt":',
      '      kw["stdout"].write(b"synthetic-encrypted:"+kw["input"])',
      '      return SimpleNamespace(stdout=b"")',
      '    if cmd[1]=="--decrypt":',
      '      data=Path(cmd[-1]).read_bytes()',
      '      assert data.startswith(b"synthetic-encrypted:")',
      '      return SimpleNamespace(stdout=data[len(b"synthetic-encrypted:"):])',
      '    raise AssertionError(cmd)',
      '  with patch.object(p.Path,"home",return_value=root),patch.object(p.subprocess,"run",side_effect=fake_age):',
      '    assert p.encrypted_roundtrip(p.WEBP)==p.WEBP',
      '  archives=list(folder.glob("mosaic-photo-dr-*.age"))',
      '  assert len(archives)==1 and archives[0].read_bytes()!=p.WEBP',
      '  assert stat.S_IMODE(archives[0].stat().st_mode)==0o600',
      '  folder.chmod(0o755)',
      '  with patch.object(p.Path,"home",return_value=root):',
      '    try: p.encrypted_roundtrip(p.WEBP);assert False',
      '    except ValueError: pass',
      'print("ENCRYPTED_PRIVATE_BLOB_DR_GUARDS_PASS")',
    ].join('\n'));
    expect(output).toContain('ENCRYPTED_PRIVATE_BLOB_DR_GUARDS_PASS');
  });

  it('removes only one signed-owner time-bound synthetic probe after exact-byte verification', () => {
    const output = run([
      'import sys,importlib.util,json',
      'from unittest.mock import patch',
      'spec=importlib.util.spec_from_file_location("audit",sys.argv[1])',
      'p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)',
      'owner="11111111-1111-4111-8111-111111111111"',
      'calls=[]',
      'def fake(path,key,token=None,method="GET",body=None,mime=None):',
      '  calls.append((method,path))',
      '  if "/list/" in path: return 200,json.dumps([{"name":"probe_"+"a"*24+".webp","created_at":"2026-10-24T09:44:35Z"},{"name":"personal.webp","created_at":"2026-10-24T09:44:35Z"}]).encode()',
      '  if method=="DELETE":return 200,b""',
      '  return (400,b"") if any(x[0]=="DELETE" for x in calls) else (200,p.WEBP)',
      'with patch.object(p,"signed_owner",return_value=(owner,"token")),patch.object(p,"request",side_effect=fake):',
      '  p.cleanup_previous_probe()',
      'assert len([x for x in calls if x[0]=="DELETE"])==1',
      'assert "probe_"+"a"*24 in [x for x in calls if x[0]=="DELETE"][0][1]',
      'assert "personal.webp" not in str(calls)',
      'print("SCOPED_FIXTURE_CLEANUP_PASS")',
    ].join('\n'));
    expect(output).toContain('SCOPED_FIXTURE_CLEANUP_PASS');
  });

  it('rejects unexpected fixture bytes instead of deleting user content', () => {
    const output = run([
      'import sys,importlib.util,json',
      'from unittest.mock import patch',
      'spec=importlib.util.spec_from_file_location("audit",sys.argv[1])',
      'p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)',
      'owner="11111111-1111-4111-8111-111111111111"',
      'calls=[]',
      'def fake(path,key,token=None,method="GET",body=None,mime=None):',
      '  calls.append(method)',
      '  if "/list/" in path:return 200,json.dumps([{"name":"probe_"+"b"*24+".webp","created_at":"2026-10-24T09:44:35Z"}]).encode()',
      '  if method=="DELETE":raise AssertionError("Forbidden deletion")',
      '  return 200,b"different bytes"',
      'with patch.object(p,"signed_owner",return_value=(owner,"token")),patch.object(p,"request",side_effect=fake):',
      '  try:p.cleanup_previous_probe();assert False',
      '  except ValueError:pass',
      'assert "DELETE" not in calls',
      'print("NON_FIXTURE_REFUSED_PASS")',
    ].join('\n'));
    expect(output).toContain('NON_FIXTURE_REFUSED_PASS');
  });

});
