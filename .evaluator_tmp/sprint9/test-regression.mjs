// Sprint 1-8 回帰確認: 絵文字, サマリ, テーマ, モード, カテゴリ, 履歴
import { chromium } from 'playwright';
const BASE_URL = 'http://localhost:3000/';

async function registerUser() {
  const res = await fetch(BASE_URL + 'api/user/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'EvaluatorSprint9Regress' }),
  });
  return res.json();
}

async function main() {
  const u = await registerUser();
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: 'ja-JP' });
  await ctx.addInitScript(({ uuid, name }) => {
    localStorage.setItem('consultationApp.userUuid', uuid);
    localStorage.setItem('consultationApp.userName', name);
  }, { uuid: u.uuid, name: u.userName });

  const page = await ctx.newPage();
  page.on('console', msg => { if (msg.type() === 'error') console.log('PAGE-ERR:', msg.text()); });
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  // === 回帰 1: ウェルカム + 日替り表示 (Sprint 7 + 8) ===
  const welcomeExists = await page.locator('.message-welcome').count();
  const dailyText = await page.locator('.daily-message-text').textContent().catch(() => '');
  console.log(`[R1] welcome=${welcomeExists>0} daily="${dailyText.slice(0,50)}"`);

  // === 回帰 2: カテゴリ選択 (Sprint 3) ===
  await page.locator('.category-button[data-category="健康"]').click();
  await page.waitForTimeout(200);
  const catActive = await page.locator('.category-button.active').getAttribute('data-category');
  console.log(`[R2] category=${catActive}`);

  // === 回帰 3: モード切替 (Sprint 5 関連) ===
  await page.locator('.mode-button[data-mode="empathy"]').click();
  await page.waitForTimeout(200);
  const modeActive = await page.locator('.mode-button.active').getAttribute('data-mode');
  console.log(`[R3] mode=${modeActive}`);

  // === 回帰 4: テーマ切替 (Sprint 1-2) ===
  for (const t of ['ocean', 'forest', 'night', 'sakura', 'default']) {
    await page.locator(`.theme-button[data-theme="${t}"]`).click();
    await page.waitForTimeout(150);
    const dt = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    console.log(`[R4] theme switch -> ${t} : actual=${dt}`);
  }

  // === 回帰 5: 送信 → ストリーミング → AI 回答 → 絵文字セレクタ表示 (Sprint 5/6) ===
  const input = page.locator('#message-input');
  await input.fill('短く一言だけ返事してください');
  await page.locator('#send-button').click();
  await page.waitForSelector('.message-ai.streaming-done', { timeout: 90000 });
  await page.waitForTimeout(500);
  const aiCount = await page.locator('.message-ai').count();
  console.log(`[R5] message-ai count after send: ${aiCount}`);
  
  // 絵文字セレクタ確認
  const emoSelector = await page.locator('.message-ai').last().locator('.emotion-selector, [class*="emotion"]').count();
  const allEmoElems = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).filter(b => /😢|😟|😐|🙂|😊/.test(b.textContent)).length;
  });
  console.log(`[R5] emotion selector count in last AI msg: ${emoSelector}, all emoji buttons: ${allEmoElems}`);

  // 絵文字クリック
  if (allEmoElems > 0) {
    await page.locator('button').filter({ hasText: '🙂' }).last().click();
    await page.waitForTimeout(300);
    const activeEmo = await page.locator('button.active, button[aria-pressed="true"]').filter({ hasText: '🙂' }).count();
    console.log(`[R5] 🙂 click → active count: ${activeEmo}`);
  }

  // === 回帰 6: 新しい相談を始める → サマリカード (Sprint 6 Feature 16) ===
  await page.locator('#new-consultation-button').click();
  await page.waitForTimeout(400);
  const summaryVisible = await page.locator('.summary-modal, [class*="summary"]').count();
  console.log(`[R6] summary modal/elements visible after newConsultation: ${summaryVisible}`);

  // === 回帰 7: 再開モーダル動作 (Sprint 7) ===
  // 一度サマリ閉じてから（リセット選択）
  const resetBtn = page.locator('button').filter({ hasText: /リセット|新しい/ }).first();
  const hasResetBtn = await resetBtn.count();
  if (hasResetBtn) {
    await resetBtn.click().catch(()=>{});
    await page.waitForTimeout(500);
  }
  // リロード
  await page.reload();
  await page.waitForTimeout(1500);
  const resumeVisible = await page.locator('#resume-modal').isVisible().catch(()=>false);
  console.log(`[R7] resume modal on reload: ${resumeVisible}`);

  // === 回帰 8: 文字数カウンタ (Sprint 3 Feature 8) ===
  if (resumeVisible) {
    await page.locator('#resume-modal button').last().click();
    await page.waitForTimeout(300);
  }
  await input.fill('');
  await input.type('テスト123');
  await page.waitForTimeout(200);
  const counter = await page.locator('#char-count').textContent();
  console.log(`[R8] char-count after type 7 chars: "${counter}"`);

  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
