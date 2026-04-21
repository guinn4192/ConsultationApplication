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
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const textarea = page.locator('#message-input').first();
  const sendBtn = page.locator('#send-button').first();
  // N=4 pattern 1: [0,1,3,4] — first run
  const values = [0, 1, 3, 4];
  for (let i = 0; i < 4; i++) {
    await textarea.fill(`N4繰返 ${i + 1}`);
    await sendBtn.click();
    await waitForStreamingDone(page, 90000);
    await page.waitForTimeout(400);
    const sels = page.locator('.emotion-selector');
    const n = await sels.count();
    await sels.nth(n - 1).locator('.emotion-button').nth(values[i]).click();
    await page.waitForTimeout(150);
  }
  await page.locator('#new-consultation-button').first().click();
  await page.waitForTimeout(500);
  const emojis = await page.locator('#summary-modal .summary-point-emoji').allTextContents();
  console.log('recorded [😢,😟,🙂,😊]');
  console.log('summary emojis (N=4):', emojis);
  console.log('DESIGN §4.3 R6 expected: [😢 (first=emotions[0]), 🙂 (middle=emotions[floor(4/2)=2]), 😊 (last=emotions[3])]');
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
