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
  // N=6: values = [0,0,1,4,4,4] → first=😢 middle expected floor(6/2)=3 → emotions[3]=😊 last=😊
  const values = [0, 0, 1, 4, 4, 4];
  for (let i = 0; i < 6; i++) {
    await textarea.fill(`N6テスト ${i + 1}`);
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
  console.log('recorded [😢,😢,😟,😊,😊,😊]');
  console.log('summary emojis (N=6):', emojis);
  console.log('DESIGN expected: [😢 (first), 😊 (middle=floor(6/2)=3 → emotions[3]=😊), 😊 (last)]');
  console.log('If implementation uses floor((N-1)/2)=2 → emotions[2]=😟');
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
