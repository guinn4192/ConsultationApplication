// Verify middle index for N=5 recordings
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

async function waitForStreamingDone(page, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const disabled = await page.locator('#send-button').first().isDisabled().catch(() => true);
    if (!disabled) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const textarea = page.locator('#message-input').first();
  const sendBtn = page.locator('#send-button').first();

  // Send 5 consults and record emotions [0,1,2,3,4] = [😢,😟,😐,🙂,😊]
  const values = [0, 1, 2, 3, 4];
  for (let i = 0; i < 5; i++) {
    await textarea.fill(`テスト相談 ${i + 1}`);
    await sendBtn.click();
    await waitForStreamingDone(page, 90000);
    await page.waitForTimeout(500);
    const sels = page.locator('.emotion-selector');
    const n = await sels.count();
    await sels.nth(n - 1).locator('.emotion-button').nth(values[i]).click();
    await page.waitForTimeout(150);
  }

  const recorded = await page.evaluate(() => {
    const sels = document.querySelectorAll('.emotion-selector');
    return Array.from(sels).map(sel => {
      const btns = sel.querySelectorAll('.emotion-button');
      for (let i = 0; i < btns.length; i++) if (btns[i].classList.contains('active')) return i;
      return -1;
    });
  });
  console.log('recorded:', recorded);

  // Open summary
  await page.locator('#new-consultation-button').first().click();
  await page.waitForTimeout(500);
  const emojis = await page.locator('#summary-modal .summary-point-emoji').allTextContents();
  console.log('summary emojis (N=5):', emojis);
  console.log('DESIGN expected: [😢 (first), 😐 (middle=floor(5/2)=2), 😊 (last)]');

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
