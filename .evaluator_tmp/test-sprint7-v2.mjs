// Sprint 7 v2: Full test with workaround for resume modal bug (uses MutationObserver to detect fleeting modal)
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';
const DB_PATH = path.resolve('data/app.db');
const results = [];
const bugs = [];
const consoleErrors = [];

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function record(id, title, score, detail, feature) {
  results.push({ id, title, score, detail, feature });
  log(`[${id}] ${score}/10 - ${title}`);
  if (detail) log(`  ${detail}`);
}
function bug(title, reproduce, expected, actual, severity) {
  bugs.push({ title, reproduce, expected, actual, severity });
}

async function waitForStreamingDone(page, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const disabled = await page.locator('#send-button').first().isDisabled().catch(() => true);
    if (!disabled) {
      const stillStreaming = await page.locator('.message-streaming').count().catch(() => 0);
      if (stillStreaming === 0) return true;
    }
    await page.waitForTimeout(300);
  }
  return false;
}

async function sendConsult(page, text) {
  await page.fill('#message-input', text);
  await page.click('#send-button');
  return await waitForStreamingDone(page);
}

async function queryDb(sql, params = []) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(DB_PATH);
  try {
    const stmt = db.prepare(sql);
    let rows;
    if (sql.trim().toLowerCase().startsWith('select')) {
      rows = stmt.all(...params);
    } else {
      rows = stmt.run(...params);
    }
    return rows;
  } finally {
    db.close();
  }
}

/**
 * Create a page that records modal mutations so we can detect fleeting modal display.
 */
