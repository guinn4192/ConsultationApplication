// Debug: なぜ resume modal が表示されないのか確認
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));
  page.on('requestfailed', req => logs.push(`[requestfailed] ${req.url()} - ${req.failure()?.errorText}`));

  // Set existing uuid (simulate post-onboarding state)
  const targetUuid = 'b843bc5b-efff-4988-896d-4b051494068d';
  await page.goto(BASE);
  await page.evaluate((uuid) => {
    localStorage.setItem('consultationApp.userUuid', uuid);
    localStorage.setItem('consultationApp.userName', 'テスト太郎');
  }, targetUuid);

  // Add hook: spy on resume modal show
  await page.addInitScript(() => {
    window.__spy = [];
    const origSet = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerHTML').set;
    Object.defineProperty(HTMLElement.prototype, 'innerHTML', {
      set(v) {
        if (this.id === 'resume-modal' && v) {
          window.__spy.push(`resume-modal innerHTML set to len=${v.length}`);
        }
        origSet.call(this, v);
      }
    });
  });

  console.log('Navigating back to /...');
  await page.goto(BASE);

  // 早期スナップショット（1秒後、2秒後、3秒後、5秒後）
  for (const t of [1000, 2000, 3000, 5000]) {
    await page.waitForTimeout(t - (t === 1000 ? 0 : 1000));
    const hash = await page.evaluate(() => location.hash);
    const hidden = await page.evaluate(() => document.getElementById('resume-modal').hidden);
    const htmlLen = await page.evaluate(() => document.getElementById('resume-modal').innerHTML.length);
    console.log(`  @${t}ms: hash=${hash}, modal hidden=${hidden}, modal HTML len=${htmlLen}`);
  }

  const hash = await page.evaluate(() => location.hash);
  const modalHidden = await page.evaluate(() => document.getElementById('resume-modal').hidden);
  const modalClass = await page.evaluate(() => document.getElementById('resume-modal').className);
  const modalHTML = await page.evaluate(() => document.getElementById('resume-modal').innerHTML);
  const welcomeExists = await page.locator('.message-welcome, #welcome-message').count();
  const headerName = await page.locator('#header-user-name').textContent();

  console.log('Hash:', hash);
  console.log('Modal hidden:', modalHidden);
  console.log('Modal class:', modalClass);
  console.log('Modal HTML length:', modalHTML.length);
  console.log('Modal HTML preview:', modalHTML.slice(0, 200));
  console.log('Welcome messages:', welcomeExists);
  console.log('Header:', headerName);

  // Manually call getResumableSession from page context
  const manualCall = await page.evaluate(async (uuid) => {
    const res = await fetch(`/api/sessions/resumable?uuid=${uuid}`, {
      headers: { 'x-user-uuid': uuid }
    });
    return { status: res.status, body: res.status === 200 ? await res.json() : null };
  }, targetUuid);
  console.log('Manual /api/sessions/resumable call:', manualCall.status, manualCall.body ? 'has body' : 'empty');

  // Try calling getResumableSession via the app's own api.js
  const viaApiJs = await page.evaluate(async () => {
    try {
      const mod = await import('/js/api.js');
      const result = await mod.getResumableSession();
      return { ok: true, hasSession: !!(result && result.session), preview: result ? Object.keys(result).join(',') : 'null' };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
  console.log('Via api.js getResumableSession:', JSON.stringify(viaApiJs));

  // Check state.js
  const stateCheck = await page.evaluate(async () => {
    try {
      const mod = await import('/js/state.js');
      return { userUuid: mod.state.getUserUuid(), userName: mod.state.getUserName(), sessionId: mod.state.getSessionId() };
    } catch (err) { return { error: err.message }; }
  });
  console.log('State check:', JSON.stringify(stateCheck));

  const spy = await page.evaluate(() => window.__spy || []);
  console.log('Spy entries:', spy);

  console.log('\n--- Console logs ---');
  for (const l of logs) console.log(l);

  await browser.close();
})();
