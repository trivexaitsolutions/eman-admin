const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const rootDir = path.join(__dirname, '..');
const outputDir = path.join(rootDir, 'docs', 'mitra-portal-screenshots');
const manifestPath = path.join(outputDir, 'screenshot-manifest.json');
const baseUrl = (process.env.MITRA_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const email = process.env.MITRA_EMAIL;
const password = process.env.MITRA_PASSWORD;
const chromePath = process.env.MITRA_CHROME_PATH || 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const viewport = { width: 680, height: 980, deviceScaleFactor: 1, mobile: false };

if (!email || !password) {
  console.error('Set MITRA_EMAIL and MITRA_PASSWORD in the environment before capturing screenshots.');
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
  await delay(800);
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

async function screenshotCurrent(devtools, item, manifest) {
  await evaluate(devtools, 'document.fonts ? document.fonts.ready.then(() => true) : true');
  await delay(250);
  const screenshot = await devtools.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: viewport.width, height: viewport.height, scale: 1 },
  });
  const filename = `${item.name}.png`;
  fs.writeFileSync(path.join(outputDir, filename), Buffer.from(screenshot.data, 'base64'));
  manifest.captured.push({
    name: item.name,
    title: item.title,
    path: await getPath(devtools),
    file: `mitra-portal-screenshots/${filename}`,
    width: viewport.width,
    height: viewport.height,
    note: item.note || '',
  });
}

async function capturePage(devtools, item, manifest) {
  try {
    const landed = await navigate(devtools, `${baseUrl}${item.path}`);
    const currentPath = await getPath(devtools);
    if (item.accept && !item.accept(currentPath)) {
      manifest.skipped.push({ name: item.name, path: item.path, reason: `Redirected to ${currentPath}` });
      return;
    }
    await screenshotCurrent(devtools, item, manifest);
    return landed;
  } catch (error) {
    manifest.skipped.push({ name: item.name, path: item.path, reason: error.message });
  }
}

async function captureByLink(devtools, listPath, pattern, item, manifest) {
  await navigate(devtools, `${baseUrl}${listPath}`);
  const matchingPath = await firstHrefMatching(devtools, pattern);
  if (!matchingPath) {
    manifest.skipped.push({ name: item.name, path: `${listPath} (first matching record)`, reason: 'No matching record is present in the list.' });
    return null;
  }
  return matchingPath;
}

async function captureClientWizard(devtools, route, prefix, mode, manifest) {
  await navigate(devtools, `${baseUrl}${route}`);
  if ((await getPath(devtools)) !== route.split('?')[0]) {
    manifest.skipped.push({ name: `${prefix}-step-1`, path: route, reason: `Redirected to ${await getPath(devtools)}` });
    return;
  }

  await evaluate(devtools, `(() => {
    try {
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
        getCurrentPosition: (success) => success({ coords: { latitude: 19.2183, longitude: 73.0867, accuracy: 12 } })
      }});
    } catch (_) {}
    return true;
  })()`);

  for (let step = 1; step <= 3; step += 1) {
    if (step === 1) {
      if (mode === 'add') {
        await evaluate(devtools, `(() => {
          const set = (selector, value) => { const node = document.querySelector(selector); if (node) { node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true })); } };
          set('[name="contactName"]', 'Demo Contact');
          set('#clientPhone', '9999990001');
          set('[name="email"]', 'demo-contact@example.test');
          return true;
        })()`);
      }
    } else if (step === 2 && mode === 'add') {
      await evaluate(devtools, `(() => {
        const set = (selector, value) => { const node = document.querySelector(selector); if (node) { node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true })); } };
        set('#siteAddress', 'Demo Work Site, Test Road, Sample Area');
        set('[name="workerRequirement"]', '1-5');
        return true;
      })()`);
    } else if (step === 3 && mode === 'add') {
      await evaluate(devtools, `(() => {
        const otp = document.querySelector('#otpInput');
        if (otp) otp.value = '1234';
        document.querySelector('#verifyOtpBtn')?.click();
        return true;
      })()`);
    }

    await delay(step === 2 ? 750 : 180);
    await screenshotCurrent(devtools, {
      name: `${prefix}-step-${step}`,
      title: `${mode === 'edit' ? 'Edit' : 'Add'} Client - Step ${step}`,
    }, manifest);
    if (step === 3) break;
    await evaluate(devtools, "document.querySelector('#nextBtn')?.click(); true");
    await delay(step === 1 ? 800 : 700);
  }
}

