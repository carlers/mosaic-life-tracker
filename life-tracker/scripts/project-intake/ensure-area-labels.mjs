import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPOSITORY, ROUTES } from './route-issue.mjs';

export const NEW_AREA_LABELS = Object.freeze([
  {
    name: 'area:social',
    color: 'ededed',
    description: 'Route social-experience issues to private GitHub Project #6.'
  },
  {
    name: 'area:storage',
    color: 'ededed',
    description: 'Route storage and media-lifecycle issues to private GitHub Project #7.'
  },
  {
    name: 'area:product',
    color: 'ededed',
    description: 'Route product-discovery and support issues to private GitHub Project #8.'
  },
  {
    name: 'area:platform',
    color: 'ededed',
    description: 'Route platform and engineering issues to private GitHub Project #9.'
  }
]);

for (const label of NEW_AREA_LABELS) {
  if (!ROUTES.some(route => route.label === label.name)) {
    throw Error('Area label has no fixed Project destination: ' + label.name);
  }
}

const API = 'https://api.github.com';
const headers = token => ({
  authorization: 'Bearer ' + token,
  accept: 'application/vnd.github+json',
  'content-type': 'application/json',
  'x-github-api-version': '2022-11-28',
  'user-agent': 'mosaic-project-area-label-bootstrap'
});

async function request(fetcher, url, token, method = 'GET', body) {
  if (typeof token !== 'string' || !token) throw Error('Missing GitHub authorization');
  return fetcher(url, {
    method,
    headers: headers(token),
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000)
  });
}

async function verifyLabel(response, expectedName) {
  if (!response.ok) throw Error('GitHub label API request failed (HTTP ' + response.status + ')');
  const label = await response.json();
  if (typeof label?.name !== 'string' || label.name.toLowerCase() !== expectedName) {
    throw Error('GitHub label readback identity mismatch: ' + expectedName);
  }
}

export async function ensureAreaLabels({ token, fetcher = fetch }) {
  if (typeof token !== 'string' || !token) throw Error('Missing GitHub authorization');
  const collection = API + '/repos/' + REPOSITORY + '/labels';
  const created = [];
  const existing = [];

  for (const label of NEW_AREA_LABELS) {
    const labelUrl = collection + '/' + encodeURIComponent(label.name);
    let response = await request(fetcher, labelUrl, token);

    if (response.status === 404) {
      response = await request(fetcher, collection, token, 'POST', label);
      if (response.status === 422) {
        // Another concurrent run may have created the exact fixed label.
        response = await request(fetcher, labelUrl, token);
        await verifyLabel(response, label.name);
        existing.push(label.name);
        continue;
      }
      await verifyLabel(response, label.name);
      created.push(label.name);
      continue;
    }

    await verifyLabel(response, label.name);
    existing.push(label.name);
  }

  return { created, existing };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await ensureAreaLabels({ token: process.env.GITHUB_TOKEN });
  process.stdout.write(JSON.stringify(result) + '\n');
}
