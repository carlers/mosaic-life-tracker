import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// TEST ONLY. Rewrite files in the disposable GitHub runner after its baseline
// build, never in a branch commit or deployed code. Fail if the baseline drifts.
function replaceOnce(source, needle, replacement, file) {
  if (source.split(needle).length !== 2) {
    throw new Error('Cannot uniquely locate ' + JSON.stringify(needle) + ' in ' + file);
  }
  return source.replace(needle, replacement);
}

const appPath = resolve('src/App.tsx');
let app = readFileSync(appPath, 'utf8');
app = replaceOnce(app, 'import { AuthPage } from "./pages/AuthPage";\n', '', appPath);
app = replaceOnce(app, 'import { ResetPasswordPage } from "./pages/ResetPasswordPage";\n', '', appPath);
app = replaceOnce(app, 'const HomePage = lazy(() =>', `
const AuthPage = lazy(() =>
  import('./pages/AuthPage').then(({ AuthPage }) => ({ default: AuthPage })),
);
const ResetPasswordPage = lazy(() =>
  import('./pages/ResetPasswordPage').then(({ ResetPasswordPage }) => ({
    default: ResetPasswordPage,
  })),
);
const HomePage = lazy(() =>`, appPath);
writeFileSync(appPath, app);

const mainPath = resolve('src/main.tsx');
let main = readFileSync(mainPath, 'utf8');
// Start route-specific login JS in parallel with React mounting. Preserve the
// existing eager ability to show Login without waiting for RxDB or Appwrite.
main = replaceOnce(main, 'ReactDOM.createRoot(document.getElementById(\'root\')!).render(', `
if (!hasCachedIdentity && window.location.pathname === '/login') {
  void import('./pages/AuthPage').catch(() => {});
}
if (window.location.pathname === '/reset-password') {
  void import('./pages/ResetPasswordPage').catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')!).render(`, mainPath);
writeFileSync(mainPath, main);
console.log('Applied experimental auth-only route split in disposable runner.');