async function fillWorkerBasicDetails(devtools) {
  await evaluate(devtools, `(() => {
    const set = (selector, value) => { const node = document.querySelector(selector); if (node) { node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true })); } };
    set('#workerName', 'Documentation Demo Worker');
    set('#workerPhone', '9999990002');
    set('#workerPassword', 'DemoPass123');
    set('#workerDob', '1995-06-15');
    set('#workerGender', 'MALE');
    set('#heightCm', '170');
    set('#weightKg', '70');
    set('#workerPincode', '421201');
    set('#workerAddress', 'Demo Worker Address, Test Road, Sample Area');
    return true;
  })()`);
}

async function prepareWorkerStep(devtools, step, mode) {
  if (step === 1) {
    if (mode === 'add') await fillWorkerBasicDetails(devtools);
    else await evaluate(devtools, `(() => {
      const setIfEmpty = (selector, value) => { const node = document.querySelector(selector); if (node && !node.value) { node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true })); } };
      const phone = document.querySelector('#workerPhone');
      if (phone && !/^[6-9]\\d{9}$/.test(phone.value.replace(/\\D/g, ''))) { phone.value = '9999990003'; phone.dispatchEvent(new Event('input', { bubbles: true })); }
      setIfEmpty('#workerGender', 'MALE');
      setIfEmpty('#heightCm', '170');
      setIfEmpty('#weightKg', '70');
      setIfEmpty('#workerPincode', '421201');
      setIfEmpty('#workerAddress', 'Demo Worker Address, Test Road, Sample Area');
      return true;
    })()`);
  }
  if (step === 2 && mode === 'add') {
    await evaluate(devtools, `(() => {
      const proof = document.querySelector('#idProofType');
      if (proof) { proof.value = 'VOTING'; proof.dispatchEvent(new Event('change', { bubbles: true })); }
      const number = document.querySelector('#idNumber');
      if (number) { number.value = 'DOCVOTE12345'; number.dispatchEvent(new Event('input', { bubbles: true })); }
      return true;
    })()`);
  }
  if (step === 3 && mode === 'add') {
    await evaluate(devtools, `(() => {
      const skill = document.querySelector('.skill-check');
      if (skill && !skill.checked) { skill.checked = true; skill.dispatchEvent(new Event('change', { bubbles: true })); }
      const pincode = document.querySelector('#nakaSearchPincode');
      if (pincode) { pincode.value = '421201'; pincode.dispatchEvent(new Event('input', { bubbles: true })); }
      return true;
    })()`);
    await delay(900);
    await evaluate(devtools, `(() => {
      const naka = document.querySelector('.naka-check');
      if (naka && !naka.checked) naka.click();
      return true;
    })()`);
  }
  if (step === 4) {
    await evaluate(devtools, `(() => {
      const upi = document.querySelector('#upiId');
      if (upi && !upi.value) upi.value = 'demo@example.test';
      return true;
    })()`);
  }
}

