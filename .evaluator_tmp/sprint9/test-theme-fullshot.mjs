// テンプレ UI を含む全テーマ fullPage スクショ
import { chromium } from 'playwright';
const BASE_URL = 'http://localhost:3000/';

async function registerUser() {
  const res = await fetch(BASE_URL + 'api/user/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'EvaluatorSprint9Theme' }),
  });
  return res.json();
}

async function main() {
  const u = await registerUser();
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(({ uuid, name }) => {
    localStorage.setItem('consultationApp.userUuid', uuid);
    localStorage.setItem('consultationApp.userName', name);
  }, { uuid: u.uuid, name: u.userName });
  const page = await ctx.newPage();
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  // 再開モーダル
  const resume = await page.locator('#resume-modal').isVisible().catch(()=>false);
  if (resume) {
    await page.locator('#resume-modal button').last().click();
    await page.waitForTimeout(300);
  }
  // 各テーマで template-section の bbox を測定
  for (const t of ['default', 'ocean', 'forest', 'night', 'sakura']) {
    await page.locator(`.theme-button[data-theme="${t}"]`).click();
    await page.waitForTimeout(300);
    // テンプレ section をスクロールイン
    await page.locator('.template-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const sectionBox = await page.locator('.template-section').boundingBox();
    const btnBox = await page.locator('.template-button').first().boundingBox();
    console.log(`[${t}] template-section bbox=`, sectionBox);
    console.log(`[${t}] first .template-button bbox=`, btnBox);
    // テンプレ UI 部分だけのスクショ
    await page.locator('.template-section').screenshot({
      path: `C:/ConsultationApplication/.evaluator_tmp/sprint9/screenshots/template-${t}.png`,
    });
  }
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
