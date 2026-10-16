#!/usr/bin/env node
import { assessPublicPreviewBuild } from './lib/preview-public-profile.mjs';
const result = assessPublicPreviewBuild(process.env);
console.log('Mosaic CI browser-public build profile: ' +
  (result.preview ? 'Preview' : 'Production') +
  ', GIPHY ' + result.giphy + ', PostHog ' + result.posthog +
  ', mandatory parity ' + (result.mandatory ? 'ON' : 'not yet enabled'));
if (!result.eligible) {
  console.error('Build profile refused: ' + result.reasons.join('; '));
  process.exitCode = 1;
}
