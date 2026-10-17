import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

// #858 disposable diagnostic only. The source is modified *in CI checkout*
// before production build; neither this hybrid module nor the build is deployed.
const path = 'src/components/home/views/TaskBlock.tsx';
const original = execFileSync('git', [
  'show', '41d196afd557d2e0d499cb9423e196d46e83adf4:life-tracker/' + path,
], { encoding: 'utf8' });
const optimized = await readFile(path, 'utf8');
const signature = 'export const TaskBlock: React.FC<TaskBlockProps>';
if (original.split(signature).length !== 2 || optimized.split(signature).length !== 2) {
  throw new Error('Unexpected TaskBlock component signature; stop this diagnostic');
}
const legacyBody = original.slice(original.indexOf(signature))
  .replace(signature, 'const LegacyTaskBlock: React.FC<TaskBlockProps>');
const candidate = optimized.replace(signature, 'const OptimizedTaskBlock: React.FC<TaskBlockProps>');
const variant = `
type CalendarAuditWindow = Window & { __mosaic858CalendarVariant?: 'legacy' | 'optimized' };
export const TaskBlock: React.FC<TaskBlockProps> = props =>
  (window as CalendarAuditWindow).__mosaic858CalendarVariant === 'legacy'
    ? <LegacyTaskBlock {...props} />
    : <OptimizedTaskBlock {...props} />;
`;
await writeFile(path, candidate + '\n' + legacyBody + '\n' + variant);
console.log('Calendar baseline/candidate diagnostic compiled into ONE throwaway build.');
