import { readFileSync } from 'node:fs';

const readFrontend = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readBackend = (path) =>
  readFileSync(new URL(`../../back-end/${path}`, import.meta.url), 'utf8');

const failures = [];
const requirePattern = (label, source, pattern) => {
  if (!pattern.test(source)) failures.push(`${label} is missing ${pattern}`);
};
const forbidPattern = (label, source, pattern) => {
  if (pattern.test(source)) failures.push(`${label} still matches ${pattern}`);
};

const auth = readFrontend('src/pages/Auth.jsx');
const authBrandPanel = (() => {
  try {
    return readFrontend('src/pages/AuthBrandPanel.jsx');
  } catch {
    return '';
  }
})();
const protectedRoute = readFrontend('src/guards/ProtectedRoute.jsx');
const adminRoute = readFrontend('src/guards/AdminRoute.jsx');
const adminDashboard = readFrontend('src/pages/AdminDashboard.jsx');
const dialogShell = readFrontend('src/components/common/DialogShell.jsx');
const dependencies = readBackend('dependencies.py');
const contextController = readBackend('controller/context_controller.py');

requirePattern('Auth loading state', auth, /<PageLoader\s*\/>/);
requirePattern('Auth operation ownership', auth, /authOperation/);
requirePattern('Auth busy semantics', auth, /aria-busy=\{authBusy\}/);
requirePattern('Auth reset dialog', auth, /<DialogShell/);
requirePattern('Auth reset dialog title', auth, /headerTitleId="reset-password-title"/);
requirePattern('Auth reset focus ownership', auth, /resetEmailInputRef/);
requirePattern('Auth reset transition focus', auth, /transitionProps=/);
forbidPattern('Auth reset autofocus race', auth, /\bautoFocus\b/);
requirePattern('DialogShell title identifier', dialogShell, /headerTitleId/);
requirePattern('DialogShell transition contract', dialogShell, /transitionProps/);
forbidPattern('Auth persistence UI', auth, /\bCheckbox\b|remember-me|Remember me/);
requirePattern('Auth editorial panel composition', auth, /<AuthBrandPanel/);
requirePattern('Auth responsive layout contract', auth, /getAuthLayoutSx/);
requirePattern('Auth product promise', authBrandPanel, /From database to insight, all in one place\./);
requirePattern('Auth agentic capability copy', authBrandPanel, /Agentic workflows/);
requirePattern('Auth database engineering copy', authBrandPanel, /database engineering/);
requirePattern('Auth data analysis copy', authBrandPanel, /data analysis/);
requirePattern('Auth trust copy', authBrandPanel, /Secure by design/);
requirePattern('Auth decorative orbit semantics', authBrandPanel, /aria-hidden="true"/);

requirePattern('ProtectedRoute decision contract', protectedRoute, /getProtectedRouteDecision/);
requirePattern('AdminRoute decision contract', adminRoute, /getAdminRouteDecision/);

forbidPattern('Admin local font constants', adminDashboard, /const FONT_(?:MONO|SANS)/);
forbidPattern('Admin local spacing constants', adminDashboard, /const SPACE\s*=/);
requirePattern('Admin reduced-motion preference', adminDashboard, /prefers-reduced-motion:\s*reduce/);
requirePattern('Admin refresh busy semantics', adminDashboard, /aria-busy=\{refreshing\}/);
requirePattern('Admin telemetry live region', adminDashboard, /aria-live="polite"/);
requirePattern('Admin disclosure state', adminDashboard, /aria-expanded=\{redisExpanded\}/);

requirePattern('Backend admin dependency', dependencies, /async def require_admin_user/);
const adminDependencies = contextController.match(/Depends\(require_admin_user\)/g) ?? [];
if (adminDependencies.length !== 3) {
  failures.push(
    `context metrics routes require 3 admin dependencies, received ${adminDependencies.length}`,
  );
}

if (failures.length > 0) {
  console.error('FAIL: authentication and administration compliance audit');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('PASS: authentication and administration contracts are enforced.');
}