async function createSpyPage(context) {
  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!/favicon/.test(t)) consoleErrors.push(`[${Date.now()}] ${t}`);
    }
  });
  page.on('pageerror', err => { consoleErrors.push(`pageerror: ${err.message}`); });

  await page.addInitScript(() => {
    window.__modalLog = [];
    window.__modalAppeared = false;
    window.__modalLastContent = '';
    const installObserver = () => {
      const modal = document.getElementById('resume-modal');
      if (!modal) { setTimeout(installObserver, 10); return; }
      const obs = new MutationObserver(() => {
        if (!modal.hidden && modal.innerHTML.length > 0) {
          window.__modalAppeared = true;
          window.__modalLastContent = modal.innerHTML;
        }
        window.__modalLog.push({
          t: Date.now(),
          hidden: modal.hidden,
          htmlLen: modal.innerHTML.length,
          cls: modal.className,
        });
      });
      obs.observe(modal, { attributes: true, childList: true, subtree: false });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', installObserver);
    } else {
      installObserver();
    }
  });
  return page;
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // ===================================================
  // FEATURE 18: オンボーディング
  // ===================================================
  log('=== Feature 18: Onboarding + UUID ===');

  let context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let page = await createSpyPage(context);

  // F18-1
  await page.goto(BASE);
  await page.waitForTimeout(800);
  const hash1 = await page.evaluate(() => location.hash);
  const onboardingVisible = await page.locator('#onboarding-screen').isVisible().catch(() => false);
  const chatHidden = await page.evaluate(() => document.getElementById('chat-container').hidden);
  const hasNameInput = await page.locator('#onboarding-name-input').count() > 0;
  const hasSubmit = await page.locator('.onboarding-submit').count() > 0;
  if (hash1 === '#/onboarding' && onboardingVisible && chatHidden && hasNameInput && hasSubmit) {
    record('F18-1', '初回アクセスでオンボーディング画面が表示される', 10,
      `hash=${hash1}, onboarding visible, chat hidden, name+submit present`, 'F18');
  } else {
    record('F18-1', '初回アクセスでオンボーディング画面が表示される',
      (onboardingVisible && hasNameInput) ? 7 : 3,
      `hash=${hash1}, visible=${onboardingVisible}, chatHidden=${chatHidden}`, 'F18');
  }

  // F18-2
  await page.click('.onboarding-submit');
  await page.waitForTimeout(500);
  const errorVisible = await page.locator('#onboarding-error').isVisible().catch(() => false);
  const errorText = await page.locator('#onboarding-error').textContent().catch(() => '');
  const stillOnboarding = await page.evaluate(() => location.hash) === '#/onboarding';
  const stillNoUuid = await page.evaluate(() => !localStorage.getItem('consultationApp.userUuid'));
  if (errorVisible && stillOnboarding && stillNoUuid) {
    record('F18-2', '空欄確定でエラー表示+画面遷移なし', 10,
      `error="${errorText}"`, 'F18');
  } else {
    record('F18-2', '空欄確定でエラー表示+画面遷移なし', 4,
      `errorVisible=${errorVisible}, stillOnb=${stillOnboarding}, noUuid=${stillNoUuid}`, 'F18');
  }

  // F18-3
  await page.fill('#onboarding-name-input', 'テスト太郎');
  await page.click('.onboarding-submit');
  await page.waitForTimeout(2500);
  const uuidStored = await page.evaluate(() => localStorage.getItem('consultationApp.userUuid'));
  const nameStored = await page.evaluate(() => localStorage.getItem('consultationApp.userName'));
  const hash2 = await page.evaluate(() => location.hash);
  const chatVisible = await page.evaluate(() => !document.getElementById('chat-container').hidden);
  const uuidValid = uuidStored && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuidStored);
  if (uuidValid && nameStored === 'テスト太郎' && (hash2 === '#/' || hash2 === '#') && chatVisible) {
    record('F18-3', 'ユーザー名登録でUUID発行・localStorage保存・相談画面遷移', 10,
      `uuid=${uuidStored.slice(0,8)}..., name=${nameStored}`, 'F18');
  } else {
    record('F18-3', 'ユーザー名登録でUUID発行・localStorage保存・相談画面遷移',
      (uuidValid && nameStored) ? 6 : 2,
      `uuidValid=${!!uuidValid}, name=${nameStored}, hash=${hash2}`, 'F18');
  }

  // F18-4
  const headerName = await page.locator('#header-user-name').textContent().catch(() => '');
  const headerNameVisible = await page.locator('#header-user-name').isVisible().catch(() => false);
  if (headerNameVisible && headerName.includes('テスト太郎')) {
    record('F18-4', 'ヘッダにユーザー名が表示される', 10, `text="${headerName}"`, 'F18');
  } else {
    record('F18-4', 'ヘッダにユーザー名が表示される', headerNameVisible ? 6 : 2,
      `visible=${headerNameVisible}, text="${headerName}"`, 'F18');
  }

  // F18-5
  await page.reload();
  await page.waitForTimeout(2500);
  const hash3 = await page.evaluate(() => location.hash);
  const obVisibleAfterReload = await page.locator('#onboarding-screen').isVisible().catch(() => false);
  const uuidAfterReload = await page.evaluate(() => localStorage.getItem('consultationApp.userUuid'));
  const headerAfterReload = await page.locator('#header-user-name').textContent().catch(() => '');
  if (!obVisibleAfterReload && uuidAfterReload === uuidStored && headerAfterReload.includes('テスト太郎')) {
    record('F18-5', 'リロード時オンボスキップ・同ユーザー名維持', 10,
      `hash=${hash3}, uuid preserved`, 'F18');
  } else {
    record('F18-5', 'リロード時オンボスキップ・同ユーザー名維持',
      uuidAfterReload === uuidStored ? 6 : 2,
      `obVisible=${obVisibleAfterReload}, preserved=${uuidAfterReload === uuidStored}`, 'F18');
  }

  // F18-6
  const keys = await page.evaluate(() => Object.keys(localStorage));
  if (keys.includes('consultationApp.userUuid') && keys.includes('consultationApp.userName')) {
    record('F18-6', 'localStorageキー名が規約どおり', 10, `keys=${JSON.stringify(keys)}`, 'F18');
  } else {
    record('F18-6', 'localStorageキー名が規約どおり', 3, `keys=${JSON.stringify(keys)}`, 'F18');
  }

  // F18-7
  const authInputs = await page.evaluate(() => {
    const selectors = ['input[type="password"]','input[type="email"]','input[type="tel"]',
      'input[name*="password" i]','input[name*="email" i]','input[name*="phone" i]'];
    const found = [];
    for (const sel of selectors) document.querySelectorAll(sel).forEach(el => found.push(sel));
    return found;
  });
  if (authInputs.length === 0) {
    record('F18-7', 'パスワード/メール/電話入力欄が一切存在しない', 10, 'none', 'F18');
  } else {
    record('F18-7', 'パスワード/メール/電話入力欄が一切存在しない', 2, `found: ${authInputs.join(',')}`, 'F18');
  }

  // ===================================================
  // FEATURE 19: DB 永続化
  // ===================================================
  log('=== Feature 19: DB persistence ===');

  // F19-1 + F19-3: 送信と mode/category 保存を同時確認
  // 既にF18-5でreloadしていて、welcomeが出ている可能性あり。re-navigate
  await page.evaluate(() => location.hash = '#/');
  await page.waitForTimeout(300);
  const mb = page.locator('.mode-button[data-mode="empathy"]');
  if (await mb.count() > 0) await mb.click();
  const cb = page.locator('.category-button[data-category="日常生活"]');
  if (await cb.count() > 0) await cb.click();
  await page.waitForTimeout(300);

  const sendOK = await sendConsult(page, '最近よく眠れなくて、日常の些細なことに悩んでしまいます。');
  await page.waitForTimeout(800);

  try {
    const messages = await queryDb("SELECT * FROM messages ORDER BY created_at ASC");
    const userMsgs = messages.filter(m => m.role === 'user');
    const assistantMsgs = messages.filter(m => m.role === 'assistant');
    const hasUserContent = userMsgs.some(m => m.content.includes('眠れなく'));
    const hasAssistant = assistantMsgs.length > 0;
    if (hasUserContent && hasAssistant) {
      record('F19-1', '相談送信後messagesにuser+assistant保存', 10,
        `user=${userMsgs.length}, assistant=${assistantMsgs.length}`, 'F19');
    } else {
      record('F19-1', '相談送信後messagesにuser+assistant保存',
        userMsgs.length > 0 ? 5 : 1,
        `user=${userMsgs.length}, assistant=${assistantMsgs.length}, contentMatch=${hasUserContent}, sendOK=${sendOK}`, 'F19');
    }

    // F19-3
    const userMsg = userMsgs.find(m => m.content.includes('眠れなく'));
    if (userMsg && userMsg.mode === 'empathy' && userMsg.category === '日常生活') {
      record('F19-3', 'messages に mode=empathy / category=日常生活 保存', 10,
        `mode=${userMsg.mode}, category=${userMsg.category}`, 'F19');
    } else {
      record('F19-3', 'messages に mode=empathy / category=日常生活 保存',
        (userMsg && (userMsg.mode || userMsg.category)) ? 5 : 1,
        `mode=${userMsg?.mode}, category=${userMsg?.category}`, 'F19');
    }
  } catch (err) {
    record('F19-1', '相談送信後messagesにuser+assistant保存', 1, `queryDb failed: ${err.message}`, 'F19');
    record('F19-3', 'messages に mode=empathy / category=日常生活 保存', 1, `queryDb failed: ${err.message}`, 'F19');
  }

  // F19-2
  const emotionSelectorCount = await page.locator('.emotion-selector').count();
  if (emotionSelectorCount > 0) {
    const firstSelector = page.locator('.emotion-selector').first();
    await firstSelector.locator('.emotion-button').nth(3).click(); // 🙂
    await page.waitForTimeout(1200);
    try {
      const emotions = await queryDb("SELECT * FROM emotion_records ORDER BY created_at ASC");
      if (emotions.length > 0 && emotions[emotions.length - 1].emoji_value === 4) {
        const hasMsgId = emotions[emotions.length - 1].message_id !== null;
        record('F19-2', '絵文字クリックで emotion_records 保存+message_id 紐付け',
          hasMsgId ? 10 : 6,
          `emotions=${emotions.length}, emoji_value=${emotions[emotions.length - 1].emoji_value}, hasMsgId=${hasMsgId}`, 'F19');
      } else {
        record('F19-2', '絵文字クリックで emotion_records 保存+message_id 紐付け', 2,
          `emotions=${emotions.length}`, 'F19');
      }
    } catch (err) {
      record('F19-2', '絵文字クリックで emotion_records 保存+message_id 紐付け', 1, err.message, 'F19');
    }
  } else {
    record('F19-2', '絵文字クリックで emotion_records 保存+message_id 紐付け', 0, 'no emotion selector', 'F19');
  }

  // F19-4: ブラウザ完全クローズ → 再アクセス（storageState 経由で再現）+ resume modal の検出
  const userUuidBeforeClose = uuidStored;
  const storageState = await context.storageState();
  await context.close();

  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState });
  page = await createSpyPage(context);
  await page.goto(BASE);
  await page.waitForTimeout(3500);

  // resume modal が一瞬でも表示されたか（MutationObserverで観測）
  const modalAppeared = await page.evaluate(() => window.__modalAppeared);
  const modalLastContent = await page.evaluate(() => window.__modalLastContent || '');
  const modalCurrentlyVisible = await page.locator('#resume-modal').isVisible().catch(() => false);
  const modalLog = await page.evaluate(() => window.__modalLog);

  const reopenUuid = await page.evaluate(() => localStorage.getItem('consultationApp.userUuid'));
  const apiHistoryCheck = await page.evaluate(async () => {
    const uuid = localStorage.getItem('consultationApp.userUuid');
    const res = await fetch('/api/history', { headers: { 'x-user-uuid': uuid } });
    if (!res.ok) return { error: res.status };
    return { sessionsCount: (await res.json()).sessions.length };
  });
  if (reopenUuid === userUuidBeforeClose && apiHistoryCheck.sessionsCount >= 1) {
    record('F19-4', 'ブラウザ再起動後 同UUID認識+DB前回データ残存', 10,
      `uuid preserved, /api/history sessions=${apiHistoryCheck.sessionsCount}`, 'F19');
  } else {
    record('F19-4', 'ブラウザ再起動後 同UUID認識+DB前回データ残存',
      reopenUuid === userUuidBeforeClose ? 4 : 1,
      `uuid preserved=${reopenUuid === userUuidBeforeClose}, history=${JSON.stringify(apiHistoryCheck)}`, 'F19');
  }

  // F19-5: 別コンテキスト
  const context2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page2 = await context2.newPage();
  await page2.goto(BASE);
  await page2.waitForTimeout(800);
  const ob2 = await page2.locator('#onboarding-screen').isVisible().catch(() => false);
  if (!ob2) {
    record('F19-5', '別コンテキストで別UUID+前ユーザーのデータ不可視', 2, 'onboarding not shown', 'F19');
  } else {
    await page2.fill('#onboarding-name-input', '花子');
    await page2.click('.onboarding-submit');
    await page2.waitForTimeout(2500);
    const uuid2 = await page2.evaluate(() => localStorage.getItem('consultationApp.userUuid'));
    const historyCheck2 = await page2.evaluate(async () => {
      const uuid = localStorage.getItem('consultationApp.userUuid');
      const res = await fetch('/api/history', { headers: { 'x-user-uuid': uuid } });
      return { sessionsCount: (await res.json()).sessions.length };
    });
    if (uuid2 && uuid2 !== userUuidBeforeClose && historyCheck2.sessionsCount === 0) {
      record('F19-5', '別コンテキストで別UUID+前ユーザーのデータ不可視', 10,
        `uuid2=${uuid2.slice(0,8)}..., sessionsForUser2=${historyCheck2.sessionsCount}`, 'F19');
    } else {
      record('F19-5', '別コンテキストで別UUID+前ユーザーのデータ不可視',
        uuid2 !== userUuidBeforeClose ? 5 : 1,
        `uuid2 differs=${uuid2 !== userUuidBeforeClose}, sessions=${historyCheck2.sessionsCount}`, 'F19');
    }
  }
  await context2.close();

  // ===================================================
  // FEATURE 21: 再開モーダル
  // ===================================================
  log('=== Feature 21: Resume modal ===');

  // F21-1: resume modal が「現状としてユーザー操作可能な状態で表示された」か検証
  // MutationObserverで瞬間的表示は検知できるが、ユーザー操作が必要なので現在visibleでなければ失格
  if (modalCurrentlyVisible) {
    record('F21-1', '相談送信→リロードで再開モーダル表示', 10,
      `modal currently visible, content present`, 'F21');
  } else if (modalAppeared) {
    // 一瞬表示された後消えている（bug）
    record('F21-1', '相談送信→リロードで再開モーダル表示', 2,
      `modal flashed briefly then was dismissed by navigation (bug: modal appears then immediately closes, ~7ms lifetime). MutationObserver saw modal at HTML len=${modalLastContent.length} but it was dismissed before user could interact.`, 'F21');
    bug('再開モーダルが一瞬表示された直後に dismiss される',
      '既登録ユーザーが /api/sessions/resumable の 200 応答を受け、相談画面へのリロードを行う',
      'モーダルが表示され、「前回の続きから再開する」「新しく始める」ボタンがユーザー操作可能',
      'モーダルが ~7ms 表示された後、非同期 hashchange イベントによる subscribeRoute コールバックが showChatOnly → dismissResumeModal を呼び、モーダルが閉じられる。結果としてユーザーは操作不可能',
      'Critical');
  } else {
    record('F21-1', '相談送信→リロードで再開モーダル表示', 0,
      `modal never appeared. Log entries: ${modalLog.length}. Last state: hidden=${modalLog[modalLog.length-1]?.hidden}`, 'F21');
  }

  // F21-2: 2ボタン - 瞬間的にでも現れていれば内容で判定
  if (modalLastContent && modalLastContent.includes('続き') && modalLastContent.includes('新し')) {
    record('F21-2', 'モーダルに「続きから」「新しく始める」2ボタン', 7,
      `buttons found in HTML but modal dismissed too fast for user interaction (text: "${modalLastContent.match(/続き[^<]*|新し[^<]*/g)?.join('" / "')}") `, 'F21');
  } else {
    record('F21-2', 'モーダルに「続きから」「新しく始める」2ボタン', 2,
      `modal content not observable; content=${modalLastContent.slice(0,150)}`, 'F21');
  }

  // F21-3 / F21-4: 「続きから」ボタンをinjectionでクリック
  // モーダルが瞬間消えるので、直接 showModal を呼んで強制表示させてからクリック
  const resumeAttempt = await page.evaluate(async () => {
    const api = await import('/js/api.js');
    const resume = await import('/js/ui/resume.js');
    const payload = await api.getResumableSession();
    if (!payload || !payload.session) return { ok: false, err: 'no payload' };
    resume.showModal(payload);
    await new Promise(r => setTimeout(r, 100));
    // クリック
    const btn = document.querySelector('.resume-button-resume');
    if (!btn) return { ok: false, err: 'no button' };
    btn.click();
    return { ok: true, payloadMsgCount: payload.messages.length, payloadEmoCount: payload.emotions.length };
  });
  await page.waitForTimeout(2000);
  if (!resumeAttempt.ok) {
    record('F21-3', '「続きから」で前発言が即時表示（ストリーミングなし）', 0, `failed: ${resumeAttempt.err}`, 'F21');
    record('F21-4', '感情記録の .active 状態が復元される', 0, 'cannot test', 'F21');
  } else {
    const messagesRestored = await page.locator('.message:not(.message-welcome)').count();
    const streamingDuring = await page.locator('.message-streaming').count();
    if (messagesRestored >= 2 && streamingDuring === 0) {
      record('F21-3', '「続きから」で前発言が即時表示（ストリーミングなし）', 10,
        `msgs=${messagesRestored}, no streaming element`, 'F21');
    } else {
      record('F21-3', '「続きから」で前発言が即時表示（ストリーミングなし）',
        messagesRestored >= 2 ? 5 : 1,
        `msgs=${messagesRestored}, streaming=${streamingDuring}`, 'F21');
    }

    // F21-4
    const activeEmoji = await page.locator('.emotion-button.active').count();
    if (activeEmoji >= 1) {
      record('F21-4', '感情記録の .active 状態が復元される', 10,
        `active buttons=${activeEmoji}`, 'F21');
    } else {
      record('F21-4', '感情記録の .active 状態が復元される', 3,
        `no active button (activeCount=${activeEmoji})`, 'F21');
    }

    // F21-5: 再開後に新しい相談送信 → 同じsessionId に追記
    let sessionIdBeforeSend = null;
    try {
      const sessions = await queryDb("SELECT * FROM sessions WHERE user_uuid=? ORDER BY started_at DESC", [userUuidBeforeClose]);
      sessionIdBeforeSend = sessions.find(s => !s.closed_at)?.id;
    } catch (err) { log(`queryDb sessions failed: ${err.message}`); }

    const mBefore = (await queryDb("SELECT COUNT(*) as n FROM messages WHERE session_id=?", [sessionIdBeforeSend]))[0].n;
    const sendResult = await sendConsult(page, 'さっきの続きで、もう少し相談させてください。');
    await page.waitForTimeout(800);
    const mAfter = (await queryDb("SELECT COUNT(*) as n FROM messages WHERE session_id=?", [sessionIdBeforeSend]))[0].n;
    if (sessionIdBeforeSend && mAfter >= mBefore + 2) {
      record('F21-5', '再開後の相談は同 sessionId に追記', 10,
        `sessionId=${sessionIdBeforeSend.slice(0,8)}, messages: ${mBefore}→${mAfter}`, 'F21');
    } else {
      record('F21-5', '再開後の相談は同 sessionId に追記',
        mAfter > mBefore ? 5 : 1,
        `sessionId=${sessionIdBeforeSend?.slice(0,8)}, ${mBefore}→${mAfter}, sent=${sendResult}`, 'F21');
    }

    // F21-6: 別シナリオ「新しく始める」ボタン — 瞬間表示されたmodalのテキスト確認と、強制表示でのFreshテスト
    const testSessionId = (await queryDb(
      "SELECT id FROM sessions WHERE user_uuid=? AND closed_at IS NULL ORDER BY started_at DESC LIMIT 1",
      [userUuidBeforeClose]))[0]?.id;
    if (!testSessionId) {
      record('F21-6', '「新しく始める」で前セッションclose+新規相談画面', 3,
        'no open session to test', 'F21');
    } else {
      // 強制showModal → freshボタンクリック
      const freshAttempt = await page.evaluate(async () => {
        const api = await import('/js/api.js');
        const resume = await import('/js/ui/resume.js');
        const payload = await api.getResumableSession();
        if (!payload || !payload.session) return { ok: false, err: 'no payload' };
        resume.showModal(payload);
        await new Promise(r => setTimeout(r, 100));
        const btn = document.querySelector('.resume-button-fresh');
        if (!btn) return { ok: false, err: 'no fresh button' };
        btn.click();
        return { ok: true };
      });
      await page.waitForTimeout(2000);
      if (!freshAttempt.ok) {
        record('F21-6', '「新しく始める」で前セッションclose+新規相談画面', 2,
          `injection failed: ${freshAttempt.err}`, 'F21');
      } else {
        const sessionClosed = await queryDb("SELECT closed_at FROM sessions WHERE id=?", [testSessionId]);
        const chatMsgs = await page.locator('.message:not(.message-welcome)').count();
        const modalAfter = await page.locator('#resume-modal').isVisible().catch(() => false);
        if (sessionClosed[0]?.closed_at && !modalAfter) {
          record('F21-6', '「新しく始める」で前セッションclose+新規相談画面', 10,
            `closed_at=${sessionClosed[0].closed_at}, chatMsgs=${chatMsgs}`, 'F21');
        } else {
          record('F21-6', '「新しく始める」で前セッションclose+新規相談画面',
            sessionClosed[0]?.closed_at ? 7 : 3,
            `closed_at=${sessionClosed[0]?.closed_at}, modalVisible=${modalAfter}, msgs=${chatMsgs}`, 'F21');
        }
      }
    }
  }

  // F21-7: 初回訪問時はモーダル非表示
  const context3 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page3 = await createSpyPage(context3);
  await page3.goto(BASE);
  await page3.waitForTimeout(1500);
  const rm3 = await page3.locator('#resume-modal').isVisible().catch(() => false);
  const mLog3 = await page3.evaluate(() => window.__modalAppeared);
  const ob3 = await page3.locator('#onboarding-screen').isVisible().catch(() => false);
  if (!rm3 && !mLog3 && ob3) {
    record('F21-7', '初回訪問時は再開モーダル非表示（オンボ優先）', 10,
      `onboarding shown, resume modal never appeared`, 'F21');
  } else {
    record('F21-7', '初回訪問時は再開モーダル非表示（オンボ優先）', 3,
      `resumeVisible=${rm3}, modalEverAppeared=${mLog3}, onboarding=${ob3}`, 'F21');
  }
  await context3.close();

  // F21-8: 前日以前の未closeセッションは候補にならない
  const yesterdayIso = new Date(Date.now() - 24*60*60*1000).toISOString();
  const testOldSessionId = 'test-yesterday-' + Date.now();
  try {
    await queryDb(
      "UPDATE sessions SET closed_at=datetime('now') WHERE user_uuid=? AND closed_at IS NULL",
      [userUuidBeforeClose]);
    await queryDb(
      "INSERT INTO sessions (id, user_uuid, started_at, closed_at) VALUES (?, ?, ?, NULL)",
      [testOldSessionId, userUuidBeforeClose, yesterdayIso]);
    const testMsgId = 'test-msg-' + Date.now();
    await queryDb(
      "INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, 'user', '昨日の相談', ?)",
      [testMsgId, testOldSessionId, yesterdayIso]);
  } catch (err) {
    log(`F21-8 DB prep failed: ${err.message}`);
  }

  const newCtx8 = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    storageState: await context.storageState(),
  });
  const page8 = await createSpyPage(newCtx8);
  await page8.goto(BASE);
  await page8.waitForTimeout(3500);
  const modalAppeared8 = await page8.evaluate(() => window.__modalAppeared);
  const modalVisible8 = await page8.locator('#resume-modal').isVisible().catch(() => false);

  // Also verify via direct API call
  const directApiCheck = await page8.evaluate(async () => {
    const uuid = localStorage.getItem('consultationApp.userUuid');
    const res = await fetch(`/api/sessions/resumable?uuid=${uuid}`, { headers: { 'x-user-uuid': uuid } });
    return { status: res.status };
  });
  // API returns 204 (no resumable) → correct behavior
  if (directApiCheck.status === 204 && !modalAppeared8 && !modalVisible8) {
    record('F21-8', '前日以前の未closeセッションは候補にならない（当日判定）', 10,
      `API 204, modal never appeared`, 'F21');
  } else {
    record('F21-8', '前日以前の未closeセッションは候補にならない（当日判定）',
      directApiCheck.status === 204 ? 7 : 2,
      `apiStatus=${directApiCheck.status}, modalAppeared=${modalAppeared8}`, 'F21');
  }
  await newCtx8.close();

  // ===================================================
  // FEATURE 20: 履歴画面
  // ===================================================
  log('=== Feature 20: History screen ===');

  // 新規コンテキストでテスト（既存ユーザーの履歴を見る）
  const context20 = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    storageState: await context.storageState(),
  });
  const page20 = await createSpyPage(context20);
  await page20.goto(BASE);
  await page20.waitForTimeout(3000);

  // F21のdismissバグが出てmodalが消えているはず。あるいは204で出ていない
  // 新しい相談を2件作る。まず fresh-click（modal強制表示→fresh）で既存セッションをcloseする
  const freshForHistory = await page20.evaluate(async () => {
    const api = await import('/js/api.js');
    const resume = await import('/js/ui/resume.js');
    const payload = await api.getResumableSession();
    if (payload && payload.session) {
      resume.showModal(payload);
      await new Promise(r => setTimeout(r, 200));
      const btn = document.querySelector('.resume-button-fresh');
      if (btn) btn.click();
    }
    return { had: !!(payload && payload.session) };
  });
  log(`  pre-history freshForHistory: ${JSON.stringify(freshForHistory)}`);
  await page20.waitForTimeout(1500);

  // 第1セッション
  await page20.evaluate(() => location.hash = '#/');
  await page20.waitForTimeout(500);
  // mode/category reset
  const clearActives = async () => {
    const catActs = await page20.locator('.category-button.active').count();
    for (let i = 0; i < catActs; i++) {
      await page20.locator('.category-button.active').first().click().catch(() => {});
    }
  };
  await clearActives();

  const hs1 = await sendConsult(page20, '履歴テスト用: 最初のセッションの相談です。');
  if (hs1) {
    const sel = page20.locator('.emotion-selector').first();
    if (await sel.count() > 0) {
      await sel.locator('.emotion-button').nth(1).click().catch(() => {});
      await page20.waitForTimeout(700);
    }
  }
  // 新しい相談 → summary → リセット
  await page20.click('#new-consultation-button');
  await page20.waitForTimeout(500);
  const sumV = await page20.locator('#summary-modal').isVisible().catch(() => false);
  if (sumV) {
    const resetBtn = page20.locator('.summary-reset-button, button:has-text("リセット")');
    if (await resetBtn.count() > 0) {
      await resetBtn.first().click();
      await page20.waitForTimeout(1500);
    }
  }

  // 第2セッション
  const hs2 = await sendConsult(page20, '履歴テスト用: 2つめのセッションの相談です。');
  if (hs2) {
    const sel = page20.locator('.emotion-selector').first();
    if (await sel.count() > 0) {
      await sel.locator('.emotion-button').nth(3).click().catch(() => {});
      await page20.waitForTimeout(700);
    }
  }

  // F20-1: history link
  const historyLinkVisible = await page20.locator('#header-history-link').isVisible().catch(() => false);
  if (historyLinkVisible) {
    await page20.click('#header-history-link');
    await page20.waitForTimeout(1500);
    const hashH = await page20.evaluate(() => location.hash);
    const hvis = await page20.locator('#history-screen').isVisible().catch(() => false);
    if (hashH === '#/history' && hvis) {
      record('F20-1', '履歴リンク押下で #/history へ遷移', 10, `hash=${hashH}`, 'F20');
    } else {
      record('F20-1', '履歴リンク押下で #/history へ遷移', 4, `hash=${hashH}, visible=${hvis}`, 'F20');
    }
  } else {
    record('F20-1', '履歴リンク押下で #/history へ遷移', 2, 'link hidden', 'F20');
  }

  // F20-2
  const historyBody = await page20.locator('#history-screen').innerHTML().catch(() => '');
  const sessionItemCount = await page20.locator('#history-screen button[data-session-id], #history-screen [data-session-id]').count();
  const showsPreview = historyBody.includes('履歴テスト用');
  const hasDate = /\d{4}|\d{1,2}月|\d{1,2}\/|今日|本日|\d{4}-\d{2}-\d{2}/i.test(historyBody);
  if (hasDate && sessionItemCount >= 2 && showsPreview) {
    record('F20-2', '日付別セッション一覧・新しい順・冒頭テキスト表示', 10,
      `date headers, sessions=${sessionItemCount}, preview shown`, 'F20');
  } else {
    record('F20-2', '日付別セッション一覧・新しい順・冒頭テキスト表示',
      (sessionItemCount >= 2 || showsPreview) ? 6 : 3,
      `dateHeader=${hasDate}, sessions=${sessionItemCount}, preview=${showsPreview}`, 'F20');
  }

  // F20-3: セッション詳細
  let detailClicked = false;
  const cands = ['button[data-session-id]', '[data-session-id]'];
  for (const c of cands) {
    const cnt = await page20.locator(c).count();
    if (cnt > 0) {
      await page20.locator(c).first().click();
      await page20.waitForTimeout(1500);
      detailClicked = true;
      break;
    }
  }
  const hashAfterD = await page20.evaluate(() => location.hash);
  const isDetailRoute = /^#\/history\/[^\/]+$/.test(hashAfterD);
  if (detailClicked && isDetailRoute) {
    record('F20-3', 'セッションクリックで #/history/:id 詳細遷移', 10, `hash=${hashAfterD}`, 'F20');
  } else {
    record('F20-3', 'セッションクリックで #/history/:id 詳細遷移',
      detailClicked ? 5 : 1, `clicked=${detailClicked}, hash=${hashAfterD}`, 'F20');
  }

  // F20-3b: 発言が時系列表示
  const detailBody = await page20.locator('#history-screen').innerHTML().catch(() => '');
  const hasUserText = /履歴テスト用/.test(detailBody);
  if (hasUserText && detailBody.length > 200) {
    record('F20-3b', 'セッション詳細で発言が時系列で表示', 10,
      `user text present, body len=${detailBody.length}`, 'F20');
  } else {
    record('F20-3b', 'セッション詳細で発言が時系列で表示',
      hasUserText ? 5 : 1, `hasUser=${hasUserText}, len=${detailBody.length}`, 'F20');
  }

  // F20-4: 気分推移可視化
  const hasEmoji = /[😢😟😐🙂😊]/.test(detailBody);
  const hasEmotionClass = /emotion|気分|mood/i.test(detailBody);
  if (hasEmoji || hasEmotionClass) {
    record('F20-4', '気分推移（開始/中盤/終盤）の可視化', 10,
      `emoji in detail=${hasEmoji}, class=${hasEmotionClass}`, 'F20');
  } else {
    record('F20-4', '気分推移（開始/中盤/終盤）の可視化', 3, 'no emotion visualization', 'F20');
  }

  // F20-5: 戻るナビ
  let backClicked = false;
  const backLocators = [
    page20.locator('button:has-text("戻る")'),
    page20.locator('a:has-text("戻る")'),
    page20.locator('button:has-text("一覧に戻る")'),
    page20.locator('button:has-text("履歴一覧")'),
    page20.locator('.history-back-button'),
    page20.locator('.history-back'),
  ];
  for (const loc of backLocators) {
    if (await loc.count() > 0) {
      await loc.first().click();
      await page20.waitForTimeout(1000);
      backClicked = true;
      break;
    }
  }
  // After click, check hash
  const hashAfterBack = await page20.evaluate(() => location.hash);
  const chatVisibleAfterBack = await page20.evaluate(() => !document.getElementById('chat-container').hidden);
  if (backClicked) {
    record('F20-5', '戻るナビで相談画面または履歴一覧に戻れる', 10,
      `backClicked OK, hash=${hashAfterBack}`, 'F20');
  } else {
    // ヘッダのタイトルやヒストリー履歴は相談に戻る導線が無くてもヘッダリンクで可能かもしれない
    record('F20-5', '戻るナビで相談画面または履歴一覧に戻れる',
      historyLinkVisible ? 5 : 2,
      `no explicit back button; header link present: ${historyLinkVisible}`, 'F20');
  }

  // F20-6: 編集・削除UIなし
  await page20.evaluate(() => location.hash = '#/history');
  await page20.waitForTimeout(800);
  for (const c of cands) {
    const cnt = await page20.locator(c).count();
    if (cnt > 0) {
      await page20.locator(c).first().click();
      await page20.waitForTimeout(1000);
      break;
    }
  }
  const editDel = await page20.locator(
    'button:has-text("編集"), button:has-text("削除"), [class*="edit"]:not([class*="credit"]), [class*="delete"]'
  ).count();
  if (editDel === 0) {
    record('F20-6', '履歴画面に編集・削除UIがない（閲覧専用）', 10, 'none', 'F20');
  } else {
    record('F20-6', '履歴画面に編集・削除UIがない（閲覧専用）', 4, `${editDel} elements`, 'F20');
  }
  await context20.close();

  // ===================================================
  // 回帰テスト Sprint 1-6
  // ===================================================
  log('=== Regression: Sprint 1-6 ===');

  const contextR = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    storageState: await context.storageState(),
  });
  const pageR = await createSpyPage(contextR);
  await pageR.goto(BASE);
  await pageR.waitForTimeout(3000);

  // resumable があれば強制 fresh して初期化
  await pageR.evaluate(async () => {
    const api = await import('/js/api.js');
    const resume = await import('/js/ui/resume.js');
    const payload = await api.getResumableSession();
    if (payload && payload.session) {
      resume.showModal(payload);
      await new Promise(r => setTimeout(r, 200));
      const btn = document.querySelector('.resume-button-fresh');
      if (btn) btn.click();
    }
  });
  await pageR.waitForTimeout(1500);
  await pageR.evaluate(() => location.hash = '#/');
  await pageR.waitForTimeout(500);

  // R1: カテゴリ/モード/テーマ
  const cActivesR = await pageR.locator('.category-button.active').count();
  for (let i = 0; i < cActivesR; i++) {
    await pageR.locator('.category-button.active').first().click().catch(() => {});
  }
  await pageR.click('.category-button[data-category="仕事"]');
  const catA = await pageR.locator('.category-button[data-category="仕事"].active').count();
  await pageR.click('.mode-button[data-mode="solution"]');
  const modA = await pageR.locator('.mode-button[data-mode="solution"].active').count();
  await pageR.click('.theme-button[data-theme="forest"]');
  await pageR.waitForTimeout(200);
  const bodyCls = await pageR.evaluate(() => document.body.className);
  await pageR.click('.theme-button[data-theme="default"]');
  if (catA > 0 && modA > 0 && /forest/.test(bodyCls)) {
    record('R1', 'カテゴリ/モード/テーマ切替（Sprint 3/6）', 10,
      `all active; themeClass=${bodyCls}`, 'regression');
  } else {
    record('R1', 'カテゴリ/モード/テーマ切替（Sprint 3/6）', 4,
      `cat=${catA}, mode=${modA}, theme=${bodyCls}`, 'regression');
  }

  // R2: ストリーミング表示
  const cActivesR2 = await pageR.locator('.category-button.active').count();
  for (let i = 0; i < cActivesR2; i++) {
    await pageR.locator('.category-button.active').first().click().catch(() => {});
  }
  await pageR.fill('#message-input', '回帰テスト: ストリーミングは壊れていないか確認。');
  await pageR.click('#send-button');
  await pageR.waitForTimeout(700);
  const midStream = await pageR.locator('.message-streaming').count();
  const streamComplete = await waitForStreamingDone(pageR);
  if (midStream > 0 && streamComplete) {
    record('R2', 'ストリーミング表示が壊れていない（Sprint 5）', 10,
      `mid-stream count=${midStream}, completed`, 'regression');
  } else {
    record('R2', 'ストリーミング表示が壊れていない（Sprint 5）',
      streamComplete ? 6 : 2, `mid=${midStream}, complete=${streamComplete}`, 'regression');
  }

  // R3: 絵文字セレクタ
  const emC = await pageR.locator('.emotion-selector').count();
  const emB = await pageR.locator('.emotion-selector').first().locator('.emotion-button').count();
  if (emC >= 1 && emB === 5) {
    record('R3', '絵文字セレクタ（Sprint 6 Feature 14）', 10,
      `selector=${emC}, buttons=${emB}`, 'regression');
  } else {
    record('R3', '絵文字セレクタ（Sprint 6 Feature 14）', 3,
      `selector=${emC}, buttons=${emB}`, 'regression');
  }

  // R4: 気分トーン（DB経由）
  if (emC > 0) {
    await pageR.locator('.emotion-selector').first().locator('.emotion-button').first().click(); // 😢
    await pageR.waitForTimeout(500);
    await pageR.fill('#message-input', 'とてもつらくて、どうしたらいいか分かりません。');
    await pageR.click('#send-button');
    await waitForStreamingDone(pageR);
    const lastAi = await pageR.locator('.message-ai:not(.message-welcome)').last().innerText().catch(() => '');
    const hasEmpathy = /つらい|つらく|気持ち|受け止め|寄り添|わかり|分かり|大切に|一緒に/.test(lastAi);
    if (hasEmpathy) {
      record('R4', '気分トーン調整（Sprint 6 Feature 15 / DB経由）', 10,
        `empathy words detected (${lastAi.length} chars)`, 'regression');
    } else {
      record('R4', '気分トーン調整（Sprint 6 Feature 15 / DB経由）', 5,
        `no clear empathy markers`, 'regression');
    }
  } else {
    record('R4', '気分トーン調整（Sprint 6 Feature 15 / DB経由）', 3,
      'no emotion selector', 'regression');
  }

  // R5: サマリカード
  await pageR.click('#new-consultation-button');
  await pageR.waitForTimeout(500);
  const sumMod = await pageR.locator('#summary-modal').isVisible().catch(() => false);
  const sumOpen = await pageR.locator('#summary-modal.is-open').count();
  if (sumMod || sumOpen > 0) {
    record('R5', 'サマリカード表示（Sprint 6 Feature 16）', 10,
      `summary modal open on click`, 'regression');
    const closeB = pageR.locator('.summary-close-button, button:has-text("閉じる")');
    if (await closeB.count() > 0) await closeB.first().click();
  } else {
    record('R5', 'サマリカード表示（Sprint 6 Feature 16）', 2,
      `modal did not open`, 'regression');
  }

  // R6: 文字数カウンタ + Enter送信
  await pageR.fill('#message-input', 'テスト文字列');
  const charText = await pageR.locator('#char-count').textContent().catch(() => '');
  const hasCharCount = /6\s*\/\s*1000/.test(charText);
  await pageR.fill('#message-input', 'Enterで送信されるテスト');
  await pageR.locator('#message-input').press('Enter');
  await pageR.waitForTimeout(500);
  const inputAfter = await pageR.locator('#message-input').inputValue().catch(() => 'err');
  const enterSent = inputAfter === '';
  if (hasCharCount && enterSent) {
    record('R6', '文字数カウンタ + Enter送信', 10, `char=${charText}, enter sent`, 'regression');
    await waitForStreamingDone(pageR, 30000);
  } else {
    record('R6', '文字数カウンタ + Enter送信',
      (hasCharCount || enterSent) ? 6 : 2,
      `char=${charText}, enterSent=${enterSent}`, 'regression');
  }

  // R7: コンソールエラー
  const nonFavErrs = consoleErrors.filter(e => !/favicon/.test(e));
  if (nonFavErrs.length === 0) {
    record('R7', 'コンソールエラー0件（favicon除く）', 10, 'none', 'regression');
  } else {
    record('R7', 'コンソールエラー0件（favicon除く）',
      nonFavErrs.length < 3 ? 6 : 2,
      `${nonFavErrs.length} errors: ${nonFavErrs.slice(0,3).join(' / ')}`, 'regression');
  }

  // ===================================================
  // A11y
  // ===================================================
  log('=== A11y ===');

  // 絵文字セレクタ Tab/Enter 操作
  // 現在 R6 の送信が完了して絵文字セレクタが出ている
  const a11yEmC = await pageR.locator('.emotion-selector').count();
  if (a11yEmC > 0) {
    const firstEmBtn = pageR.locator('.emotion-selector .emotion-button').first();
    await firstEmBtn.focus();
    const focused = await pageR.evaluate(() =>
      document.activeElement && document.activeElement.classList.contains('emotion-button'));
    await firstEmBtn.press('Enter');
    await pageR.waitForTimeout(600);
    const activeEnter = await pageR.locator('.emotion-button.active').count();
    const ariaE = await pageR.locator('.emotion-button[aria-pressed="true"]').count();
    if (focused && (activeEnter > 0 || ariaE > 0)) {
      record('A11y-1', '絵文字セレクタが Tab+Enter で操作可能', 10,
        `focused=${focused}, activeAfterEnter=${activeEnter}, aria=${ariaE}`, 'a11y');
    } else {
      record('A11y-1', '絵文字セレクタが Tab+Enter で操作可能',
        focused ? 5 : 2,
        `focused=${focused}, active=${activeEnter}, aria=${ariaE}`, 'a11y');
    }
  } else {
    record('A11y-1', '絵文字セレクタが Tab+Enter で操作可能', 2, 'no selector', 'a11y');
  }
  await contextR.close();

  // オンボのキーボード操作
  const a11yCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const a11yPage = await a11yCtx.newPage();
  await a11yPage.goto(BASE);
  await a11yPage.waitForTimeout(1000);
  const obInputCount = await a11yPage.locator('#onboarding-name-input').count();
  if (obInputCount > 0) {
    const isAutoFocused = await a11yPage.evaluate(() =>
      document.activeElement && document.activeElement.id === 'onboarding-name-input');
    await a11yPage.fill('#onboarding-name-input', 'キーボード太郎');
    await a11yPage.locator('#onboarding-name-input').press('Enter');
    await a11yPage.waitForTimeout(2000);
    const uuidAE = await a11yPage.evaluate(() => localStorage.getItem('consultationApp.userUuid'));
    if (isAutoFocused && uuidAE) {
      record('A11y-2', 'オンボがキーボードで操作可能', 10,
        `autofocus, Enter submitted`, 'a11y');
    } else {
      record('A11y-2', 'オンボがキーボードで操作可能',
        uuidAE ? 7 : 3, `autofocus=${isAutoFocused}, submitted=${!!uuidAE}`, 'a11y');
    }
  } else {
    record('A11y-2', 'オンボがキーボードで操作可能', 2, 'no input', 'a11y');
  }
  await a11yCtx.close();

  await browser.close();

  // ======= Summary =======
  const summary = {
    results,
    bugs,
    consoleErrors,
    avg: (results.reduce((a, r) => a + r.score, 0) / results.length).toFixed(2),
    min: Math.min(...results.map(r => r.score)),
  };
  const p0Ids = ['F18-1','F18-2','F18-3','F18-4','F18-5','F18-6','F18-7',
    'F19-1','F19-2','F19-3','F19-4','F19-5',
    'R1','R2','R3','R4','R5','R6','R7'];
  const p0R = results.filter(r => p0Ids.includes(r.id));
  summary.p0Avg = (p0R.reduce((a, r) => a + r.score, 0) / p0R.length).toFixed(2);
  summary.p0Min = Math.min(...p0R.map(r => r.score));

  fs.writeFileSync('.evaluator_tmp/sprint7-results-v2.json',
    JSON.stringify(summary, null, 2), 'utf-8');

  console.log('\n===== Summary =====');
  console.log(`Total: ${results.length}`);
  console.log(`Avg: ${summary.avg}`);
  console.log(`Min: ${summary.min}`);
  console.log(`P0 avg: ${summary.p0Avg}`);
  console.log(`P0 min: ${summary.p0Min}`);
  console.log(`Bugs: ${bugs.length}`);
  console.log(`Console errors: ${consoleErrors.length}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  fs.writeFileSync('.evaluator_tmp/sprint7-fatal-v2.txt',
    `${err.stack || err.message}`, 'utf-8');
  process.exit(1);
});
