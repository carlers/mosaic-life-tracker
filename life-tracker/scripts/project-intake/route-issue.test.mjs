import test from 'node:test';
import assert from 'node:assert/strict';
import { destinationsForLabels, routeIssue, ROUTES, REPOSITORY } from './route-issue.mjs';

const baseEvent = (action = 'opened') => ({
  action,
  repository: { full_name: REPOSITORY },
  issue: { number: 1875, state: 'open' }
});
const response = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' }
});
function mockApi({
  state = 'open', labels = ['area:integrations'], nodeId = 'I_kwHOCQsqas123',
  viewer = 'carlers', owner = 'carlers', isPublic = false, isClosed = false,
  httpFailure = false, graphqlError = false, issueIsPr = false,
  mutationId = 'PVTI_existing_id'
} = {}) {
  const calls = [];
  const fetcher = async (url, opts) => {
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ url, method: opts.method, authorization: opts.headers.Authorization, body });
    if (httpFailure) return response({ message: 'rejected' }, 403);
    if (url.endsWith('/repos/carlers/mosaic-life-tracker/issues/1875'))
      return response({ number: 1875, node_id: nodeId, state,
        labels: labels.map(name => ({ name })), ...(issueIsPr ? { pull_request: {} } : {}) });
    if (url.endsWith('/graphql')) {
      if (graphqlError) return response({ errors: [{ message: 'GraphQL rejected' }] });
      if (body.query.includes('query VerifyProject')) return response({ data: {
        viewer: { login: viewer }, node: {
          __typename: 'ProjectV2', id: body.variables.id,
          public: isPublic, closed: isClosed, owner: { login: owner }
        }
      } });
      if (body.query.includes('mutation AddIssue')) return response({ data: {
        addProjectV2ItemById: { item: { id: mutationId } }
      } });
    }
    throw Error('Unexpected test URL ' + url);
  };
  return { calls, fetcher };
}
const args = api => ({
  event: baseEvent(), eventName: 'issues', repository: REPOSITORY,
  readToken: 'read-only-token', projectToken: 'projects-token', fetcher: api.fetcher
});

test('fixed mapping selects all and only explicitly labeled projects', () => {
  assert.deepEqual(destinationsForLabels(['area:everyday', 'AREA:INTEGRATIONS', 'priority:P0'])
    .map(x => x.number), [1, 3]);
  assert.deepEqual(destinationsForLabels([
    'area:social', 'area:storage', 'area:product', 'area:platform'
  ]).map(x => x.number), [6, 7, 8, 9]);
  assert.deepEqual(destinationsForLabels(['area:social', 'area:storage'])
    .map(x => x.number), [6, 7]);
  assert.deepEqual(destinationsForLabels(['pre-1.0', 'priority:P0']), []);
  assert.deepEqual(destinationsForLabels(['area:oracle-dr-other', 'area:release-1.0 extra']), []);
  assert.deepEqual(destinationsForLabels(null), []);
  assert.equal(ROUTES.length, 8);
});

test('each new area label resolves to its exact private Project destination', async () => {
  for (const [label, number] of [
    ['area:social', 6],
    ['area:storage', 7],
    ['area:product', 8],
    ['area:platform', 9]
  ]) {
    const api = mockApi({ labels: [label] });
    assert.deepEqual(await routeIssue(args(api)), { issue: 1875, projects: [number] });
    const mutation = api.calls.find(x => x.body?.query.includes('mutation AddIssue'));
    assert.equal(mutation.body.variables.projectId, ROUTES.find(x => x.number === number).projectId);
  }
});

test('real-time issue read precedes each write and uses separate token boundaries', async () => {
  const api = mockApi({ labels: ['area:everyday', 'area:oracle-dr'] });
  const result = await routeIssue(args(api));
  assert.deepEqual(result, { issue: 1875, projects: [3, 4] });
  assert.equal(api.calls.length, 5);
  assert.equal(api.calls[0].authorization, 'Bearer read-only-token');
  assert.deepEqual(api.calls.slice(1).map(x => x.authorization), Array(4).fill('Bearer projects-token'));
  const mutations = api.calls.filter(x => x.body?.query.includes('mutation AddIssue'));
  assert.deepEqual(mutations.map(x => x.body.variables.projectId), [ROUTES[1].projectId, ROUTES[2].projectId]);
  assert.ok(mutations.every(x => x.body.variables.contentId === 'I_kwHOCQsqas123'));
  assert.ok(api.calls.every(x => !JSON.stringify(x.body ?? {}).includes('label:') || x.body?.query));
});

test('duplicate labeled events safely return same project item without altering status', async () => {
  const api = mockApi({ labels: ['area:integrations'] });
  const first = await routeIssue(args(api));
  const second = await routeIssue({ ...args(api), event: baseEvent('labeled') });
  assert.deepEqual(first, second);
  assert.equal(api.calls.filter(x => x.body?.query.includes('mutation AddIssue')).length, 2);
  assert.ok(api.calls.every(x => !x.body?.query || !x.body.query.includes('updateProjectV2ItemFieldValue')));
});

