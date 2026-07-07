/*
 * Adds the dashboard controller import and replaces only the existing
 * /admin/dashboard route. It deliberately does not overwrite any other
 * routes added in your current adminRoutes.js file.
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const routeFile = path.join(projectRoot, 'src', 'routes', 'adminRoutes.js');

if (!fs.existsSync(routeFile)) {
    console.error(`adminRoutes.js not found: ${routeFile}`);
    process.exit(1);
}

let source = fs.readFileSync(routeFile, 'utf8');
const importLine = "const adminDashboardController = require('../controllers/adminDashboardController');";

if (!source.includes(importLine)) {
    const lastRequireIndex = source.lastIndexOf("require('");
    if (lastRequireIndex === -1) {
        console.error('Could not find the route imports in adminRoutes.js. Use docs/ROUTE_CHANGE.md instead.');
        process.exit(1);
    }

    const lineEnd = source.indexOf('\n', lastRequireIndex);
    source = source.slice(0, lineEnd + 1) + importLine + '\n' + source.slice(lineEnd + 1);
}

const controllerRoute = "router.get('/dashboard', authBouncer(['superadmin', 'admin', 'employee']), adminDashboardController.showDashboard);";
const inlineDashboardRoute = /router\.get\(\s*(['"])\/dashboard\1\s*,\s*authBouncer\(\s*\[[\s\S]*?\]\s*\)\s*,\s*\(req\s*,\s*res\)\s*=>\s*\{\s*res\.render\(\s*(['"])admin\/dashboard\2\s*\)\s*;?\s*\}\s*\);/;

if (source.includes('adminDashboardController.showDashboard')) {
    console.log('Dashboard route is already connected. No route change was needed.');
    process.exit(0);
}

if (!inlineDashboardRoute.test(source)) {
    console.error('Could not automatically replace the current dashboard route. No change was made.');
    console.error('Open docs/ROUTE_CHANGE.md and apply the 2-line change manually.');
    process.exit(1);
}

const backupFile = `${routeFile}.before_interactive_dashboard.bak`;
if (!fs.existsSync(backupFile)) {
    fs.writeFileSync(backupFile, fs.readFileSync(routeFile, 'utf8'));
}

source = source.replace(inlineDashboardRoute, controllerRoute);
fs.writeFileSync(routeFile, source);
console.log('Dashboard route connected successfully. Backup created:', backupFile);
