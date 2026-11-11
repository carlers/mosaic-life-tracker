import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REPOSITORY = 'carlers/mosaic-life-tracker';
export const PROJECT_OWNER = 'carlers';
export const ROUTES = Object.freeze([
  { label: 'area:integrations', number: 1, projectId: 'PVT_kwHOCQsqas4Bqt23' },
  { label: 'area:everyday', number: 3, projectId: 'PVT_kwHOCQsqas4Bqxbl' },
  { label: 'area:oracle-dr', number: 4, projectId: 'PVT_kwHOCQsqas4BqxxV' },
  { label: 'area:release-1.0', number: 5, projectId: 'PVT_kwHOCQsqas4BqxxX' },
  { label: 'area:social', number: 6, projectId: 'PVT_kwHOCQsqas4Bq8CC' },
  { label: 'area:storage', number: 7, projectId: 'PVT_kwHOCQsqas4Bq8CG' },
  { label: 'area:product', number: 8, projectId: 'PVT_kwHOCQsqas4Bq8CM' },
  { label: 'area:platform', number: 9, projectId: 'PVT_kwHOCQsqas4Bq8CS' }
]);
const ACTIONS = new Set(['opened', 'labeled', 'reopened']);
const API = 'https://api.github.com';

export function destinationsForLabels(labels) {
  if (!Array.isArray(labels)) return [];
  const names = new Set(labels.filter(x => typeof x === 'string').map(x => x.toLowerCase()));
  return ROUTES.filter(route => names.has(route.label));
}

async function request(fetcher, path, token, method = 'GET', body) {
  if (typeof token !== 'string' || !token) throw Error('Missing GitHub authorization');
  const response = await fetcher(API + path, {
    method,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'mosaic-project-issue-intake',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw Error('GitHub API request failed (HTTP ' + response.status + ')');
  const payload = await response.json();
  if (payload?.errors?.length) throw Error('GitHub GraphQL request rejected');
  return payload;
}

async function graphql(fetcher, token, query, variables) {
  const result = await request(fetcher, '/graphql', token, 'POST', { query, variables });
  if (!result?.data) throw Error('GitHub GraphQL response missing data');
  return result.data;
}

const PROJECT_QUERY = [
  'query VerifyProject($id: ID!) {',
  '  viewer { login }',
  '  node(id: $id) {',
  '    __typename',
  '    ... on ProjectV2 {',
  '      id public closed',
  '      owner { ... on User { login } }',
  '    }',
  '  }',
  '}'
].join('\n');

const ADD_MUTATION = [
  'mutation AddIssue($projectId: ID!, $contentId: ID!) {',
  '  addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {',
  '    item { id }',
  '  }',
  '}'
].join('\n');

/**
 * Only an open issue in this exact repository, currently bearing a routed label,
 * may be linked to one of eight fixed private Projects. Never changes an issue,
 * removes project membership, or writes Status / release fields.
 */
export async function routeIssue({
  event,
  eventName,
  repository,
  readToken,
  projectToken,
  fetcher = fetch
}) {
  if (eventName !== 'issues' || !ACTIONS.has(event?.action)) return { skipped: 'event' };
  if (repository !== REPOSITORY || event?.repository?.full_name !== REPOSITORY)
    throw Error('Repository mismatch');
  const number = event.issue?.number;
  if (!Number.isSafeInteger(number) || number < 1 || number > 100000000 ||
      event.issue?.pull_request) throw Error('Invalid issue event');
  if (event.issue.state !== 'open') return { skipped: 'not-open' };

  // Event data can be stale (e.g. an issue was closed or relabeled during queueing).
  // Read its current source-of-truth state with a read-only repository token.
  const issue = await request(fetcher, '/repos/' + REPOSITORY + '/issues/' + number, readToken);
  if (issue?.number !== number || issue?.pull_request ||
      typeof issue?.node_id !== 'string' ||
      !/^[A-Za-z0-9_-]{8,256}$/.test(issue.node_id)) throw Error('Issue identity mismatch');
  if (issue.state !== 'open') return { skipped: 'not-open' };
  const routes = destinationsForLabels((issue.labels ?? []).map(label => label.name));
  if (!routes.length) return { skipped: 'no-scoped-label' };

  if (!projectToken) throw Error('MOSAIC_PROJECTS_ROUTING_TOKEN is not configured');
  const added = [];
  for (const route of routes) {
    const checked = await graphql(fetcher, projectToken, PROJECT_QUERY, { id: route.projectId });
    const project = checked.node;
    if (checked.viewer?.login !== PROJECT_OWNER ||
        project?.__typename !== 'ProjectV2' ||
        project.id !== route.projectId || project.owner?.login !== PROJECT_OWNER ||
        project.public !== false || project.closed !== false) {
      throw Error('Target project is not an active private owner project #' + route.number);
    }
    // GitHub documents addProjectV2ItemById as idempotent; existing item ID is returned.
    const result = await graphql(fetcher, projectToken, ADD_MUTATION, {
      projectId: route.projectId, contentId: issue.node_id
    });
    if (typeof result.addProjectV2ItemById?.item?.id !== 'string')
      throw Error('GitHub did not confirm project addition');
    added.push(route.number);
  }
  return { issue: number, projects: added };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path) throw Error('GITHUB_EVENT_PATH missing');
  const event = JSON.parse(await readFile(path, 'utf8'));
  const result = await routeIssue({
    event,
    eventName: process.env.GITHUB_EVENT_NAME,
    repository: process.env.GITHUB_REPOSITORY,
    readToken: process.env.GITHUB_READ_TOKEN,
    projectToken: process.env.MOSAIC_PROJECTS_ROUTING_TOKEN
  });
  // Only public issue numbers, fixed project numbers and reason codes are logged.
  process.stdout.write(JSON.stringify(result) + '\n');
}