test('reopened issues route; unsupported event actions never contact API', async () => {
  const api = mockApi({ labels: ['area:release-1.0'] });
  const result = await routeIssue({ ...args(api), event: baseEvent('reopened') });
  assert.deepEqual(result.projects, [5]);
  for (const action of ['closed', 'unlabeled', 'edited', 'deleted']) {
    assert.deepEqual(await routeIssue({ ...args(api), event: baseEvent(action) }), { skipped: 'event' });
  }
  assert.deepEqual(await routeIssue({ ...args(api), eventName: 'pull_request' }), { skipped: 'event' });
});

test('stale closed or unlabeled issue never writes', async () => {
  const closed = mockApi({ state: 'closed' });
  assert.deepEqual(await routeIssue(args(closed)), { skipped: 'not-open' });
  assert.equal(closed.calls.length, 1);
  const unlabeled = mockApi({ labels: ['priority:P1'] });
  assert.deepEqual(await routeIssue(args(unlabeled)), { skipped: 'no-scoped-label' });
  assert.equal(unlabeled.calls.length, 1);
  const eventClosed = mockApi();
  assert.deepEqual(await routeIssue({ ...args(eventClosed), event: {
    ...baseEvent(), issue: { number: 1875, state: 'closed' }
  } }), { skipped: 'not-open' });
  assert.equal(eventClosed.calls.length, 0);
});

test('invalid repo, issue identity and PR objects fail closed', async () => {
  const api = mockApi();
  await assert.rejects(routeIssue({ ...args(api), repository: 'evil/fork' }), /Repository mismatch/);
  await assert.rejects(routeIssue({ ...args(api), event: {
    ...baseEvent(), repository: { full_name: 'evil/fork' }
  } }), /Repository mismatch/);
  await assert.rejects(routeIssue({ ...args(api), event: {
    ...baseEvent(), issue: { number: -1, state: 'open' }
  } }), /Invalid issue/);
  const wrongNode = mockApi({ nodeId: 'wrong node id' });
  await assert.rejects(routeIssue(args(wrongNode)), /Issue identity mismatch/);
  const pr = mockApi({ issueIsPr: true });
  await assert.rejects(routeIssue(args(pr)), /Issue identity mismatch/);
  assert.equal(api.calls.length, 0);
});

test('fails closed on public/closed/wrong-owner projects before mutation', async () => {
  for (const state of [{ isPublic: true }, { isClosed: true }, { viewer: 'another' }, { owner: 'another' }]) {
    const api = mockApi(state);
    await assert.rejects(routeIssue(args(api)), /Target project is not an active private owner/);
    assert.equal(api.calls.filter(x => x.body?.query.includes('mutation AddIssue')).length, 0);
  }
});

test('missing project secret fails only for actually matching issues; API failures propagate', async () => {
  const api = mockApi();
  await assert.rejects(routeIssue({ ...args(api), projectToken: '' }), /MOSAIC_PROJECTS_ROUTING_TOKEN/);
  assert.equal(api.calls.length, 1);
  const noMatch = mockApi({ labels: ['none'] });
  assert.deepEqual(await routeIssue({ ...args(noMatch), projectToken: '' }), { skipped: 'no-scoped-label' });
  const denied = mockApi({ httpFailure: true });
  await assert.rejects(routeIssue(args(denied)), /GitHub API request failed/);
  const rejected = mockApi({ graphqlError: true });
  await assert.rejects(routeIssue(args(rejected)), /GraphQL request rejected/);
});

test('default-branch routing stays gated and label bootstrap is separately permissioned', async () => {
  const { readFile } = await import('node:fs/promises');
  const workflow = await readFile(new URL('../../../.github/workflows/issue-project-intake.yml', import.meta.url), 'utf8');
  assert.match(workflow, /issues:\s*\n\s*types: \[opened, labeled, reopened\]/);
  assert.match(workflow, /if: github\.event_name == 'issues' && vars\.MOSAIC_PROJECT_INTAKE_ENABLED == 'true'/);
  assert.match(workflow, /MOSAIC_PROJECTS_ROUTING_TOKEN: \$\{\{ secrets\.MOSAIC_PROJECTS_ROUTING_TOKEN \}\}/);
  assert.doesNotMatch(workflow, /pull_request_target:/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.match(workflow, /push:\s*\n\s*branches:\s*\[main\]/);
  const bootstrap = workflow.slice(workflow.indexOf('  ensure-area-labels:'), workflow.indexOf('  route:'));
  assert.match(bootstrap, /issues: write/);
  assert.match(bootstrap, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  assert.doesNotMatch(bootstrap, /MOSAIC_PROJECTS_ROUTING_TOKEN/);
  const routing = workflow.slice(workflow.indexOf('  route:'));
  assert.match(routing, /issues: read/);
  assert.match(routing, /GITHUB_READ_TOKEN: \$\{\{ github\.token \}\}/);
});
