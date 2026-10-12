const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const rootDir = path.join(__dirname, '..');
const outputDir = path.join(rootDir, 'docs', 'screenshots');
const manifestPath = path.join(outputDir, 'screenshot-manifest.json');
const baseUrl = (process.env.ADMIN_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const chromePath = process.env.ADMIN_CHROME_PATH || 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const viewport = { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false };

if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment before capturing screenshots.');
  process.exit(1);
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

class DevTools {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result || {});
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    return new DevTools(socket);
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(devtools, expression) {
  const result = await devtools.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result?.value;
}

async function navigate(devtools, url) {
  await devtools.send('Page.navigate', { url });
  await delay(950);
  return evaluate(devtools, 'location.href');
}

async function getPath(devtools) {
  return evaluate(devtools, 'location.pathname');
}

async function firstHrefMatching(devtools, expression) {
  const pattern = JSON.stringify(expression.source);
  return evaluate(devtools, `(() => {
    const matcher = new RegExp(${pattern});
    const link = [...document.querySelectorAll('a[href]')].find((item) => matcher.test(item.getAttribute('href')));
    return link ? new URL(link.href).pathname : null;
  })()`);
}

async function capture(devtools, item, manifest) {
  try {
    const landedUrl = await navigate(devtools, `${baseUrl}${item.path}`);
    const currentPath = await getPath(devtools);
    if (!item.accept(currentPath)) {
      manifest.skipped.push({ name: item.name, path: item.path, reason: `Redirected to ${currentPath}` });
      return;
    }

    await evaluate(devtools, `document.fonts ? document.fonts.ready.then(() => true) : true`);
    if (item.populateSimulator) {
      await delay(700);
      await evaluate(devtools, `(() => {
        const count = document.querySelector('#instanceCount');
        if (count) count.value = '3';
        document.querySelector('#allocateBtn')?.click();
        return true;
      })()`);
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const cardCount = await evaluate(devtools, `document.querySelectorAll('#phoneGrid [data-worker]').length`);
        if (cardCount > 0) break;
        await delay(300);
      }
      await delay(400);
    }
    await evaluate(devtools, `(() => {
      document.body.style.height = 'auto';
      document.body.style.minHeight = '100vh';
      document.body.style.overflow = 'visible';
      const shell = document.querySelector('body > div.flex-1');
      if (shell) {
        shell.style.height = 'auto';
        shell.style.minHeight = '100vh';
        shell.style.overflow = 'visible';
        shell.style.flex = '0 0 auto';
      }
      const main = document.querySelector('main');
      if (main) {
        main.style.height = 'auto';
        main.style.minHeight = 'calc(100vh - 64px)';
        main.style.maxHeight = 'none';
        main.style.overflow = 'visible';
        main.style.flex = '0 0 auto';
      }
      return true;
    })()`);
    await delay(300);
    const dimensions = await evaluate(devtools, `({
      width: ${viewport.width},
      height: ${viewport.height}
    })`);
    const screenshot = await devtools.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: dimensions.width, height: dimensions.height, scale: 1 },
    });

    const filename = `${item.name}.png`;
    fs.writeFileSync(path.join(outputDir, filename), Buffer.from(screenshot.data, 'base64'));
    manifest.captured.push({
      name: item.name,
      title: item.title,
      path: currentPath,
      landedUrl,
      file: `screenshots/${filename}`,
      width: dimensions.width,
      height: dimensions.height,
      note: item.note || '',
    });

    if (item.populateSimulator) {
      await evaluate(devtools, `(() => {
        window.confirm = () => true;
        document.querySelector('#releaseBtn')?.click();
        return true;
      })()`);
      await delay(500);
    }
  } catch (error) {
    manifest.skipped.push({ name: item.name, path: item.path, reason: error.message });
  }
}

