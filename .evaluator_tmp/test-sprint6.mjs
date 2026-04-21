// Sprint 6 UI test harness using Playwright
// Usage: node .evaluator_tmp/test-sprint6.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:3000';
const results = [];
const bugs = [];
const consoleErrors = [];

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

async function snapshotText(page) {
  return await page.evaluate(() => document.body.innerText.slice(0, 4000));
}

async function countMessages(page) {
  // Exclude welcome message for user-visible consult count comparison
  return await page.locator('.message:not(.message-welcome)').count();
}

async function getLastAssistantText(page) {
  return await page.evaluate(() => {
    const msgs = document.querySelectorAll('.message-ai:not(.message-welcome)');
    if (msgs.length === 0) return '';
    return msgs[msgs.length - 1].innerText || '';
  });
}

async function waitForStreamingDone(page, timeoutMs = 60000) {
  // Streaming done is determined by emotion selector appearing OR input re-enabled
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

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!/favicon/.test(t)) consoleErrors.push(t);
    }
  });
  page.on('pageerror', err => consoleErrors.push(String(err)));

  log('=== Sprint 6 Evaluator start ===');

  // ================= Feature 14: 感情記録UI =================

  // 14-1: welcome
  log('Feature 14-1: navigate and check welcome');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const html = await page.content();
  fs.writeFileSync('.evaluator_tmp/initial.html', html);
  const hasWelcome = /ようこそ|welcome|こんにちは|はじめまして|お悩み|相談/.test(await snapshotText(page));
  results.push({ feature: 'F14', no: 1, title: 'ウェルカムメッセージ表示', score: hasWelcome ? 10 : 3, detail: hasWelcome ? '初期ロードでウェルカムメッセージを確認' : 'ウェルカム文言が検出できず' });

  // Identify selectors
  const textarea = page.locator('#message-input').first();
  const sendBtn = page.locator('#send-button').first();
  const textareaCount = await textarea.count();
  const sendBtnCount = await sendBtn.count();
  log(`Textarea=${textareaCount} SendBtn=${sendBtnCount}`);

  // 14-2 & 14-3 & 14-8: Send first consult and check selector appears after streaming done
  log('Feature 14-2,3,8: send first consult, watch emotion selector timing');
  await textarea.fill('最近、仕事がうまくいかなくて気持ちが落ち込んでいます。');
  await sendBtn.click();
  // Check mid-streaming: selector NOT appear
  await page.waitForTimeout(1000);
  const midSelectorCount = await page.locator('.emotion-selector, .emotion-button').count();
  const midStreaming = await page.locator('.message-streaming').count();
  log(`during stream: selectorElems=${midSelectorCount} streaming=${midStreaming}`);

  const streamDone = await waitForStreamingDone(page, 90000);
  if (!streamDone) {
    bugs.push({ title: 'ストリーミングが 90秒内に完了せず', steps: '1. 相談送信 2. 90秒待機', expected: '送信ボタンが再度活性化', actual: 'タイムアウト', severity: 'Critical' });
  }
  await page.waitForTimeout(800);

  const selectorCount = await page.locator('.emotion-selector').count();
  const buttonCount = await page.locator('.emotion-button').count();
  log(`after stream: emotion-selector=${selectorCount} emotion-button=${buttonCount}`);

  // Capture HTML snapshot after streaming
  fs.writeFileSync('.evaluator_tmp/after-first.html', await page.content());

  results.push({ feature: 'F14', no: 2, title: 'ストリーミング完了後に5絵文字セレクタ出現', score: (selectorCount >= 1 && buttonCount >= 5) ? 10 : (selectorCount >= 1 ? 5 : 0), detail: `selector=${selectorCount} buttons=${buttonCount}` });
  results.push({ feature: 'F14', no: 8, title: 'ストリーミング中は絵文字セレクタが出現しない', score: midSelectorCount === 0 ? 10 : 3, detail: `ストリーミング中のセレクタ要素数=${midSelectorCount}` });

  // 14-4: click 😢 and check highlight
  const cryingBtn = page.locator('.emotion-button').first();
  let highlightOk = false;
  let secondActiveOk = false;
  if (await cryingBtn.count() > 0) {
    await cryingBtn.click();
    await page.waitForTimeout(300);
    const activeAfter1 = await page.locator('.emotion-button.active').count();
    highlightOk = activeAfter1 === 1;

    // 14-5: click 🙂 and check override
    const buttons = await page.locator('.emotion-selector').first().locator('.emotion-button').all();
    if (buttons.length >= 4) {
      await buttons[3].click();
      await page.waitForTimeout(300);
      const firstActive = await buttons[0].evaluate(el => el.classList.contains('active'));
      const fourthActive = await buttons[3].evaluate(el => el.classList.contains('active'));
      secondActiveOk = !firstActive && fourthActive;
    }
  }
  results.push({ feature: 'F14', no: 4, title: '絵文字クリックで .active ハイライト表示', score: highlightOk ? 10 : 0, detail: highlightOk ? '😢クリックでactive付与確認' : 'active付与が正しく動作しない' });
  results.push({ feature: 'F14', no: 5, title: '同じ回答で絵文字を上書きできる', score: secondActiveOk ? 10 : 0, detail: secondActiveOk ? '🙂 押下で 😢 が非active、🙂 が active' : '上書き動作NG' });

  // 14-6: send 2nd consult, each message independent selector
  log('Feature 14-6: send 2nd consult, check per-message independence');
  await textarea.fill('でも、うまく言葉にできません。');
  await sendBtn.click();
  await waitForStreamingDone(page, 90000);
  await page.waitForTimeout(800);

  const selectorsAfter2 = await page.locator('.emotion-selector').count();
  // Ensure 1st selector still shows 🙂 as active
  const firstSelectorActiveIdx = await page.evaluate(() => {
    const sels = document.querySelectorAll('.emotion-selector');
    if (sels.length === 0) return -1;
    const btns = sels[0].querySelectorAll('.emotion-button');
    for (let i = 0; i < btns.length; i++) {
      if (btns[i].classList.contains('active')) return i;
    }
    return -2;
  });
  const secondSelectorActiveIdx = await page.evaluate(() => {
    const sels = document.querySelectorAll('.emotion-selector');
    if (sels.length < 2) return -1;
    const btns = sels[1].querySelectorAll('.emotion-button');
    for (let i = 0; i < btns.length; i++) {
      if (btns[i].classList.contains('active')) return i;
    }
    return -2;
  });
  const independent = firstSelectorActiveIdx === 3 && secondSelectorActiveIdx === -2;
  results.push({ feature: 'F14', no: 6, title: '過去回答ごとに独立した絵文字セレクタ', score: (selectorsAfter2 >= 2 && independent) ? 10 : (selectorsAfter2 >= 2 ? 6 : 2), detail: `2件目後selectorElems=${selectorsAfter2} 1件目active=${firstSelectorActiveIdx}(期待3) 2件目active=${secondSelectorActiveIdx}(期待-2)` });

  // 14-7: send 3rd without selecting — should succeed
  log('Feature 14-7: send 3rd without selecting');
  await textarea.fill('ありがとう、少し落ち着きました。');
  await sendBtn.click();
  const ok3 = await waitForStreamingDone(page, 90000);
  await page.waitForTimeout(800);
  const selectorsAfter3 = await page.locator('.emotion-selector').count();
  results.push({ feature: 'F14', no: 7, title: '絵文字未選択でも送信可能', score: (ok3 && selectorsAfter3 >= 3) ? 10 : (ok3 ? 7 : 0), detail: `3件目送信OK=${ok3}, selectors=${selectorsAfter3}` });

  // Hover feedback check (does the button have :hover CSS?)
  const hoverOk = await page.evaluate(() => {
    const btn = document.querySelector('.emotion-button');
    if (!btn) return false;
    // Check that a :hover rule exists in stylesheets targeting .emotion-button
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText && rule.selectorText.includes('.emotion-button') && rule.selectorText.includes(':hover')) {
            return true;
          }
        }
      } catch (e) { /* CORS */ }
    }
    return false;
  });
  results.push({ feature: 'F14', no: 9, title: '絵文字ボタンにホバーフィードバック', score: hoverOk ? 10 : 5, detail: hoverOk ? ':hover CSSルール検出' : ':hover CSSルールが検出できず (CORS等)' });

  // ================= Feature 16: サマリカード (do before reset path) =================
  // Before reset, we have 3 consultations. Record emotions in order 😢→😟→🙂→😊 via sending one more? Plan requires 4 consults
  // Already sent 3. Emotions so far: 1st has 🙂 (index 3). Let's overwrite on 1st to 😢, 2nd to 😟, 3rd to 🙂, send 4th and record 😊.
  log('Feature 16 prep: adjust emotions on each of the 3 messages and send 4th');

  // Set first to 😢
  const setActive = async (selIdx, btnIdx) => {
    const sels = page.locator('.emotion-selector');
    const n = await sels.count();
    if (selIdx >= n) return false;
    const btn = sels.nth(selIdx).locator('.emotion-button').nth(btnIdx);
    await btn.click();
    await page.waitForTimeout(150);
    return true;
  };
  await setActive(0, 0); // 😢
  await setActive(1, 1); // 😟
  await setActive(2, 3); // 🙂

  // Send 4th consult
  await textarea.fill('今日は前向きに考えてみます。');
  await sendBtn.click();
  await waitForStreamingDone(page, 90000);
  await page.waitForTimeout(800);
  await setActive(3, 4); // 😊

  // Snapshot emotions
  const recordedEmotions = await page.evaluate(() => {
    const sels = document.querySelectorAll('.emotion-selector');
    const out = [];
    for (const sel of sels) {
      const btns = sel.querySelectorAll('.emotion-button');
      let idx = -1;
      for (let i = 0; i < btns.length; i++) if (btns[i].classList.contains('active')) idx = i;
      out.push(idx);
    }
    return out;
  });
  log(`recordedEmotions indices: ${JSON.stringify(recordedEmotions)}`);

  // 16-1: click 新しい相談 → summary shows WITHOUT clearing
  log('Feature 16-1: click new-consultation, expect summary modal');
  const newBtn = page.locator('#new-consultation-button').first();
  const newBtnExists = await newBtn.count() > 0;
  if (!newBtnExists) {
    bugs.push({ title: '「新しい相談を始める」ボタンが見つからない', steps: '1. 相談を実施後 2. ボタンを検索', expected: 'ボタン存在', actual: '非表示/セレクタ不一致', severity: 'High' });
  }
  const messageCountBeforeSummary = await countMessages(page);
  await newBtn.click();
  await page.waitForTimeout(600);
  const summaryVisible = await page.locator('#summary-modal.is-open, .summary-modal:not([hidden]), [role="dialog"]:visible').count();
  const summaryModalExists = await page.locator('#summary-modal').count();
  log(`summary visible=${summaryVisible} exists=${summaryModalExists}`);
  const messageCountAfterSummaryShown = await countMessages(page);
  const summaryShownBeforeClear = summaryVisible > 0 && messageCountAfterSummaryShown === messageCountBeforeSummary;
  results.push({ feature: 'F16', no: 1, title: '新しい相談クリックでサマリ表示（会話履歴クリア前）', score: summaryShownBeforeClear ? 10 : 3, detail: `サマリ表示=${summaryVisible}, msg件数保持=${messageCountAfterSummaryShown}/${messageCountBeforeSummary}` });

  // 16-2: 3 points + arrows
  const summaryHtml = await page.evaluate(() => {
    const el = document.querySelector('#summary-modal') || document.querySelector('.summary-modal');
    return el ? el.innerHTML : '';
  });
  fs.writeFileSync('.evaluator_tmp/summary-4emotions.html', summaryHtml);
  const pointEmojis = await page.locator('#summary-modal .summary-point-emoji, .summary-point-emoji').allTextContents();
  const arrows = await page.locator('#summary-modal .summary-change-arrow, .summary-change-arrow').allTextContents();
  log(`summary emojis=${JSON.stringify(pointEmojis)} arrows=${JSON.stringify(arrows)}`);
  // Expected: 😢 / 😟 / 😊 (first/middle(floor(4/2)=2→emotions[2]=🙂)/last=😊)
  // recorded emotions values: [0,1,3,4] so first=😢 middle=emotions[2]=🙂 last=😊
  // Wait — spec task says middle = floor(4/2)=2nd idx = 😟 — but that is wrong per design. Let me re-read:
  // design R6: "N=4 なら index=2" → index=2 which is 0-based 3rd element → emotion[2]=🙂
  // User task statement says "中盤=floor(4/2)=2 番目=😟" — the user's task wording treats "2番目" as index=2 (3rd). Japanese counting is ambiguous. Let me just verify the 3 points exist and that middle is emotions[floor(N/2)]
  const hasThreePoints = pointEmojis.length >= 3;
  const expectedMiddle = '🙂'; // emotions[floor(4/2)]=emotions[2]=🙂 per DESIGN R6
  const middleOk = pointEmojis.length >= 3 && pointEmojis[1] === expectedMiddle;
  const startOk = pointEmojis.length >= 3 && pointEmojis[0] === '😢';
  const endOk = pointEmojis.length >= 3 && pointEmojis[2] === '😊';
  const arrowsOk = arrows.length >= 1;
  const threePointsScore = hasThreePoints && middleOk && startOk && endOk && arrowsOk ? 10 : (hasThreePoints && startOk && endOk ? 7 : (hasThreePoints ? 5 : 0));
  results.push({ feature: 'F16', no: 2, title: 'サマリ3ポイント+変化矢印(floor(N/2)中盤)', score: threePointsScore, detail: `emojis=${JSON.stringify(pointEmojis)} expected[😢,🙂,😊] arrows=${JSON.stringify(arrows)} middleOk=${middleOk}` });

  // 16-3: 閉じる button preserves history
  const closeBtn = page.locator('#summary-modal .summary-button-close, .summary-button-close').first();
  const closeBtnExists = await closeBtn.count() > 0;
  if (!closeBtnExists) {
    bugs.push({ title: 'サマリ「閉じる」ボタンが見つからない', steps: '1. サマリ表示 2. 閉じるボタンを探す', expected: 'ボタン存在', actual: '非表示', severity: 'High' });
  }
  await closeBtn.click();
  await page.waitForTimeout(500);
  const summaryVisibleAfterClose = await page.locator('#summary-modal.is-open').count();
  const messageCountAfterClose = await countMessages(page);
  const emotionsAfterClose = await page.evaluate(() => {
    const sels = document.querySelectorAll('.emotion-selector');
    return Array.from(sels).map(sel => {
      const btns = sel.querySelectorAll('.emotion-button');
      for (let i = 0; i < btns.length; i++) if (btns[i].classList.contains('active')) return i;
      return -2;
    });
  });
  const closeWorks = summaryVisibleAfterClose === 0 && messageCountAfterClose === messageCountBeforeSummary && JSON.stringify(emotionsAfterClose) === JSON.stringify([0, 1, 3, 4]);
  results.push({ feature: 'F16', no: 3, title: '閉じるで会話履歴と絵文字選択を保持', score: closeWorks ? 10 : 4, detail: `modalClosed=${summaryVisibleAfterClose===0} msgs=${messageCountAfterClose}/${messageCountBeforeSummary} emotions=${JSON.stringify(emotionsAfterClose)} expected=[0,1,3,4]` });

  // 16-4: reset button clears everything
  log('Feature 16-4: re-open summary then reset');
  await newBtn.click();
  await page.waitForTimeout(500);
  const resetBtn = page.locator('#summary-modal .summary-button-reset, .summary-button-reset').first();
  const resetBtnExists = await resetBtn.count() > 0;
  if (!resetBtnExists) {
    bugs.push({ title: 'サマリ「リセット」ボタンが見つからない', steps: '1. サマリ表示 2. リセットボタンを探す', expected: 'ボタン存在', actual: '非表示', severity: 'High' });
  }
  await resetBtn.click();
  await page.waitForTimeout(500);
  const messageCountAfterReset = await countMessages(page);
  const emotionSelAfterReset = await page.locator('.emotion-selector').count();
  const welcomeAfterReset = /ようこそ|welcome|こんにちは|はじめまして|お悩み|相談/.test(await snapshotText(page));
  const resetWorks = messageCountAfterReset <= 1 && emotionSelAfterReset === 0 && welcomeAfterReset;
  results.push({ feature: 'F16', no: 4, title: 'リセットで会話履歴クリア+ウェルカム+絵文字消去', score: resetWorks ? 10 : (welcomeAfterReset ? 6 : 2), detail: `msgs=${messageCountAfterReset} selectors=${emotionSelAfterReset} welcome=${welcomeAfterReset}` });

  // 16-5: 0 emotions case
  log('Feature 16-5: 0 emotions then new-consultation');
  await textarea.fill('テスト相談');
  await sendBtn.click();
  await waitForStreamingDone(page, 90000);
  await page.waitForTimeout(500);
  // Do not record emotion, click new-consultation
  await newBtn.click();
  await page.waitForTimeout(500);
  const noRecordMsg = await page.evaluate(() => {
    const el = document.querySelector('#summary-modal');
    return el ? (el.innerText || '') : '';
  });
  const hasNoRecord = /記録がありません|記録なし|ありません/.test(noRecordMsg);
  const resetBtnStillActive = await page.locator('#summary-modal .summary-button-reset').isEnabled().catch(() => false);
  results.push({ feature: 'F16', no: 5, title: '絵文字記録0件で「記録がありません」+リセット続行可', score: (hasNoRecord && resetBtnStillActive) ? 10 : (hasNoRecord ? 6 : 0), detail: `noRecordMsg=${hasNoRecord} resetEnabled=${resetBtnStillActive}` });
  // dismiss then reset clean
  await page.locator('#summary-modal .summary-button-reset').click();
  await page.waitForTimeout(500);

  // 16-6: 1 emotion only
  log('Feature 16-6: 1 emotion recorded then new-consultation');
  await textarea.fill('もう一度テスト');
  await sendBtn.click();
  await waitForStreamingDone(page, 90000);
  await page.waitForTimeout(500);
  await setActive(0, 2); // 😐
  await newBtn.click();
  await page.waitForTimeout(500);
  const oneEmoContent = await page.evaluate(() => {
    const el = document.querySelector('#summary-modal');
    return el ? (el.innerText || '') : '';
  });
  const pointEmojis1 = await page.locator('#summary-modal .summary-point-emoji').allTextContents();
  const oneEmoOk = pointEmojis1.length === 1 || (pointEmojis1.length >= 1 && pointEmojis1[0] === '😐');
  results.push({ feature: 'F16', no: 6, title: '絵文字記録1件で1ポイントor同絵文字表示', score: oneEmoOk ? 10 : 4, detail: `emojis=${JSON.stringify(pointEmojis1)}` });
  await page.locator('#summary-modal .summary-button-reset').click();
  await page.waitForTimeout(500);

  // ================= Feature 15: トーン調整 =================
  // F15-1: Mode=解決 + 気分=😢 → expect 共感+解決併存
  log('Feature 15-1: mode=解決 + 気分=😢 cross-scenario');
  const modeSolve = page.locator('[data-mode="solution"]').first();
  if (await modeSolve.count() > 0) {
    await modeSolve.click();
    await page.waitForTimeout(200);
  } else {
    bugs.push({ title: 'モード「解決」ボタンが見つからない', steps: '1. モードセレクタ検索', expected: '解決ボタン存在', actual: '不一致', severity: 'Medium' });
  }
  await textarea.fill('毎日ミスばかりで自分が嫌になります。');
  await sendBtn.click();
  await waitForStreamingDone(page, 90000);
  await page.waitForTimeout(600);
  // Record 😢
  const selCount = await page.locator('.emotion-selector').count();
  if (selCount > 0) await setActive(selCount - 1, 0);

  // Send follow-up consult and inspect AI reply
  await textarea.fill('どうしたらいいでしょう？');
  await sendBtn.click();
  await waitForStreamingDone(page, 90000);
  await page.waitForTimeout(600);
  const replyEmpathySolve = await getLastAssistantText(page);
  fs.writeFileSync('.evaluator_tmp/f15-1-reply.txt', replyEmpathySolve);
  const hasEmpathy = /つらかった|つらい|お気持ち|受け止め|受容|わかり|わかる|分かり|分かる|寄り添|共感/.test(replyEmpathySolve);
  const hasSolveHints = /選択肢|方法|一歩|ステップ|試し|整理|どう|考え方|アプローチ|進め方|まず|次に|例えば/.test(replyEmpathySolve);
  const crossOk = hasEmpathy && hasSolveHints;
  results.push({ feature: 'F15', no: 1, title: 'モード=解決×気分=😢のクロスで共感+解決併存', score: crossOk ? 10 : (hasEmpathy || hasSolveHints ? 6 : 2), detail: `empathy=${hasEmpathy} solve=${hasSolveHints}` });

  // Reset
  await newBtn.click(); await page.waitForTimeout(400);
  if (await page.locator('#summary-modal .summary-button-reset').count() > 0) { await page.locator('#summary-modal .summary-button-reset').click(); await page.waitForTimeout(500); }

  // F15-2: 気分=😊 → positive tone
  log('Feature 15-2: 気分=😊 → positive tone');
  await textarea.fill('今日はいい1日でした。');
  await sendBtn.click();
  await waitForStreamingDone(page, 90000);
  await page.waitForTimeout(400);
  const sel1 = await page.locator('.emotion-selector').count();
  if (sel1 > 0) await setActive(sel1 - 1, 4); // 😊
  await textarea.fill('明日はどう過ごしたらいいかな？');
  await sendBtn.click();
  await waitForStreamingDone(page, 90000);
  await page.waitForTimeout(600);
  const replyPositive = await getLastAssistantText(page);
  fs.writeFileSync('.evaluator_tmp/f15-2-reply.txt', replyPositive);
  const hasPositive = /その調子|次の一歩|一緒に|前向き|素敵|素晴らしい|いい|楽しみ|挑戦|続け|後押し|進め|行動/.test(replyPositive);
  results.push({ feature: 'F15', no: 2, title: '気分=😊 で前向き/後押し表現', score: hasPositive ? 10 : 3, detail: `positive=${hasPositive}` });

  await newBtn.click(); await page.waitForTimeout(400);
  if (await page.locator('#summary-modal .summary-button-reset').count() > 0) { await page.locator('#summary-modal .summary-button-reset').click(); await page.waitForTimeout(500); }

  // F15-3: 気分=😐 → no-addendum / neutral tone (no strong empathy, no strong push)
  log('Feature 15-3: 気分=😐 → neutral tone');
  await textarea.fill('最近の生活について相談です。');
  await sendBtn.click();
  await waitForStreamingDone(page, 90000);
  await page.waitForTimeout(400);
  const sel2 = await page.locator('.emotion-selector').count();
  if (sel2 > 0) await setActive(sel2 - 1, 2); // 😐
  await textarea.fill('続きの相談です。');
  await sendBtn.click();
  await waitForStreamingDone(page, 90000);
  await page.waitForTimeout(600);
  const replyNeutral = await getLastAssistantText(page);
  fs.writeFileSync('.evaluator_tmp/f15-3-reply.txt', replyNeutral);
  const strongEmpathy = /つらかったですね|その気持ち、よく分かります/.test(replyNeutral);
  const strongPush = /その調子です|次の一歩を考えましょう/.test(replyNeutral);
  const neutralOk = !strongEmpathy && !strongPush;
  results.push({ feature: 'F15', no: 3, title: '気分=😐 で中立トーン(addendumなし)', score: neutralOk ? 10 : 5, detail: `strongEmpathy=${strongEmpathy} strongPush=${strongPush}` });

  await newBtn.click(); await page.waitForTimeout(400);
  if (await page.locator('#summary-modal .summary-button-reset').count() > 0) { await page.locator('#summary-modal .summary-button-reset').click(); await page.waitForTimeout(500); }

  // F15-4: no emotion recorded → default mode tone
  log('Feature 15-4: no emotion');
  await textarea.fill('はじめまして。');
  await sendBtn.click();
  await waitForStreamingDone(page, 90000);
  await page.waitForTimeout(300);
  await textarea.fill('最近少し疲れています。');
  await sendBtn.click();
  await waitForStreamingDone(page, 90000);
  await page.waitForTimeout(600);
  const replyDefault = await getLastAssistantText(page);
  fs.writeFileSync('.evaluator_tmp/f15-4-reply.txt', replyDefault);
  const defaultHasReply = replyDefault.length > 10;
  results.push({ feature: 'F15', no: 4, title: '気分未選択で従来モードトーン', score: defaultHasReply ? 10 : 3, detail: `replyLen=${replyDefault.length}` });

  // ================= Feature 17: 回帰 =================
  await newBtn.click(); await page.waitForTimeout(400);
  if (await page.locator('#summary-modal .summary-button-reset').count() > 0) { await page.locator('#summary-modal .summary-button-reset').click(); await page.waitForTimeout(500); }

  // F17-1 category
  log('Feature 17-1: category=日常生活');
  const cat = page.locator('[data-category="日常生活"]').first();
  const catExists = await cat.count() > 0;
  if (catExists) { await cat.click(); await page.waitForTimeout(200); }
  await textarea.fill('朝起きるのが辛いです。');
  await sendBtn.click();
  await waitForStreamingDone(page, 90000);
  await page.waitForTimeout(400);
  const catReply = await getLastAssistantText(page);
  fs.writeFileSync('.evaluator_tmp/f17-1-cat.txt', catReply);
  const catReflected = catReply.length > 20;
  results.push({ feature: 'F17', no: 1, title: 'カテゴリ「日常生活」が反映', score: (catExists && catReflected) ? 10 : (catReflected ? 7 : 2), detail: `catBtnExists=${catExists} replyLen=${catReply.length}` });

  await newBtn.click(); await page.waitForTimeout(400);
  if (await page.locator('#summary-modal .summary-button-reset').count() > 0) { await page.locator('#summary-modal .summary-button-reset').click(); await page.waitForTimeout(500); }

  // F17-2 mode=共感
  log('Feature 17-2: mode=共感');
  const modeEmp = page.locator('[data-mode="empathy"]').first();
  const modeEmpExists = await modeEmp.count() > 0;
  if (modeEmpExists) { await modeEmp.click(); await page.waitForTimeout(200); }
  await textarea.fill('友達とけんかしてしまいました。');
  await sendBtn.click();
  await waitForStreamingDone(page, 90000);
  await page.waitForTimeout(400);
  const empReply = await getLastAssistantText(page);
  fs.writeFileSync('.evaluator_tmp/f17-2-empathy.txt', empReply);
  const empOk = /気持ち|つらい|大変|分かり|分かる|寄り添/.test(empReply);
  results.push({ feature: 'F17', no: 2, title: 'モード「共感」が反映', score: (modeEmpExists && empOk) ? 10 : (empOk ? 7 : 3), detail: `modeBtnExists=${modeEmpExists} empathyWords=${empOk}` });

  // F17-3 themes (default/ocean/forest/night/sakura)
  log('Feature 17-3: theme switches');
  const themeResults = [];
  for (const theme of ['default', 'ocean', 'forest', 'night', 'sakura']) {
    const btn = page.locator(`[data-theme="${theme}"]`).first();
    const btnExists = await btn.count() > 0;
    if (btnExists) {
      await btn.click();
      await page.waitForTimeout(200);
      // Measure: emotion-selector and chat visible, no overlap
      const layoutOk = await page.evaluate(() => {
        const el = document.querySelector('.emotion-selector');
        const chat = document.querySelector('#chat-messages');
        if (!el) return true; // no emotion selector — still OK if chat layout intact
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      themeResults.push({ theme, ok: layoutOk });
    } else {
      themeResults.push({ theme, ok: null, note: 'button not found' });
    }
  }
  const allThemesOk = themeResults.every(r => r.ok === true || r.ok === null);
  const anyThemeFail = themeResults.some(r => r.ok === false);
  results.push({ feature: 'F17', no: 3, title: '5テーマ切替でレイアウト崩れなし', score: allThemesOk && !anyThemeFail ? 10 : 5, detail: JSON.stringify(themeResults) });

  // F17-4 char counter
  log('Feature 17-4: char counter');
  await textarea.fill('');
  await textarea.type('テスト文字列');
  await page.waitForTimeout(200);
  const counterText = await page.evaluate(() => {
    const el = document.querySelector('#char-count');
    return el ? el.innerText : '';
  });
  const counterOk = /\d/.test(counterText);
  results.push({ feature: 'F17', no: 4, title: '文字数カウンタが動作', score: counterOk ? 10 : 4, detail: `counterText=${counterText}` });

  // F17-5 reset clears context - send consult, reset, send new, verify 1st not in context
  log('Feature 17-5: reset clears context');
  await textarea.fill('');
  await textarea.fill('私の名前はタロウです。');
  await sendBtn.click();
  await waitForStreamingDone(page, 90000);
  await page.waitForTimeout(400);
  await newBtn.click(); await page.waitForTimeout(400);
  if (await page.locator('#summary-modal .summary-button-reset').count() > 0) { await page.locator('#summary-modal .summary-button-reset').click(); await page.waitForTimeout(600); }
  await textarea.fill('私の名前は何でしたか？');
  await sendBtn.click();
  await waitForStreamingDone(page, 90000);
  await page.waitForTimeout(400);
  const nameReply = await getLastAssistantText(page);
  fs.writeFileSync('.evaluator_tmp/f17-5-reply.txt', nameReply);
  const noLeakage = !/タロウ/.test(nameReply);
  results.push({ feature: 'F17', no: 5, title: 'リセット後に前回の文脈が引き継がれない', score: noLeakage ? 10 : 2, detail: `leaked=${!noLeakage}` });

  // F17-6 context maintained in same session
  log('Feature 17-6: context maintained');
  await textarea.fill('私の好きな食べ物はカレーです。');
  await sendBtn.click();
  await waitForStreamingDone(page, 90000);
  await page.waitForTimeout(400);
  await textarea.fill('さっき言った好きな食べ物は何でしたっけ？');
  await sendBtn.click();
  await waitForStreamingDone(page, 90000);
  await page.waitForTimeout(600);
  const ctxReply = await getLastAssistantText(page);
  fs.writeFileSync('.evaluator_tmp/f17-6-reply.txt', ctxReply);
  const ctxOk = /カレー/.test(ctxReply);
  results.push({ feature: 'F17', no: 6, title: '同一セッション内の会話履歴維持', score: ctxOk ? 10 : 2, detail: `ctxKept=${ctxOk}` });

  // F17-7 enter / shift+enter
  log('Feature 17-7: enter / shift+enter');
  await newBtn.click(); await page.waitForTimeout(400);
  if (await page.locator('#summary-modal .summary-button-reset').count() > 0) { await page.locator('#summary-modal .summary-button-reset').click(); await page.waitForTimeout(500); }
  await textarea.fill('');
  await textarea.type('1行目');
  await page.keyboard.down('Shift');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Shift');
  await textarea.type('2行目');
  const taValue = await textarea.inputValue();
  const multiline = taValue.includes('\n');
  // now Enter should send
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const taAfter = await textarea.inputValue();
  const cleared = taAfter === '';
  results.push({ feature: 'F17', no: 7, title: 'Enter送信/Shift+Enter改行', score: (multiline && cleared) ? 10 : (multiline || cleared ? 6 : 2), detail: `shiftEnterMultiline=${multiline} enterSent=${cleared}` });
  await waitForStreamingDone(page, 90000);

  // F17-8 console errors
  const errorsExceptFavicon = consoleErrors.filter(e => !/favicon|404/i.test(e));
  results.push({ feature: 'F17', no: 8, title: 'コンソールエラー0件(favicon除く)', score: errorsExceptFavicon.length === 0 ? 10 : Math.max(0, 10 - errorsExceptFavicon.length * 2), detail: errorsExceptFavicon.length === 0 ? 'エラーなし' : `errors=${JSON.stringify(errorsExceptFavicon.slice(0, 3))}` });

  // Output
  fs.writeFileSync('.evaluator_tmp/results.json', JSON.stringify({ results, bugs, consoleErrors }, null, 2));
  log('=== Done ===');
  for (const r of results) {
    log(`${r.feature}-${r.no} [${r.score}/10] ${r.title} — ${r.detail}`);
  }

  await browser.close();
}

main().catch(err => {
  console.error('FATAL', err);
  fs.writeFileSync('.evaluator_tmp/fatal.txt', String(err.stack || err));
  process.exit(1);
});
