// Debug 2: Trace bootstrap timing by dispatching console.log into the app
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[pageerror] ${err.message}\n${err.stack}`));

  // Set existing uuid
  const targetUuid = 'b843bc5b-efff-4988-896d-4b051494068d';
  await page.goto(BASE);
  await page.evaluate((uuid) => {
    localStorage.setItem('consultationApp.userUuid', uuid);
    localStorage.setItem('consultationApp.userName', 'テスト太郎');
  }, targetUuid);

  // Inject hooks BEFORE load: wrap fetch to trace
  await page.addInitScript(() => {
    const origFetch = window.fetch;
    window.__fetchLog = [];
    window.fetch = function(...args) {
      const url = args[0];
      window.__fetchLog.push(`fetch: ${typeof url === 'string' ? url : url.url}`);
      return origFetch.apply(this, args);
    };
  });

  console.log('Navigating back to /...');
  await page.goto(BASE);
  await page.waitForTimeout(5000);

  const fetchLog = await page.evaluate(() => window.__fetchLog || []);
  console.log('Fetch log:');
  for (const l of fetchLog) console.log('  ', l);

  const hash = await page.evaluate(() => location.hash);
  const hidden = await page.evaluate(() => document.getElementById('resume-modal').hidden);
  const html = await page.evaluate(() => document.getElementById('resume-modal').innerHTML);
  console.log('Final modal hidden:', hidden, 'len:', html.length);

  // Call bootstrap-like flow manually using app modules
  const manualResult = await page.evaluate(async () => {
    const api = await import('/js/api.js');
    const state = (await import('/js/state.js')).state;
    const resume = await import('/js/ui/resume.js');

    const payload = await api.getResumableSession();
    console.log('[debug-inject] payload keys:', payload ? Object.keys(payload).join(',') : 'null');
    if (payload && payload.session) {
      console.log('[debug-inject] calling showModal manually');
      resume.showModal(payload);
    }
    return { hasPayload: !!payload, hasSession: !!(payload && payload.session) };
  });
  console.log('Manual result:', manualResult);

  await page.waitForTimeout(500);
  const hiddenAfter = await page.evaluate(() => document.getElementById('resume-modal').hidden);
  const htmlAfter = await page.evaluate(() => document.getElementById('resume-modal').innerHTML);
  console.log('After manual showModal: hidden=', hiddenAfter, 'htmlLen=', htmlAfter.length);

  console.log('\n--- Console logs ---');
  for (const l of logs) console.log(l);

  await browser.close();
})();
