// Debug 3: Check if modal appears fleetingly
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const targetUuid = 'b843bc5b-efff-4988-896d-4b051494068d';
  await page.goto(BASE);
  await page.evaluate((uuid) => {
    localStorage.setItem('consultationApp.userUuid', uuid);
    localStorage.setItem('consultationApp.userName', 'テスト太郎');
  }, targetUuid);

  // Install MutationObserver spy
  await page.addInitScript(() => {
    window.__modalLog = [];
    const installObserver = () => {
      const modal = document.getElementById('resume-modal');
      if (!modal) { setTimeout(installObserver, 10); return; }
      const obs = new MutationObserver((mutations) => {
        for (const m of mutations) {
          window.__modalLog.push(`${Date.now()}: type=${m.type} attr=${m.attributeName || ''} hidden=${modal.hidden} htmlLen=${modal.innerHTML.length}`);
        }
      });
      obs.observe(modal, { attributes: true, childList: true, subtree: true });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', installObserver);
    } else {
      installObserver();
    }
  });

  console.log('Navigating...');
  const t0 = Date.now();
  await page.goto(BASE);
  await page.waitForTimeout(5000);

  const modalLog = await page.evaluate(() => window.__modalLog || []);
  console.log(`Modal mutations (${modalLog.length}):`);
  for (const l of modalLog) console.log('  ', l);

  await browser.close();
})();
