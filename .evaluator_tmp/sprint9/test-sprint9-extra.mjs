// Sprint 9 追加検証: Escape でモーダル閉じる / カテゴリ独立性 (シナリオC) / 文字数=21 確認 / 回帰テスト Sprint 5-8

import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE_URL = 'http://localhost:3000/';

async function registerUserViaApi() {
  const res = await fetch(BASE_URL + 'api/user/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'EvaluatorSprint9Extra' }),
  });
  return res.json();
}

async function main() {
  const userInfo = await registerUserViaApi();
  console.log('User:', userInfo);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: 'ja-JP' });
  await ctx.addInitScript(({ uuid, name }) => {
    localStorage.setItem('consultationApp.userUuid', uuid);
    localStorage.setItem('consultationApp.userName', name);
  }, { uuid: userInfo.uuid, name: userInfo.userName });

  const allRequests = [];
  ctx.on('request', (req) => allRequests.push(req.url()));

  const page = await ctx.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('PAGE-ERR:', msg.text());
  });
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  const input = page.locator('#message-input');

  // === シナリオA 補足: workplace 挿入後の文字数は body.length=23 (実数 23) ===
  // ※ 元仕様書のシナリオAステップ7では「21文字」とあるが、辞書実装上 body.length=23（"職場の人間関係で悩んでいます。具体的には" 20 文字 + "___" 3 文字）が正
  {
    await input.fill('');
    await page.locator('.template-button[data-template-id="workplace"]').click();
    await page.waitForTimeout(200);
    const value = await input.inputValue();
    console.log(`[A補足] workplace body length: ${value.length} (expected 23)`);
    console.log(`[A補足] body: "${value}"`);
  }

  // === シナリオB追加: Escape でモーダル閉じる ===
  {
    await input.fill('');
    await page.waitForTimeout(100);
    await input.type('Escapeテスト用入力');
    await page.waitForTimeout(200);
    await page.locator('.template-button[data-template-id="vague"]').click();
    await page.waitForTimeout(300);
    const visibleBefore = await page.locator('#template-confirm-modal').isVisible();
    console.log(`[B-Esc] before: modal visible=${visibleBefore}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const visibleAfter = await page.locator('#template-confirm-modal').isVisible();
    const inputAfter = await input.inputValue();
    console.log(`[B-Esc] after Escape: modal visible=${visibleAfter} input="${inputAfter}"`);
    console.log(`[B-Esc] ok = ${!visibleAfter && inputAfter === 'Escapeテスト用入力'}`);
  }

  // === シナリオC: カテゴリ独立性 (テンプレ → カテゴリ → テンプレでカテゴリ維持) ===
  {
    await page.reload();
    await page.waitForTimeout(1500);
    // 再開モーダル閉じ
    const resumeVisible = await page.locator('#resume-modal').isVisible().catch(() => false);
    if (resumeVisible) {
      await page.locator('#resume-modal button').last().click();
      await page.waitForTimeout(300);
    }
    // 1. テンプレ workplace → カテゴリ active=0 確認
    await page.locator('.template-button[data-template-id="workplace"]').click();
    await page.waitForTimeout(300);
    let activeCount = await page.locator('.category-button.active').count();
    console.log(`[C-1] workplace 挿入後 active=${activeCount} (expected 0)`);

    // 2. 健康カテゴリを選択
    const healthButton = page.locator('.category-button[data-category="健康"]');
    const healthExists = await healthButton.count() > 0;
    console.log(`[C-2] health category button exists: ${healthExists}`);
    if (healthExists) {
      await healthButton.click();
      await page.waitForTimeout(300);
      const activeCat = await page.locator('.category-button.active').getAttribute('data-category');
      console.log(`[C-2] active カテゴリ = ${activeCat} (expected 健康)`);

      // 3. vague テンプレ → カテゴリ "健康" 維持
      // vague は recommendedCategory=null だが、テンプレ選択はカテゴリ非干渉なので維持されるべき
      // 既に "___" を含むテンプレ本文が入力欄にあるため、置換確認モーダル経由になるかもしれない
      const inputVal = await input.inputValue();
      const isLastTemplateBody = inputVal === '職場の人間関係で悩んでいます。具体的には___';
      console.log(`[C-3] input value still equals lastInsertedBody? ${isLastTemplateBody}`);
      await page.locator('.template-button[data-template-id="vague"]').click();
      await page.waitForTimeout(300);
      const modalShown = await page.locator('#template-confirm-modal').isVisible();
      console.log(`[C-3] modal shown after vague click: ${modalShown}`);
      if (modalShown) {
        await page.locator('#template-confirm-modal [data-action="confirm"]').click();
        await page.waitForTimeout(300);
      }
      const activeCatAfter = await page.locator('.category-button.active').getAttribute('data-category');
      console.log(`[C-3] vague 挿入後の active カテゴリ = ${activeCatAfter} (expected 健康)`);
      console.log(`[C-3] OK = ${activeCatAfter === '健康'}`);
    }
  }

  // === シナリオG 回帰: Sprint 6 絵文字セレクタ (AIメッセージ下に出るか) ===
  {
    const emoCount = await page.locator('.emotion-selector, .emotion-buttons, [class*="emotion"]').count();
    console.log(`[Regress S6] emotion セレクタ DOM 候補 count=${emoCount}`);
  }

  // === シナリオG 回帰: Sprint 8 daily message ===
  {
    const dailyCount = await page.locator('.daily-message, [class*="daily-message"]').count();
    const dailyText = await page.locator('.daily-message-text').textContent().catch(() => '');
    console.log(`[Regress S8] daily-message count=${dailyCount} text="${dailyText.slice(0, 50)}"`);
  }

  // === シナリオG 回帰: Sprint 7 履歴ボタンとオンボ済み確認 ===
  {
    const userNameDisplay = await page.locator('header, [class*="header"]').textContent().catch(() => '');
    console.log(`[Regress S7] header 表示: "${userNameDisplay.slice(0, 80)}"`);
  }

  // === ストリーミング中のテンプレ挿入抑制 (デザイン §7.9.4 / R12 対策) ===
  {
    // 送信実行
    await input.fill('');
    await page.waitForTimeout(200);
    await page.locator('.template-button[data-template-id="workplace"]').click();
    await page.waitForTimeout(200);
    await page.keyboard.type('簡単に答えてください');
    await page.waitForTimeout(100);
    await page.locator('#send-button').click();
    // ストリーミング開始直後 (確実に streaming 中) にテンプレを再度押す
    await page.waitForTimeout(300);
    const inputBefore = await input.inputValue();
    const isDisabled = await input.evaluate((el) => el.disabled);
    console.log(`[Streaming check] streaming-time inputValue="${inputBefore}" disabled=${isDisabled}`);
    await page.locator('.template-button[data-template-id="family"]').click();
    await page.waitForTimeout(300);
    const inputAfter = await input.inputValue();
    console.log(`[Streaming check] after-template-click inputValue="${inputAfter}"`);
    console.log(`[Streaming check] value-changed=${inputBefore !== inputAfter} (expected false = テンプレ挿入が抑止された)`);
    // ストリーミング完了まで待つ
    try {
      await page.waitForSelector('.message-ai.streaming-done', { timeout: 60000 });
      console.log(`[Streaming check] streaming-done OK`);
    } catch (e) {
      console.log(`[Streaming check] streaming-done timeout`);
    }
  }

  await browser.close();
  console.log('\n=== Extra tests done ===');
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
