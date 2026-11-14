/**
 * #1658 provider transport smoke. Runs only in the validation branch.
 * Credential-free, read-only and pinned to disposable Oracle Scratch.
 */
const endpoint = "https://129-221-244-67.sslip.io/v1";
const project = "6ae94a2100014d01f5ed";
const checks = [
  { name: "health", path: "/health", required: 200 },
  { name: "version", path: "/health/version", required: null },
  { name: "guest-account", path: "/account", required: 401 },
  { name: "guest-mfa-factors", path: "/account/mfa/factors", required: 401 },
];
let passed = true;
for (const check of checks) {
  try {
    const response = await fetch(endpoint + check.path, {
      method: "GET",
      redirect: "error",
      headers: { "X-Appwrite-Project": project, Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    const payload = await response.json().catch(() => ({}));
    const ok = check.required === null || response.status === check.required;
    if (!ok) passed = false;
    const marker = check.name === "version" && typeof payload.version === "string"
      ? " version=" + payload.version.replace(/[^0-9a-zA-Z._-]/g, "")
      : "";
    console.log(`MFA_SCRATCH_PROBE ${check.name} status=${response.status} ${ok ? "PASS" : "FAIL"}${marker}`);
  } catch (err) {
    passed = false;
    console.error(`MFA_SCRATCH_PROBE ${check.name} ERROR: ${err instanceof Error ? err.message : String(err)}`);
  }
}
if (!passed) process.exitCode = 1;
