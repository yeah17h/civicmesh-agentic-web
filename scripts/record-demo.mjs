import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');
const DEMO_DIR = path.join(ROOT, 'demo');
const RAW_DIR = path.join(ROOT, 'demo-raw');
const SHOTS_DIR = path.join(DEMO_DIR, 'screenshots');

fs.mkdirSync(DEMO_DIR, { recursive: true });
fs.mkdirSync(RAW_DIR, { recursive: true });
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.map': 'application/json'
};

function startStaticServer(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const cleanUrl = (req.url || '/').split('?')[0];
      let filePath = path.join(dir, cleanUrl === '/' ? 'index.html' : cleanUrl);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(dir, 'index.html');
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function findBrowserExecutable() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('No Chrome or Edge executable found on this machine.');
}

async function setCaption(page, stepBadge, text) {
  await page.evaluate(
    ({ badge, body }) => {
      let bar = document.getElementById('civicmesh-demo-caption');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'civicmesh-demo-caption';
        bar.style.cssText = [
          'position:fixed',
          'left:50%',
          'bottom:18px',
          'transform:translateX(-50%)',
          'z-index:99999',
          'max-width:920px',
          'width:calc(100% - 48px)',
          'background:rgba(2,6,23,0.92)',
          'border:1px solid rgba(52,211,153,0.45)',
          'box-shadow:0 12px 32px rgba(0,0,0,0.65)',
          'border-radius:14px',
          'padding:11px 18px',
          'display:flex',
          'align-items:center',
          'gap:12px',
          'font-family:Inter,Segoe UI,sans-serif',
          'backdrop-filter:blur(8px)',
          'pointer-events:none'
        ].join(';');
        document.body.appendChild(bar);
      }
      bar.innerHTML =
        `<span style="background:rgba(16,185,129,0.18);color:#6ee7b7;border:1px solid rgba(52,211,153,0.4);padding:3px 9px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:0.06em;white-space:nowrap;text-transform:uppercase;">${badge}</span>` +
        `<span style="color:#f1f5f9;font-size:14px;font-weight:600;line-height:1.35;">${body}</span>`;
    },
    { badge: stepBadge, body: text }
  );
}

async function hideCaption(page) {
  await page.evaluate(() => {
    const bar = document.getElementById('civicmesh-demo-caption');
    if (bar) bar.style.display = 'none';
  });
}

