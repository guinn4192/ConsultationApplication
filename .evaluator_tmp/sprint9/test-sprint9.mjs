// Sprint 9 / Feature 23: 相談テンプレート Playwright UI テスト
// Evaluator スクリプト
//
// 実行: node test-sprint9.mjs
// 前提: http://localhost:3000 でサーバ起動済

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000/';
const SCREEN_DIR = 'C:/ConsultationApplication/.evaluator_tmp/sprint9/screenshots';
fs.mkdirSync(SCREEN_DIR, { recursive: true });

const results = [];
function record(id, name, pass, score, detail) {
  results.push({ id, name, pass, score, detail });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`[${mark}] #${id} ${name} (score=${score}) -- ${detail}`);
}

// オンボーディングをスキップするためのlocalStorage事前注入用ユーザ事前登録
async function registerUserViaApi() {
  const res = await fetch(BASE_URL + 'api/user/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'EvaluatorSprint9' }),
  });
  const j = await res.json();
  return j; // { userUuid, userName, ... } 想定
}

async function main() {
  // 事前にユーザ登録（HTTP API）
  let userInfo;
  try {
    userInfo = await registerUserViaApi();
  } catch (e) {
    console.error('User registration failed:', e);
  }
  console.log('User registration result:', userInfo);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    locale: 'ja-JP',
  });
  // requestトラッキング用
  const allRequests = [];
  ctx.on('request', (req) => allRequests.push({ url: req.url(), method: req.method(), time: Date.now() }));

  // 注入: localStorage を navigation 前にセット
  await ctx.addInitScript(({ uuid, name }) => {
    try {
      localStorage.setItem('consultationApp.userUuid', uuid);
      localStorage.setItem('consultationApp.userName', name);
    } catch (e) {}
  }, { uuid: userInfo.userUuid || userInfo.uuid, name: userInfo.userName || 'EvaluatorSprint9' });

  const page = await ctx.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('PAGE-CONSOLE-ERR:', msg.text());
  });
  page.on('pageerror', (err) => console.log('PAGE-ERR:', err.message));

  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500); // 初期化完了待ち

  // オンボ画面が出ていないことを確認
  const onboardingVisible = await page.locator('#onboarding-screen').isVisible().catch(() => false);
  console.log('Onboarding visible:', onboardingVisible);
  if (onboardingVisible) {
    // 出ていたらユーザ名を入れて進める
    const input = page.locator('#onboarding-screen input').first();
    await input.fill('EvaluatorSprint9');
    const btn = page.locator('#onboarding-screen button').first();
    await btn.click();
    await page.waitForTimeout(1500);
  }

  // 再開モーダルが出たら閉じる
  const resumeVisible = await page.locator('#resume-modal').isVisible().catch(() => false);
  if (resumeVisible) {
    const newBtn = page.locator('#resume-modal button:has-text("新しい")').first();
    if (await newBtn.count()) {
      await newBtn.click();
    } else {
      // 任意のbtn
      await page.locator('#resume-modal button').last().click();
    }
    await page.waitForTimeout(500);
  }

  // ============= テスト #1: テンプレ UI が常時表示 =============
  {
    const visible = await page.locator('.template-section').isVisible();
    record(1, 'テンプレ UI 常時表示', visible, visible ? 10 : 0,
      `.template-section visible=${visible}`);
  }

  // ============= テスト #2: 5 種類のテンプレ表示 =============
  {
    const count = await page.locator('.template-button').count();
    const ok = count === 5;
    record(2, 'テンプレ 5 種類', ok, ok ? 10 : (count >= 3 && count <= 5 ? 8 : 0),
      `.template-button count=${count}`);
  }

  // ============= テスト #3: 各ラベルから判別可能 =============
  {
    const expectedLabels = ['職場', '家族', '進路', '健康', '漠然'];
    const labels = await page.locator('.template-button').allTextContents();
    const text = labels.join('|');
    let hit = 0;
    expectedLabels.forEach((kw) => { if (text.includes(kw)) hit++; });
    const ok = hit === 5;
    record(3, 'テーマ判別可能なラベル', ok, ok ? 10 : Math.floor((hit/5)*10),
      `labels=[${labels.join(', ')}] hits=${hit}/5`);
  }

  // ============= テスト #4: 「職場の人間関係」クリックで本文挿入 + ___ 含む =============
  const input = page.locator('#message-input');
  {
    await input.fill('');
    await page.locator('.template-button[data-template-id="workplace"]').click();
    await page.waitForTimeout(200);
    const value = await input.inputValue();
    const containsTemplate = value.includes('職場の人間関係で悩んでいます');
    const containsBlank = value.includes('___');
    const ok = containsTemplate && containsBlank;
    record(4, 'workplace クリックで本文+穴埋め', ok, ok ? 10 : (containsTemplate || containsBlank ? 5 : 0),
      `value="${value}" containsTemplate=${containsTemplate} containsBlank=${containsBlank}`);
  }

  // ============= テスト #5: 挿入直後カーソルが穴埋め位置に =============
  {
    const sel = await input.evaluate((el) => ({
      start: el.selectionStart,
      end: el.selectionEnd,
      isActive: document.activeElement === el,
      value: el.value,
    }));
    const slice = sel.value.slice(sel.start, sel.end);
    const ok = slice === '___' && sel.start === 20 && sel.end === 23;
    record(5, 'カーソルが ___ 範囲を選択 (workplace start=20,end=23)', ok, ok ? 10 : (slice === '___' ? 7 : 0),
      `selectionStart=${sel.start} selectionEnd=${sel.end} slice="${slice}" activeIsInput=${sel.isActive}`);
  }

  // ============= テスト #6: フォーカスが入力欄 =============
  {
    const active = await page.evaluate(() => document.activeElement && document.activeElement.id);
    const ok = active === 'message-input';
    record(6, 'フォーカスが #message-input', ok, ok ? 10 : 0,
      `document.activeElement.id="${active}"`);
  }

  // ============= テスト #7: 文字数カウンタ連動 =============
  {
    const value = await input.inputValue();
    const expectedLen = value.length;
    const counterText = await page.locator('#char-count').textContent();
    // counterText 例 "20 / 1000"
    const m = counterText.match(/(\d+)\s*\/\s*\d+/);
    const actualLen = m ? parseInt(m[1], 10) : -1;
    const ok = actualLen === expectedLen;
    record(7, '文字数カウンタが連動', ok, ok ? 10 : 0,
      `counter="${counterText}" expected=${expectedLen} actual=${actualLen}`);
  }

  // ============= テスト #8: テンプレ選択でカテゴリ自動確定なし =============
  {
    // 一度カテゴリ未選択にリセット
    const beforeActive = await page.locator('.category-button.active').count();
    // family クリック (連続切替)
    await page.locator('.template-button[data-template-id="family"]').click();
    await page.waitForTimeout(200);
    const afterActive = await page.locator('.category-button.active').count();
    const ok = beforeActive === 0 && afterActive === 0;
    record(8, 'テンプレ選択でカテゴリ自動確定なし', ok, ok ? 10 : 0,
      `beforeActive=${beforeActive} afterActive=${afterActive}`);
  }

  // ============= テスト #14（先に検証）: 別テンプレ切替（lastInsertedBody 経路） =============
  {
    // 既に family に切り替わっている前提
    const value = await input.inputValue();
    const isFamily = value.includes('家族とのことで気持ちが落ち着きません');
    const modalHidden = await page.locator('#template-confirm-modal').isHidden();
    const ok = isFamily && modalHidden;
    record(14, '別テンプレ連続クリックでモーダル経由せず置換', ok, ok ? 10 : (isFamily ? 6 : 0),
      `value="${value.slice(0, 30)}..." modalHidden=${modalHidden} isFamily=${isFamily}`);
  }

  // ============= テスト #9: カテゴリ事前選択 → テンプレ挿入後も維持 =============
  {
    await input.fill('');
    // 一度ページをreload してテンプレ状態クリア
    await page.locator('.category-button[data-category="人間関係"]').click();
    await page.waitForTimeout(200);
    const beforeCat = await page.locator('.category-button.active').getAttribute('data-category');
    // family テンプレ挿入
    await page.locator('.template-button[data-template-id="family"]').click();
    await page.waitForTimeout(200);
    const afterCat = await page.locator('.category-button.active').getAttribute('data-category');
    const ok = beforeCat === '人間関係' && afterCat === '人間関係';
    record(9, 'カテゴリ事前選択がテンプレ挿入で維持', ok, ok ? 10 : (afterCat === beforeCat ? 8 : 0),
      `beforeCat=${beforeCat} afterCat=${afterCat}`);
    // 後の互換のために解除
    await page.locator('.category-button[data-category="人間関係"]').click();
    await page.waitForTimeout(100);
  }

  // ============= テスト #10/11/12: 既入力時の確認モーダル =============
  {
    // input をクリアしてから手入力（テンプレを経由しない値）
    await input.fill('');
    await input.click();
    await input.fill('自分で書いた相談文です。');
    await page.waitForTimeout(200);
    // テンプレ career をクリック → モーダル表示
    await page.locator('.template-button[data-template-id="career"]').click();
    await page.waitForTimeout(300);
    const modalVisible = await page.locator('#template-confirm-modal').isVisible();
    record(10, '既入力時にテンプレ → 確認モーダル表示', modalVisible, modalVisible ? 10 : 0,
      `#template-confirm-modal visible=${modalVisible}`);
    // キャンセル
    if (modalVisible) {
      await page.locator('#template-confirm-modal [data-action="cancel"]').click();
      await page.waitForTimeout(300);
      const afterCancel = await input.inputValue();
      const modalAfterCancel = await page.locator('#template-confirm-modal').isHidden();
      const okCancel = afterCancel === '自分で書いた相談文です。' && modalAfterCancel;
      record(11, 'キャンセルで既入力保持', okCancel, okCancel ? 10 : 0,
        `valueAfterCancel="${afterCancel}" modalHidden=${modalAfterCancel}`);
      // 再度クリック → 置換
      await page.locator('.template-button[data-template-id="career"]').click();
      await page.waitForTimeout(300);
      const modalAgain = await page.locator('#template-confirm-modal').isVisible();
      if (modalAgain) {
        await page.locator('#template-confirm-modal [data-action="confirm"]').click();
        await page.waitForTimeout(300);
        const afterReplace = await input.inputValue();
        const okReplace = afterReplace.includes('これからの進路について');
        record(12, '「置き換える」で本文置換', okReplace, okReplace ? 10 : 0,
          `value="${afterReplace.slice(0, 40)}..."`);
      } else {
        record(12, '「置き換える」で本文置換', false, 0, 'モーダルが再表示されなかった');
      }
    } else {
      record(11, 'キャンセルで既入力保持', false, 0, 'モーダル未表示でテストできず');
      record(12, '「置き換える」で本文置換', false, 0, 'モーダル未表示でテストできず');
    }
  }

  // ============= テスト #13: 空欄時テンプレ挿入で確認モーダル経由しない =============
  {
    await input.fill('');
    await page.waitForTimeout(100);
    const reqBeforeIdx = allRequests.length;
    await page.locator('.template-button[data-template-id="workplace"]').click();
    await page.waitForTimeout(300);
    const modalHidden = await page.locator('#template-confirm-modal').isHidden();
    const value = await input.inputValue();
    const ok = modalHidden && value.includes('職場の人間関係で悩んでいます');
    record(13, '空欄時はモーダル経由せず即挿入', ok, ok ? 10 : 0,
      `modalHidden=${modalHidden} value="${value.slice(0, 30)}..."`);
  }

  // ============= テスト #15: キーボード操作のみで挿入 =============
  {
    await input.fill('');
    await page.waitForTimeout(100);
    // テンプレボタンに直接focus
    await page.locator('.template-button[data-template-id="health"]').focus();
    // Enter で押下
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const value = await input.inputValue();
    const ok = value.includes('体や心の調子が気になっています');
    record(15, 'キーボード（Enter）でテンプレ挿入', ok, ok ? 10 : 0,
      `value="${value.slice(0, 30)}..."`);
    // ついでに Space でも検証
    await input.fill('');
    await page.locator('.template-button[data-template-id="vague"]').focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    const value2 = await input.inputValue();
    const spaceOk = value2.includes('うまく言葉にできない');
    console.log(`  (補足: Space挿入 ok=${spaceOk} value="${value2.slice(0, 30)}...")`);
  }

  // ============= テスト #16: 全テーマ視認可能 =============
  {
    const themes = ['default', 'ocean', 'forest', 'night', 'sakura'];
    let themePassCount = 0;
    let themeDetails = [];
    for (const theme of themes) {
      // theme-button[data-theme=theme] をクリック（既存のテーマ切替経路を使う）
      await page.locator(`.theme-button[data-theme="${theme}"]`).click();
      await page.waitForTimeout(400);
      const visible = await page.locator('.template-section').isVisible();
      const btnVisible = await page.locator('.template-button').first().isVisible();
      // スクリーンショット
      await page.screenshot({ path: `${SCREEN_DIR}/theme-${theme}.png`, fullPage: false });
      const ok = visible && btnVisible;
      if (ok) themePassCount++;
      themeDetails.push(`${theme}=${ok ? 'OK' : 'NG'}`);
    }
    const ok = themePassCount === themes.length;
    record(16, '全 5 テーマで視認可能', ok, ok ? 10 : Math.floor((themePassCount/5)*10),
      `${themeDetails.join(' ')}`);
    // テーマを default に戻す
    await page.locator('.theme-button[data-theme="default"]').click();
    await page.waitForTimeout(200);
  }

  // ============= テスト #17: サーバ停止状態でもテンプレ挿入が動作 =============
  // ここでは "テンプレ挿入時に新規 fetch リクエストが発生しないこと" の方が検証可能
  // (サーバを実際に停止する代わりに request カウントで担保 → #18 と統合)

  // ============= テスト #18: テンプレ選択で新規 API リクエストなし =============
  {
    const reqBefore = allRequests.length;
    await input.fill('');
    await page.locator('.template-button[data-template-id="vague"]').click();
    await page.waitForTimeout(500);
    const reqAfter = allRequests.length;
    const newReqs = allRequests.slice(reqBefore);
    const ok = newReqs.length === 0;
    record(18, 'テンプレ選択で新規リクエスト 0 件', ok, ok ? 10 : (newReqs.length <= 1 ? 7 : 3),
      `requests delta=${newReqs.length} urls=[${newReqs.map(r => r.url).join(', ')}]`);

    // 受入 #17: クライアント完結 = 同様の検証で担保
    record(17, 'サーバ通信なし（クライアント完結）', ok, ok ? 10 : 5,
      `テンプレ挿入で fetch 発生せず (#18 と統合) delta=${newReqs.length}`);
  }

  // ============= テスト #19: 挿入 → 送信 → AI 回答（Feature 12 ストリーミング） =============
  {
    // 一度ページリロード（前テストの状態をクリア）
    await input.fill('');
    await page.locator('.template-button[data-template-id="workplace"]').click();
    await page.waitForTimeout(300);
    // 穴埋め部に追記
    await page.keyboard.type('上司との接し方です。');
    const value = await input.inputValue();
    console.log('Pre-send value:', value);

    // 送信前のメッセージ数
    const beforeUserCount = await page.locator('.chat-messages .message-user').count();
    const beforeAssistantCount = await page.locator('.chat-messages .message-ai').count();

    await page.locator('#send-button').click();

    // ストリーミング開始 → ユーザメッセが追加されるはず
    let userOk = false;
    let assistantOk = false;
    try {
      await page.waitForFunction((before) => {
        const msgs = document.querySelectorAll('.chat-messages .message-user');
        return msgs.length > before;
      }, beforeUserCount, { timeout: 5000 });
      userOk = true;
    } catch (e) {
      console.log('User message append timeout:', e.message);
    }

    // assistant メッセージの本文が成長するのを待つ（streaming-done が付くまで）
    try {
      await page.waitForFunction((before) => {
        const msgs = document.querySelectorAll('.chat-messages .message-ai');
        if (msgs.length <= before) return false;
        const last = msgs[msgs.length - 1];
        // streaming-done class が付いている、または十分なテキスト
        const isDone = last.classList.contains('streaming-done');
        const contentEl = last.querySelector('.message-streaming-content') || last;
        const len = (contentEl.textContent || '').trim().length;
        return isDone || len > 30;
      }, beforeAssistantCount, { timeout: 90000 });
      assistantOk = true;
    } catch (e) {
      console.log('Assistant message timeout:', e.message);
    }

    const lastAiHandle = page.locator('.chat-messages .message-ai').last();
    const afterAssistant = await lastAiHandle.evaluate((el) => {
      const c = el.querySelector('.message-streaming-content');
      return (c ? c.textContent : el.textContent) || '';
    }).catch(() => '');
    const isStreamingDone = await lastAiHandle.evaluate((el) => el.classList.contains('streaming-done')).catch(() => false);
    console.log('After-assistant text length:', afterAssistant.trim().length, 'streamingDone=', isStreamingDone);
    console.log('After-assistant snippet:', afterAssistant.slice(0, 80));
    const ok = userOk && assistantOk && (afterAssistant.trim().length > 10);
    record(19, '挿入後の通常送信フローが動作', ok, ok ? 10 : (userOk ? 5 : 2),
      `userOk=${userOk} assistantOk=${assistantOk} assistantTextLen=${(afterAssistant || '').length}`);
  }

  // ============= テスト #20: Evaluator シナリオ A/B が再現可能 =============
  // ここまでの #1〜#19 が再現できれば、Playwright スクリプト化が可能であると認められる
  {
    const failedSoFar = results.filter(r => !r.pass).map(r => `#${r.id}`);
    const ok = failedSoFar.length === 0;
    record(20, 'シナリオ A/B が Playwright で検証可能', ok, ok ? 10 : (failedSoFar.length <= 2 ? 8 : 6),
      `failed prior items=[${failedSoFar.join(', ')}] (#19 まで全部通れば 10)`);
  }

  // ===== 回帰テスト =====
  console.log('\n========= 回帰テスト =========');

  // R-1: 文字数カウンタの初期挙動（手入力）
  {
    await input.fill('');
    await page.waitForTimeout(100);
    await input.type('テスト');
    await page.waitForTimeout(200);
    const counterText = await page.locator('#char-count').textContent();
    const m = counterText.match(/(\d+)\s*\//);
    const v = m ? parseInt(m[1], 10) : -1;
    const ok = v === 3;
    console.log(`[regress] charCount on typing: counter="${counterText}" v=${v} expect=3 ok=${ok}`);
  }

  // R-2: テーマ切り替え動作
  {
    await page.locator('.theme-button[data-theme="ocean"]').click();
    await page.waitForTimeout(200);
    const dataTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    console.log(`[regress] theme switch to ocean: html data-theme=${dataTheme}`);
    await page.locator('.theme-button[data-theme="default"]').click();
    await page.waitForTimeout(100);
  }

  // R-3: 日替りメッセージ (Sprint 8) の DOM 存在
  {
    const dailyExists = await page.locator('.daily-message, [class*="daily"]').count();
    console.log(`[regress] daily-message DOM count=${dailyExists}`);
  }

  // R-4: モード切替
  {
    await page.locator('.mode-button[data-mode="empathy"]').click();
    await page.waitForTimeout(200);
    const active = await page.locator('.mode-button.active').getAttribute('data-mode');
    console.log(`[regress] mode switch to empathy: active=${active}`);
    await page.locator('.mode-button[data-mode="default"]').click();
    await page.waitForTimeout(100);
  }

  // ===== サマリ出力 =====
  console.log('\n========= サマリ =========');
  let totalScore = 0;
  let minScore = 10;
  for (const r of results) {
    totalScore += r.score;
    if (r.score < minScore) minScore = r.score;
  }
  const avg = totalScore / results.length;
  console.log(`平均スコア: ${avg.toFixed(2)} / 10`);
  console.log(`最低スコア: ${minScore}`);
  console.log(`PASS: ${results.filter(r => r.pass).length} / ${results.length}`);
  console.log(`FAIL: ${results.filter(r => !r.pass).length}`);

  // 全 request 一覧（テンプレ挿入区間のフィルタは別途）
  fs.writeFileSync(
    `${SCREEN_DIR}/../requests.json`,
    JSON.stringify(allRequests, null, 2),
  );

  fs.writeFileSync(
    `${SCREEN_DIR}/../results.json`,
    JSON.stringify(results, null, 2),
  );

  await browser.close();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