async function captureByLink(devtools, listPath, expression, item, manifest) {
  await navigate(devtools, `${baseUrl}${listPath}`);
  const targetPath = await firstHrefMatching(devtools, expression);
  if (!targetPath) {
    manifest.skipped.push({ name: item.name, path: `${listPath} (first matching record)`, reason: 'No matching record is present in the list.' });
    return;
  }
  item.path = targetPath;
  item.accept = (currentPath) => currentPath === targetPath;
  await capture(devtools, item, manifest);
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const port = await getFreePort();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eman-admin-docs-chrome-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    `--window-size=${viewport.width},${viewport.height}`,
    '--force-device-scale-factor=1',
    'about:blank',
  ], { stdio: 'ignore' });
  let devtools;

  const manifest = { baseUrl, viewport, captured: [], skipped: [] };
  try {
    let target;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
        target = await response.json();
        break;
      } catch {
        await delay(250);
      }
    }
    if (!target?.webSocketDebuggerUrl) throw new Error('Chrome DevTools did not start. Check ADMIN_CHROME_PATH.');

    devtools = await DevTools.connect(target.webSocketDebuggerUrl);
    await devtools.send('Page.enable');
    await devtools.send('Runtime.enable');
    await devtools.send('Page.setDeviceMetricsOverride', viewport);

    await capture(devtools, {
      name: '01-login',
      title: 'Admin sign-in',
      path: '/admin/login',
      accept: (currentPath) => currentPath === '/admin/login',
    }, manifest);

    await navigate(devtools, `${baseUrl}/admin/login`);
    await evaluate(devtools, `(() => {
      const emailField = document.querySelector('input[name="email"]');
      const passwordField = document.querySelector('input[name="password"]');
      if (!emailField || !passwordField) return false;
      emailField.value = ${JSON.stringify(email)};
      passwordField.value = ${JSON.stringify(password)};
      return true;
    })()`);
    await evaluate(devtools, `document.querySelector('form').requestSubmit(); true`);
    let authResult = 'Login redirect timed out.';
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await delay(300);
      const currentPath = await getPath(devtools);
      if (currentPath === '/admin/dashboard') {
        authResult = 'ok';
        break;
      }
      const alert = await evaluate(devtools, `document.querySelector('[role="alert"]')?.innerText || ''`);
      if (alert) {
        authResult = alert;
        break;
      }
    }
    if (authResult !== 'ok') throw new Error(`Admin login failed: ${authResult}`);

    const fixedPages = [
      { name: '02-dashboard', title: 'Dashboard', path: '/admin/dashboard', note: 'Daily operational overview.' },
      { name: '03-states', title: 'States and Union Territories', path: '/admin/states' },
      { name: '04-cities', title: 'Cities list', path: '/admin/cities' },
      { name: '05-city-create', title: 'Create city', path: '/admin/cities/create' },
      { name: '06-skills', title: 'Skills list', path: '/admin/skills' },
      { name: '07-skill-create', title: 'Create skill', path: '/admin/skills/create' },
      { name: '08-nakas', title: 'Nakas list', path: '/admin/nakas' },
      { name: '09-naka-create', title: 'Create Naka', path: '/admin/nakas/create' },
      { name: '10-booking-settings', title: 'Booking Settings', path: '/admin/booking-settings' },
      { name: '11-employees', title: 'Employees list', path: '/admin/employees' },
      { name: '12-employee-create', title: 'Create employee', path: '/admin/employees/create' },
      { name: '13-mitras', title: 'Mitras list', path: '/admin/mitras' },
      { name: '14-mitra-create', title: 'Create Mitra', path: '/admin/mitras/create' },
      { name: '15-workers', title: 'Workers list', path: '/admin/workers' },
      { name: '16-worker-create', title: 'Create worker', path: '/admin/workers/create' },
      { name: '17-clients', title: 'Clients list', path: '/admin/clients' },
      { name: '18-bookings', title: 'Bookings list', path: '/admin/bookings' },
      { name: '19-online-workers', title: 'Online Workers', path: '/admin/bookings/online-workers' },
      { name: '21-conflicts', title: 'Conflict Management', path: '/admin/conflicts' },
      { name: '23-leave-management', title: 'Leave Management', path: '/admin/leaves' },
      { name: '24-my-leaves', title: 'My Leaves', path: '/admin/leaves/my' },
      { name: '25-simulator', title: 'App Simulator campaigns', path: '/admin/simulator' },
    ];

    for (const item of fixedPages) {
      item.accept = (currentPath) => currentPath === item.path;
      await capture(devtools, item, manifest);
    }

    const dynamicPages = [
      { list: '/admin/cities', pattern: /\/admin\/cities\/edit\/\d+/, item: { name: '05-city-edit', title: 'Edit city', path: '', accept: () => false } },
      { list: '/admin/skills', pattern: /\/admin\/skills\/edit\/\d+/, item: { name: '07-skill-edit', title: 'Edit skill', path: '', accept: () => false } },
      { list: '/admin/nakas', pattern: /\/admin\/nakas\/edit\/\d+/, item: { name: '09-naka-edit', title: 'Edit Naka', path: '', accept: () => false } },
      { list: '/admin/employees', pattern: /\/admin\/employees\/edit\/\d+/, item: { name: '12-employee-edit', title: 'Edit employee', path: '', accept: () => false } },
      { list: '/admin/mitras', pattern: /\/admin\/mitras\/edit\/\d+/, item: { name: '14-mitra-edit', title: 'Edit Mitra', path: '', accept: () => false } },
      { list: '/admin/workers', pattern: /\/admin\/workers\/edit\/\d+/, item: { name: '16-worker-edit', title: 'Edit worker', path: '', accept: () => false } },
      { list: '/admin/bookings', pattern: /\/admin\/bookings\/\d+/, item: { name: '20-booking-detail', title: 'Booking detail', path: '', accept: () => false } },
      { list: '/admin/conflicts', pattern: /\/admin\/conflicts\/\d+/, item: { name: '22-conflict-detail', title: 'Conflict detail', path: '', accept: () => false } },
      { list: '/admin/simulator', pattern: /\/admin\/simulator\/\d+/, item: { name: '26-simulator-campaign', title: 'Simulator campaign console', path: '', accept: () => false, populateSimulator: true } },
    ];
    for (const dynamicPage of dynamicPages) {
      await captureByLink(devtools, dynamicPage.list, dynamicPage.pattern, dynamicPage.item, manifest);
    }

    manifest.captured.sort((a, b) => a.name.localeCompare(b.name));
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`Captured ${manifest.captured.length} screenshots; skipped ${manifest.skipped.length}.`);
    for (const item of manifest.skipped) console.log(`SKIP ${item.name}: ${item.reason}`);
  } finally {
    if (devtools) devtools.close();
    chrome.kill();
    await delay(300);
    try {
      fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // Chrome can keep a short-lived profile lock while its subprocess exits.
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