async function showCaption(page) {
  await page.evaluate(() => {
    const bar = document.getElementById('civicmesh-demo-caption');
    if (bar) bar.style.display = 'flex';
  });
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error('dist/ not found. Run "npm run build" first.');
  }

  const executablePath = findBrowserExecutable();
  const { server, url } = await startStaticServer(DIST_DIR);
  console.log(`Serving production build at ${url}`);
  console.log(`Using browser: ${executablePath}`);

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: RAW_DIR,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();
  const video = page.video();

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="total-open-beds"]');
    await wait(1200);

    // Capture clean dashboard screenshot (without caption bar)
    await page.screenshot({ path: path.join(SHOTS_DIR, '01-dashboard.png'), fullPage: false });

    // Scene 1: Intro
    await setCaption(
      page,
      '1 / 6 · CivicMesh',
      'Open Agentic Web for Federated Disaster Relief — running 100% client-side with zero backend servers.'
    );
    await wait(4500);

    // Scene 2: MVS JSON Spec Inspector
    await setCaption(
      page,
      '2 / 6 · MVS Spec',
      'Inspecting public agent-manifest.json, host agent-network.json, and SHA-256 verified federated peers.'
    );
    await page.click('[data-testid="inspect-spec-btn"]');
    await wait(2400);
    await page.getByRole('button', { name: 'agent-manifest.json' }).click();
    await wait(2200);
    await page.getByRole('button', { name: 'Peer: metro-clinic-triage' }).click();
    await wait(2400);
    // Close drawer
    await page.locator('[role="dialog"] button').first().click();
    await wait(800);

    // Scene 3: BYOK LLM Gateway
    await setCaption(
      page,
      '3 / 6 · BYOK LLM',
      'Users supply their own Mozilla Otari, OpenAI, Gemini, or local Ollama keys in-browser ($0 host LLM cost).'
    );
    await page.click('[data-testid="byok-config-btn"]');
    await wait(3200);
    await page.getByRole('button', { name: 'Save & Apply' }).click();
    await wait(800);

    // Scene 4: Multi-Peer Coordination + HITL Approval Modal
    await setCaption(
      page,
      '4 / 6 · Multi-Peer + HITL',
      'Running Harbor Family Evacuation: coordinating Host Shelters + Clinic Peer + SafeRoute Transit Peer.'
    );
    await page.click('[data-testid="scenario-evac-insulin"]');

    // Wait for HITL Approval Modal to appear
    await page.waitForSelector('[data-testid="hitl-approve-btn"]', { timeout: 15000 });
    await hideCaption(page);
    await wait(400);
    await page.screenshot({ path: path.join(SHOTS_DIR, '02-hitl-approval.png'), fullPage: false });
    await showCaption(page);
    await setCaption(
      page,
      '4 / 6 · HITL Safety Gate',
      'Write action paused! Reviewing strict JSON-Schema-validated payload before mutating live shelter beds.'
    );
    await wait(4500);

    // Approve Write Action
    await page.click('[data-testid="hitl-approve-btn"]');
    await page.waitForSelector('[data-testid="coordinator-result"]', { timeout: 10000 });
    await wait(1200);
    await hideCaption(page);
    await page.screenshot({ path: path.join(SHOTS_DIR, '03-coordinated-plan.png'), fullPage: false });
    await showCaption(page);
    await setCaption(
      page,
      '4 / 6 · State Verified',
      'Approved! Open beds dropped 100 -> 97, HITL ticket logged, and clinic + flood detour plan synthesized.'
    );
    await wait(4800);

    // Scene 5: Strict JSON Schema Security Guard
    await setCaption(
      page,
      '5 / 6 · Schema Guard',
      'Red-team test: firing malformed & injected arguments — blocked client-side BEFORE hitting site handlers!'
    );
    await page.click('[data-testid="schema-guard-btn"]');
    await wait(4500);

    // Scene 6: Dynamic External Peer Federation
    await setCaption(
      page,
      '6 / 6 · Open Federation',
      'Dynamically discovering & SHA-256 verifying a 3rd-party Volunteer Mutual-Aid Mesh peer JSON at runtime.'
    );
    await page.click('[data-testid="tab-peers"]');
    await wait(1600);
    await page.click('[data-testid="connect-peer-btn"]');
    await page.waitForSelector('[data-testid="peer-connect-status"]', { timeout: 5000 });
    await wait(1200);
    await hideCaption(page);
    await page.screenshot({ path: path.join(SHOTS_DIR, '04-peer-federation.png'), fullPage: false });
    await showCaption(page);
    await wait(3800);

    // Final Outro
    await page.click('[data-testid="tab-trace"]');
    await setCaption(
      page,
      'CivicMesh · MIT Open Source',
      'Declarative JSON + Browser Runtime + Cross-Site Federation + HITL Safety. Ready for the Open Agentic Web!'
    );
    await wait(4200);
  } finally {
    await context.close();
    await browser.close();
    server.close();
  }

  const rawWebmPath = await video.path();
  const outputMp4Path = path.join(DEMO_DIR, 'civicmesh-demo.mp4');
  console.log(`Recorded raw video: ${rawWebmPath}`);
  console.log(`Transcoding to crisp H.264 MP4: ${outputMp4Path}`);

  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      rawWebmPath,
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-r',
      '30',
      outputMp4Path
    ],
    { stdio: 'inherit' }
  );

  // Verify final file size
  const stat = fs.statSync(outputMp4Path);
  console.log(`SUCCESS! Demo video ready at ${outputMp4Path} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Screenshots saved in ${SHOTS_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