async function captureWorkerWizard(devtools, route, prefix, mode, manifest) {
  await navigate(devtools, `${baseUrl}${route}`);
  if ((await getPath(devtools)) !== route.split('?')[0]) {
    manifest.skipped.push({ name: `${prefix}-step-1`, path: route, reason: `Redirected to ${await getPath(devtools)}` });
    return;
  }
  for (let step = 1; step <= 5; step += 1) {
    await prepareWorkerStep(devtools, step, mode);
    if (step === 3 && mode === 'add') await delay(850);
    await screenshotCurrent(devtools, {
      name: `${prefix}-step-${step}`,
      title: `${mode === 'edit' ? 'Edit' : 'Add'} Worker - Step ${step}`,
    }, manifest);
    if (step === 5) break;
    await evaluate(devtools, "document.querySelector('#nextBtn')?.click(); true");
    await delay(step === 3 ? 650 : 350);
    const activeStep = await evaluate(devtools, `(() => {
      const match = document.querySelector('.step-section.active')?.id?.match(/step-(\\d+)/);
      return match ? Number(match[1]) : 0;
    })()`);
    if (activeStep !== step + 1) {
      for (let remaining = step + 1; remaining <= 5; remaining += 1) {
        manifest.skipped.push({ name: `${prefix}-step-${remaining}`, path: route, reason: `Wizard validation stopped at step ${activeStep}.` });
      }
      break;
    }
  }
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const port = await getFreePort();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eman-mitra-docs-chrome-'));
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
  const manifest = { baseUrl, viewport, demoMitraEmail: email, captured: [], skipped: [] };

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
    if (!target?.webSocketDebuggerUrl) throw new Error('Chrome DevTools did not start. Check MITRA_CHROME_PATH.');

    devtools = await DevTools.connect(target.webSocketDebuggerUrl);
    await devtools.send('Page.enable');
    await devtools.send('Runtime.enable');
    await devtools.send('Page.setDeviceMetricsOverride', viewport);

    await navigate(devtools, `${baseUrl}/mitra/login`);
    await screenshotCurrent(devtools, { name: '01-login', title: 'Mitra sign in' }, manifest);

    await evaluate(devtools, `(() => {
      const emailField = document.querySelector('input[name="email"]');
      const passwordField = document.querySelector('input[name="password"]');
      if (!emailField || !passwordField) return false;
      emailField.value = ${JSON.stringify(email)};
      passwordField.value = ${JSON.stringify(password)};
      return true;
    })()`);
    await evaluate(devtools, "document.querySelector('form')?.requestSubmit(); true");
    let authResult = 'Login redirect timed out.';
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await delay(250);
      const currentPath = await getPath(devtools);
      if (currentPath === '/mitra/dashboard') { authResult = 'ok'; break; }
      const alert = await evaluate(devtools, "document.querySelector('[role=alert]')?.innerText || ''");
      if (alert) { authResult = alert; break; }
    }
    if (authResult !== 'ok') throw new Error(`Mitra login failed: ${authResult}`);

    const fixedPages = [
      { name: '02-dashboard', title: 'Dashboard', path: '/mitra/dashboard' },
      { name: '03-clients', title: 'Clients list', path: '/mitra/clients' },
      { name: '06-workers', title: 'Workers list', path: '/mitra/workers' },
      { name: '09-my-nakas', title: 'My Nakas', path: '/mitra/nakas' },
      { name: '10-submit-naka', title: 'Submit Naka form', path: '/mitra/nakas/add' },
      { name: '11-conflicts', title: 'Conflicts list', path: '/mitra/conflicts' },
      { name: '13-leaves', title: 'Mitra Leaves', path: '/mitra/leaves' },
    ];
    for (const item of fixedPages) {
      item.accept = (currentPath) => currentPath === item.path;
      await capturePage(devtools, item, manifest);
    }

    await navigate(devtools, `${baseUrl}/mitra/dashboard`);
    await evaluate(devtools, "document.querySelector('.mitra-nav-item[aria-label=\"Quick add\"]')?.click(); true");
    await delay(200);
    await screenshotCurrent(devtools, { name: '02-dashboard-quick-add', title: 'Dashboard quick-add menu', note: 'Temporary menu opened for capture; no action was submitted.' }, manifest);

    await captureClientWizard(devtools, '/mitra/clients/add', '04-client-add', 'add', manifest);
    const clientEdit = await captureByLink(devtools, '/mitra/clients', /\/mitra\/clients\/edit\/\d+/, { name: '05-client-edit', path: '' }, manifest);
    if (clientEdit) await captureClientWizard(devtools, clientEdit, '05-client-edit', 'edit', manifest);

    await captureWorkerWizard(devtools, '/mitra/workers/add', '07-worker-add', 'add', manifest);
    const workerEdit = await captureByLink(devtools, '/mitra/workers', /\/mitra\/workers\/edit\/\d+/, { name: '08-worker-edit', path: '' }, manifest);
    if (workerEdit) await captureWorkerWizard(devtools, workerEdit, '08-worker-edit', 'edit', manifest);

    const conflictDetail = await captureByLink(devtools, '/mitra/conflicts', /\/mitra\/conflicts\/\d+/, { name: '12-conflict-detail', path: '' }, manifest);
    if (conflictDetail) await capturePage(devtools, {
      name: '12-conflict-detail',
      title: 'Conflict review',
      path: conflictDetail,
      accept: (currentPath) => currentPath === conflictDetail,
    }, manifest);

    manifest.captured.sort((a, b) => a.name.localeCompare(b.name));
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`Captured ${manifest.captured.length} Mitra portal screenshots; skipped ${manifest.skipped.length}.`);
    for (const item of manifest.skipped) console.log(`SKIP ${item.name}: ${item.reason}`);
  } finally {
    if (devtools) devtools.close();
    chrome.kill();
    await delay(300);
    try { fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
