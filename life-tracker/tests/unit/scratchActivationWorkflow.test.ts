import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const workflow = readFileSync(
  fileURLToPath(new URL('../../../.github/workflows/scratch-backend-activation.yml', import.meta.url)),
  'utf8',
);

describe('Scratch backend activation source authorization', () => {
  it('requires an exact current integration source with a full successful push CI', () => {
    expect(workflow).toContain('SOURCE_BRANCH: refactor/scratch-backend-integration-526');
    expect(workflow).toContain('"$SOURCE_SHA" == "$current_head"');
    expect(workflow).toContain('.name == "Quality Gate"');
    expect(workflow).toContain('.event == "push"');
    expect(workflow).toContain('.head_branch == $branch');
    expect(workflow).toContain('.conclusion == "success"');
    expect(workflow).toContain('actions: read');
  });

  it('does not expose Appwrite credentials to candidate install and test steps', () => {
    const jobEnv = workflow.split('    env:\n')[1].split('    steps:\n')[0];
    expect(jobEnv).not.toContain('APPWRITE_API_KEY:');
    const candidateStep = workflow.split('      - name: Install and validate combined candidate')[1]
      .split('      - name: Require clean managed-state')[0];
    expect(candidateStep).not.toContain('APPWRITE_API_KEY');
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow.match(/APPWRITE_API_KEY: \$\{\{ secrets\.MOSAIC_SCRATCH_APPWRITE_API_KEY \}\}/g)).toHaveLength(4);
  });

  it('serializes manually approved activations and refuses implicit production targeting', () => {
    expect(workflow).toContain('group: mosaic-scratch-backend-writer');
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("inputs.confirm == 'activate-scratch'");
    expect(workflow).toContain('environment: scratch-backend');
    expect(workflow).toContain('APPWRITE_PROJECT_ID: 6a96e82d000d1310b3be');
  });
});
