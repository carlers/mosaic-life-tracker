#!/usr/bin/env node
import {
  bootstrapMosaicProject,
  parseBootstrapArgs,
  renderBrowserEnv,
  writeBrowserEnvFile,
} from './lib/mosaic-bootstrap.mjs';
import { BOOTSTRAP_API_KEY_SCOPES } from '../infrastructure/mosaic-backend.mjs';

const HELP = `
Mosaic backend bootstrap

Usage:
  APPWRITE_API_KEY=... npm run mosaic:bootstrap -- \\
    --project <project-id> \\
    --endpoint https://<region>.cloud.appwrite.io/v1 \\
    [--web-hostname localhost] \\
    [--web-hostname mosaic.example.com]

Options:
  --project <id>               Empty Appwrite project to provision.
  --endpoint <url>             Appwrite API endpoint. Defaults to Singapore Cloud.
  --web-hostname <hostname>    Allowed web origin. Repeat for multiple hostnames.
                               Defaults to localhost.
  --message-function-id <id>   Function ID for message-action (default: message_action).
  --with-dr                    Also deploy schedule-disabled disaster recovery.
  --dr-function-id <id>        DR Function ID (default: dr_backup).
  --env-file <path>            Browser env output (default: .env.local).
  --no-env-file                Do not write browser env file.
  --overwrite-env              Replace an existing env output file.
  --platform-only              Only add missing web hostnames to an existing project.
  --print-scopes               Print the temporary API-key scopes and exit.
  --help                       Show this help.

Required temporary API-key scopes:
  ${BOOTSTRAP_API_KEY_SCOPES.join(', ')}

Safety:
  Normal bootstrap refuses projects that already contain users, databases,
  Storage buckets, or Functions. If a provisioning run fails after creating
  resources, delete/recreate the disposable empty project before retrying.
`.trim();

export async function runBootstrapCli({
  argv = process.argv.slice(2),
  env = process.env,
  log = console.log,
  error = console.error,
} = {}) {
  if (argv.includes('--help')) {
    log(HELP);
    return { help: true };
  }
  if (argv.includes('--print-scopes')) {
    log(BOOTSTRAP_API_KEY_SCOPES.join('\n'));
    return { scopes: BOOTSTRAP_API_KEY_SCOPES };
  }

  const config = parseBootstrapArgs(argv, env);
  log(`Bootstrapping Mosaic against ${config.projectId}...`);
  const result = await bootstrapMosaicProject(config, {
    log: (message) => log(`  ${message}`),
  });

  let envPath = null;
  if (config.writeEnv && !config.platformOnly) {
    envPath = await writeBrowserEnvFile(config);
  }

  log('');
  if (config.platformOnly) {
    log(
      result.platforms.length
        ? `Added web platform(s): ${result.platforms.join(', ')}`
        : 'All requested web platforms already exist.'
    );
  } else {
    log('Mosaic backend bootstrap complete.');
    log(`Database: ${result.databaseId}`);
    log(`Tables: ${result.tableIds.join(', ')}`);
    log(`Storage bucket: ${result.bucketId}`);
    log(`message-action Function: ${result.messageFunctionId}`);
    if (result.drFunctionId) {
      log(`DR Function: ${result.drFunctionId} (schedule disabled)`);
    } else {
      log('DR Function: not provisioned (optional; rerun on a fresh project with --with-dr).');
    }
    if (envPath) log(`Browser config written to ${envPath}`);
    log('');
    log('Browser environment:');
    log(renderBrowserEnv(config).trimEnd());
    log('');
    log('Next: revoke/delete the temporary Appwrite provisioning API key.');
    log('Then run npm run dev, or copy these VITE_ variables into your host.');
  }

  return { ...result, envPath };
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirectRun) {
  runBootstrapCli().catch((cause) => {
    console.error(
      `Mosaic bootstrap failed: ${cause instanceof Error ? cause.message : 'unknown error'}`
    );
    process.exitCode = 1;
  });
}
