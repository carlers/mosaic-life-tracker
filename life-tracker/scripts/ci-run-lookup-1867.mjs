// Diagnostic-only public GitHub Actions run metadata lookup; not product code.
const exact = 'e2dbd7fd3421106bf6a51cc684a085c4d47ef9c7';
const url = 'https://api.github.com/repos/carlers/mosaic-life-tracker/actions/runs?head_sha=' + exact + '&per_page=30';
try {
  const response = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'mosaic-public-ci-audit' } });
  const body = await response.json();
  console.log('MOSAIC_PUBLIC_ACTIONS_READONLY', JSON.stringify({
    status: response.status,
    runs: (body.workflow_runs || []).map(x => ({
      id: x.id, name: x.name, head_sha: x.head_sha, status: x.status,
      conclusion: x.conclusion, event: x.event, html_url: x.html_url,
    })),
    error: response.ok ? undefined : String(body.message || 'HTTP error'),
  }));
} catch (error) {
  console.log('MOSAIC_PUBLIC_ACTIONS_READONLY_ERROR', error instanceof Error ? error.message : String(error));
}
