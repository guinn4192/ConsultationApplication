// Sprint 7 UI test harness using Playwright MCP-equivalent direct Playwright.
// Usage: node .evaluator_tmp/test-sprint7.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';
const DB_PATH = path.resolve('data/app.db');
const results = [];
const bugs = [];
const consoleErrors = [];

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
function record(id, title, score, detail) {
  results.push({ id, title, score, detail });
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

async function waitForSelector(page, selector, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const visible = await page.locator(selector).isVisible().catch(() => false);
    if (visible) return true;
    await page.waitForTimeout(200);
  }
  return false;
}

async function sendConsult(page, text) {
  await page.fill('#message-input', text);
  await page.click('#send-button');
  return await waitForStreamingDone(page);
}

async function queryDb(sql, params = []) {
  // Use the server's API or a helper: use node:sqlite via a child process since the app is using node:sqlite
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

async function main() {
  const browser = await chromium.launch({ headless: true });

  // =============================================================
  // FEATURE 18: オンボーディング + UUID
  // =============================================================
  log('=== Feature 18: Onboarding + UUID ===');

  let context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!/favicon/.test(t)) consoleErrors.push(`[${Date.now()}] ${t}`);
    }
  });
  page.on('pageerror', err => { consoleErrors.push(`pageerror: ${err.message}`); });

  // F18-1: 初回アクセスでオンボーディング画面が表示される
  await page.goto(BASE);
  await page.waitForTimeout(800);
  const hash1 = await page.evaluate(() => location.hash);
  const onboardingVisible = await page.locator('#onboarding-screen').isVisible().catch(() => false);
  const chatHidden = await page.evaluate(() => document.getElementById('chat-container').hidden);
  const hasNameInput = await page.locator('#onboarding-name-input').count() > 0;
  const hasSubmit = await page.locator('.onboarding-submit').count() > 0;
  if (hash1 === '#/onboarding' && onboardingVisible && chatHidden && hasNameInput && hasSubmit) {
    record('F18-1', '初回アクセスでオンボーディング画面が表示される', 10,
      `hash=${hash1}, onboarding visible, chat hidden, nameInput + submitButton present`);
  } else {
    record('F18-1', '初回アクセスでオンボーディング画面が表示される',
      (onboardingVisible && hasNameInput) ? 7 : 3,
      `hash=${hash1}, visible=${onboardingVisible}, chatHidden=${chatHidden}, inputExists=${hasNameInput}`);
  }

  // F18-2: 空欄送信 → エラー表示、画面遷移なし
  await page.click('.onboarding-submit');
  await page.waitForTimeout(500);
  const errorVisibleAfterEmpty = await page.locator('#onboarding-error').isVisible().catch(() => false);
  const errorText = await page.locator('#onboarding-error').textContent().catch(() => '');
  const stillOnboarding = await page.evaluate(() => location.hash) === '#/onboarding';
  const stillNoUuid = await page.evaluate(() => !localStorage.getItem('consultationApp.userUuid'));
  if (errorVisibleAfterEmpty && stillOnboarding && stillNoUuid) {
    record('F18-2', '空欄確定でエラー表示 + 画面遷移なし', 10,
      `error="${errorText}", still on onboarding, no uuid saved`);
  } else {
    record('F18-2', '空欄確定でエラー表示 + 画面遷移なし', 4,
      `errorVisible=${errorVisibleAfterEmpty}, stillOnboarding=${stillOnboarding}, noUuid=${stillNoUuid}`);
  }

  // F18-3: 有効な名前 → UUID発行 → localStorage保存 → 相談画面へ
  await page.fill('#onboarding-name-input', 'テスト太郎');
  await page.click('.onboarding-submit');
  await page.waitForTimeout(2000);

  const uuidStored = await page.evaluate(() => localStorage.getItem('consultationApp.userUuid'));
  const nameStored = await page.evaluate(() => localStorage.getItem('consultationApp.userName'));
  const hash2 = await page.evaluate(() => location.hash);
  const chatVisible = await page.evaluate(() => !document.getElementById('chat-container').hidden);
  const uuidValid = uuidStored && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuidStored);
  if (uuidValid && nameStored === 'テスト太郎' && (hash2 === '#/' || hash2 === '#') && chatVisible) {
    record('F18-3', 'ユーザー名登録でUUID発行・localStorage保存・相談画面遷移', 10,
      `uuid=${uuidStored.slice(0,8)}..., name=${nameStored}, hash=${hash2}`);
  } else {
    record('F18-3', 'ユーザー名登録でUUID発行・localStorage保存・相談画面遷移',
      (uuidValid && nameStored) ? 6 : 2,
      `uuidValid=${!!uuidValid}, name=${nameStored}, hash=${hash2}, chatVisible=${chatVisible}`);
  }

  // F18-4: ヘッダにユーザー名表示
  const headerName = await page.locator('#header-user-name').textContent().catch(() => '');
  const headerNameVisible = await page.locator('#header-user-name').isVisible().catch(() => false);
  if (headerNameVisible && headerName.includes('テスト太郎')) {
    record('F18-4', 'ヘッダにユーザー名が表示される', 10, `headerText="${headerName}"`);
  } else {
    record('F18-4', 'ヘッダにユーザー名が表示される', headerNameVisible ? 6 : 2,
      `visible=${headerNameVisible}, text="${headerName}"`);
  }

  // F18-5: リロードでオンボーディングスキップ・同ユーザー名維持
  await page.reload();
  await page.waitForTimeout(2000); // bootstrap
  const hash3 = await page.evaluate(() => location.hash);
  const onboardingVisibleAfterReload = await page.locator('#onboarding-screen').isVisible().catch(() => false);
  const uuidAfterReload = await page.evaluate(() => localStorage.getItem('consultationApp.userUuid'));
  const headerNameAfterReload = await page.locator('#header-user-name').textContent().catch(() => '');
  if (!onboardingVisibleAfterReload && uuidAfterReload === uuidStored && headerNameAfterReload.includes('テスト太郎')) {
    record('F18-5', 'リロード時オンボスキップ・同ユーザー名維持', 10,
      `hash=${hash3}, onboarding hidden, uuid preserved, header="${headerNameAfterReload}"`);
  } else {
    record('F18-5', 'リロード時オンボスキップ・同ユーザー名維持',
      uuidAfterReload === uuidStored ? 6 : 2,
      `onboardingVisible=${onboardingVisibleAfterReload}, uuid preserved=${uuidAfterReload === uuidStored}, header="${headerNameAfterReload}"`);
  }

  // F18-6: localStorage キー名
  const keys = await page.evaluate(() => Object.keys(localStorage));
  const hasUuidKey = keys.includes('consultationApp.userUuid');
  const hasNameKey = keys.includes('consultationApp.userName');
  if (hasUuidKey && hasNameKey) {
    record('F18-6', 'localStorageキー名が規約どおり', 10, `keys=${JSON.stringify(keys)}`);
  } else {
    record('F18-6', 'localStorageキー名が規約どおり', 3, `keys=${JSON.stringify(keys)}`);
  }

  // F18-7: 匿名識別のみ - パスワード/メール/電話入力欄が存在しない
  // オンボーディング画面・相談画面両方で確認
  await page.goto(BASE); // already post-onboarding
  await page.waitForTimeout(800);
  const authInputs = await page.evaluate(() => {
    const selectors = [
      'input[type="password"]',
      'input[type="email"]',
      'input[type="tel"]',
      'input[name*="password" i]',
      'input[name*="email" i]',
      'input[name*="phone" i]',
    ];
    const found = [];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(el => found.push(sel));
    }
    return found;
  });
  if (authInputs.length === 0) {
    record('F18-7', 'パスワード/メール/電話入力欄が一切存在しない', 10, 'no auth inputs found');
  } else {
    record('F18-7', 'パスワード/メール/電話入力欄が一切存在しない', 2, `found: ${authInputs.join(',')}`);
  }

  // DBに保存されたUUIDを確認
  try {
    const users = await queryDb('SELECT * FROM users');
    const userInDb = users.find(u => u.uuid === uuidStored);
    if (userInDb && userInDb.user_name === 'テスト太郎') {
      log(`  DB users: ${users.length} rows, target user found`);
    } else {
      bug('DB に users 行が保存されていない',
        'ユーザー名「テスト太郎」でオンボ完了後、DB users テーブルを確認',
        'uuid + user_name が INSERT されている',
        `uuid found=${!!userInDb}, user_name=${userInDb && userInDb.user_name}`,
        'High');
    }
  } catch (err) {
    log(`  queryDb users failed: ${err.message}`);
  }

  // =============================================================
  // FEATURE 19: DB永続化
  // =============================================================
  log('=== Feature 19: DB persistence ===');

  // F19-1: 相談送信 → DBのmessagesテーブルにuser+assistant保存
  // まずモード「共感」・カテゴリ「日常生活」を選択して送信
  await page.click('.mode-button[data-mode="empathy"]');
  await page.click('.category-button[data-category="日常生活"]');
  await page.waitForTimeout(300);
  const sendOK = await sendConsult(page, '最近よく眠れなくて、日常の些細なことに悩んでしまいます。');
  if (!sendOK) {
    record('F19-1', '相談送信後messagesにuser+assistant保存', 0, 'streaming did not complete');
  } else {
    await page.waitForTimeout(500); // DB書き込み反映待ち
    try {
      const messages = await queryDb("SELECT * FROM messages ORDER BY created_at ASC");
      const userMsgs = messages.filter(m => m.role === 'user');
      const assistantMsgs = messages.filter(m => m.role === 'assistant');
      const hasUserContent = userMsgs.some(m => m.content.includes('眠れなく'));
      const hasAssistant = assistantMsgs.length > 0;
      if (hasUserContent && hasAssistant) {
        record('F19-1', '相談送信後messagesにuser+assistant保存', 10,
          `user=${userMsgs.length} rows, assistant=${assistantMsgs.length} rows`);
      } else {
        record('F19-1', '相談送信後messagesにuser+assistant保存',
          userMsgs.length > 0 ? 5 : 1,
          `user=${userMsgs.length}, assistant=${assistantMsgs.length}, content match=${hasUserContent}`);
      }
    } catch (err) {
      record('F19-1', '相談送信後messagesにuser+assistant保存', 1, `queryDb failed: ${err.message}`);
    }
  }

  // F19-3: messages.mode/category が正しく保存されている
  try {
    const userMsgWithModeCategory = await queryDb(
      "SELECT * FROM messages WHERE role='user' AND content LIKE '%眠れなく%'"
    );
    if (userMsgWithModeCategory.length > 0) {
      const m = userMsgWithModeCategory[0];
      if (m.mode === 'empathy' && m.category === '日常生活') {
        record('F19-3', 'messagesにmode=共感/category=日常生活が保存', 10,
          `mode=${m.mode}, category=${m.category}`);
      } else {
        record('F19-3', 'messagesにmode=共感/category=日常生活が保存',
          (m.mode || m.category) ? 5 : 1,
          `mode=${m.mode}, category=${m.category}`);
      }
    } else {
      record('F19-3', 'messagesにmode=共感/category=日常生活が保存', 1, 'user message not found in DB');
    }
  } catch (err) {
    record('F19-3', 'messagesにmode=共感/category=日常生活が保存', 1, `queryDb failed: ${err.message}`);
  }

  // F19-2: 絵文字クリック → DBのemotion_recordsに保存・message_id紐付け
  // 最新 assistant メッセージ下の絵文字セレクタでクリック
  const emotionSelectorCount = await page.locator('.emotion-selector').count();
  log(`  emotion-selector count: ${emotionSelectorCount}`);
  if (emotionSelectorCount > 0) {
    // 4番目の絵文字（🙂）を選択
    const firstSelector = page.locator('.emotion-selector').first();
    const button4 = firstSelector.locator('.emotion-button').nth(3); // 0=😢 1=😟 2=😐 3=🙂 4=😊
    await button4.click();
    await page.waitForTimeout(1200); // API呼び出し反映待ち
    try {
      const emotions = await queryDb("SELECT * FROM emotion_records ORDER BY created_at ASC");
      if (emotions.length > 0 && emotions[emotions.length - 1].emoji_value === 4) {
        const hasMsgId = emotions[emotions.length - 1].message_id !== null;
        if (hasMsgId) {
          record('F19-2', '絵文字クリックでemotion_records保存+message_id紐付け', 10,
            `emotions=${emotions.length}, last emoji_value=${emotions[emotions.length - 1].emoji_value}, message_id=${emotions[emotions.length - 1].message_id.slice(0,8)}...`);
        } else {
          record('F19-2', '絵文字クリックでemotion_records保存+message_id紐付け', 6,
            `emotions saved but message_id is null`);
        }
      } else {
        record('F19-2', '絵文字クリックでemotion_records保存+message_id紐付け', 2,
          `emotions=${emotions.length}, last value=${emotions[emotions.length - 1]?.emoji_value}`);
      }
    } catch (err) {
      record('F19-2', '絵文字クリックでemotion_records保存+message_id紐付け', 1,
        `queryDb failed: ${err.message}`);
    }
  } else {
    record('F19-2', '絵文字クリックでemotion_records保存+message_id紐付け', 0,
      'no emotion selector appeared');
  }

  // F19-4: ブラウザを完全に閉じて再アクセス → 同じUUID・DBに前回データ
  const userUuidBeforeClose = uuidStored;
  const sessionIdBeforeClose = await page.evaluate(() =>
    window.localStorage.getItem('consultationApp.userUuid'));

  // ストレージ状態を保存してコンテキストを再作成（完全にブラウザを閉じた相当）
  const storageState = await context.storageState();
  await context.close();

  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState });
  page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!/favicon/.test(t)) consoleErrors.push(`[${Date.now()}] ${t}`);
    }
  });
  page.on('pageerror', err => { consoleErrors.push(`pageerror: ${err.message}`); });

  await page.goto(BASE);
  await page.waitForTimeout(3000);
  // 再開モーダルが出現するのを待つ（最大 10s）
  await waitForSelector(page, '#resume-modal.is-open', 10000);
  const reopenUuid = await page.evaluate(() => localStorage.getItem('consultationApp.userUuid'));
  const apiHistoryCheck = await page.evaluate(async () => {
    const uuid = localStorage.getItem('consultationApp.userUuid');
    const res = await fetch('/api/history', { headers: { 'x-user-uuid': uuid } });
    if (!res.ok) return { error: res.status };
    const data = await res.json();
    return { sessionsCount: data.sessions ? data.sessions.length : 0 };
  });
  if (reopenUuid === userUuidBeforeClose && apiHistoryCheck.sessionsCount >= 1) {
    record('F19-4', 'ブラウザ再起動後 同UUID認識+DB前回データ残存', 10,
      `uuid preserved, /api/history sessions=${apiHistoryCheck.sessionsCount}`);
  } else {
    record('F19-4', 'ブラウザ再起動後 同UUID認識+DB前回データ残存',
      reopenUuid === userUuidBeforeClose ? 4 : 1,
      `uuid preserved=${reopenUuid === userUuidBeforeClose}, history=${JSON.stringify(apiHistoryCheck)}`);
  }

  // Note: 再開モーダルが表示される可能性が高いのでテストの後回し
  // いったん dismissして新しく始める方を選択しておく（F21側で再開フローを精密にテスト）
  const resumeModalVisible = await page.locator('#resume-modal').isVisible().catch(() => false);
  if (resumeModalVisible) {
    log('  resume modal visible on F19-4, will use in F21-1');
  }

  // F19-5: 別ブラウザ（別コンテキスト）でIncognito相当 - 別ユーザー名登録
  const context2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page2 = await context2.newPage();
  page2.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!/favicon/.test(t)) consoleErrors.push(`[ctx2] ${t}`);
    }
  });
  await page2.goto(BASE);
  await page2.waitForTimeout(800);
  const ob2Visible = await page2.locator('#onboarding-screen').isVisible().catch(() => false);
  if (!ob2Visible) {
    record('F19-5', '別コンテキストで別UUID+前ユーザーのデータ不可視', 2, 'onboarding not shown on fresh context');
  } else {
    await page2.fill('#onboarding-name-input', '花子');
    await page2.click('.onboarding-submit');
    await page2.waitForTimeout(2500);
    const uuid2 = await page2.evaluate(() => localStorage.getItem('consultationApp.userUuid'));
    const historyCheck2 = await page2.evaluate(async () => {
      const uuid = localStorage.getItem('consultationApp.userUuid');
      const res = await fetch('/api/history', { headers: { 'x-user-uuid': uuid } });
      if (!res.ok) return { error: res.status };
      const data = await res.json();
      return { sessionsCount: data.sessions ? data.sessions.length : 0 };
    });
    if (uuid2 && uuid2 !== userUuidBeforeClose && historyCheck2.sessionsCount === 0) {
      record('F19-5', '別コンテキストで別UUID+前ユーザーのデータ不可視', 10,
        `uuid2=${uuid2.slice(0,8)}..., sessionsForUser2=${historyCheck2.sessionsCount}`);
    } else {
      record('F19-5', '別コンテキストで別UUID+前ユーザーのデータ不可視',
        uuid2 !== userUuidBeforeClose ? 5 : 1,
        `uuid2 differs=${uuid2 !== userUuidBeforeClose}, sessionsCount=${historyCheck2.sessionsCount}`);
    }
  }
  await context2.close();

  // =============================================================
  // FEATURE 21: 再開プロンプト（一部、F19-4の流れを活用）
  // =============================================================
  log('=== Feature 21: Resume modal ===');

  // 直前の F19-4 で resume modal が出ている状態（context再作成+reload相当）
  // F21-1: 再開モーダル表示確認
  const modalStillVisible = await page.locator('#resume-modal').isVisible().catch(() => false);
  const modalHasResumeBtn = await page.locator('.resume-button-resume').count() > 0;
  const modalHasFreshBtn = await page.locator('.resume-button-fresh').count() > 0;
  if (modalStillVisible && modalHasResumeBtn && modalHasFreshBtn) {
    record('F21-1', '相談送信→リロードで再開モーダル表示', 10,
      `modal visible, resume+fresh buttons present`);
  } else {
    record('F21-1', '相談送信→リロードで再開モーダル表示', 2,
      `visible=${modalStillVisible}, resumeBtn=${modalHasResumeBtn}, freshBtn=${modalHasFreshBtn}`);
  }

  // F21-2: 2ボタン明示
  const resumeBtnText = await page.locator('.resume-button-resume').textContent().catch(() => '');
  const freshBtnText = await page.locator('.resume-button-fresh').textContent().catch(() => '');
  if (resumeBtnText.includes('続き') && freshBtnText.includes('新し')) {
    record('F21-2', 'モーダルに「続きから」「新しく始める」2ボタン', 10,
      `resume="${resumeBtnText}", fresh="${freshBtnText}"`);
  } else {
    record('F21-2', 'モーダルに「続きから」「新しく始める」2ボタン', 4,
      `resume="${resumeBtnText}", fresh="${freshBtnText}"`);
  }

  // F21-3 + F21-4: 「続きから」押下 → 前発言が即時表示 + 絵文字active復元
  const messagesBefore = await page.locator('.message:not(.message-welcome)').count();
  await page.click('.resume-button-resume');
  await page.waitForTimeout(1500);
  const modalAfterResume = await page.locator('#resume-modal').isVisible().catch(() => false);
  const messagesAfter = await page.locator('.message:not(.message-welcome)').count();
  const streamingDuringRestore = await page.locator('.message-streaming').count();
  if (messagesAfter >= 2 && !modalAfterResume && streamingDuringRestore === 0) {
    record('F21-3', '「続きから」で前発言が即時表示（ストリーミングなし）', 10,
      `messages: ${messagesBefore}→${messagesAfter}, modal dismissed, no streaming element`);
  } else {
    record('F21-3', '「続きから」で前発言が即時表示（ストリーミングなし）',
      messagesAfter >= 2 ? 5 : 1,
      `messagesAfter=${messagesAfter}, modalClosed=${!modalAfterResume}, streamingEls=${streamingDuringRestore}`);
  }

  // F21-4: 絵文字.active復元
  const activeEmoji = await page.locator('.emotion-button.active').count();
  const ariaPressedCount = await page.locator('.emotion-button[aria-pressed="true"]').count();
  if (activeEmoji >= 1 || ariaPressedCount >= 1) {
    record('F21-4', '感情記録の.active状態が復元される', 10,
      `active buttons=${activeEmoji}, aria-pressed=true=${ariaPressedCount}`);
  } else {
    record('F21-4', '感情記録の.active状態が復元される', 3,
      `no active emoji restored (activeCount=${activeEmoji}, aria=${ariaPressedCount})`);
  }

  // F21-5: 再開後に新しい相談 → 同じsessionIdで追記
  let sessionIdBeforeSend = null;
  try {
    const sessions = await queryDb("SELECT * FROM sessions ORDER BY started_at DESC LIMIT 5");
    sessionIdBeforeSend = sessions.find(s => s.user_uuid === userUuidBeforeClose && !s.closed_at)?.id;
  } catch (err) { log(`queryDb sessions failed: ${err.message}`); }

  const messagesBeforeF215 = await queryDb(
    "SELECT COUNT(*) as n FROM messages WHERE session_id = ?", [sessionIdBeforeSend]).catch(() => [{ n: 0 }]);
  const mBefore = messagesBeforeF215[0].n;

  const sentOK = await sendConsult(page, 'さっきの続きで、もう少し相談させてください。');
  if (!sentOK) {
    record('F21-5', '再開後の相談は同sessionIdに追記', 1, 'streaming failed');
  } else {
    await page.waitForTimeout(800);
    try {
      const messagesAfterF215 = await queryDb(
        "SELECT COUNT(*) as n FROM messages WHERE session_id = ?", [sessionIdBeforeSend]);
      const mAfter = messagesAfterF215[0].n;
      // +2: user + assistant
      if (mAfter >= mBefore + 2 && sessionIdBeforeSend) {
        record('F21-5', '再開後の相談は同sessionIdに追記', 10,
          `sessionId=${sessionIdBeforeSend.slice(0,8)}..., messages: ${mBefore}→${mAfter}`);
      } else {
        record('F21-5', '再開後の相談は同sessionIdに追記',
          mAfter > mBefore ? 5 : 1,
          `session=${sessionIdBeforeSend}, before=${mBefore}, after=${mAfter}`);
      }
    } catch (err) {
      record('F21-5', '再開後の相談は同sessionIdに追記', 1, `queryDb failed: ${err.message}`);
    }
  }

  // ===== F21-6: 別シナリオ - 新しく始める押下 → 新規セッション =====
  // いったん現セッションを close して（または別シナリオ相当に）新規相談を送り、未close状態を作る
  // 現在のセッションは F21-5 送信で未close状態 → storageState保存→再作成→リロードで再度モーダル
  const storageStateF21_6 = await context.storageState();
  await context.close();
  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: storageStateF21_6 });
  page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!/favicon/.test(t)) consoleErrors.push(`[f21-6] ${t}`);
    }
  });
  await page.goto(BASE);
  await page.waitForTimeout(2500);
  const modalVisibleForFresh = await page.locator('#resume-modal').isVisible().catch(() => false);
  const sessionBeforeFresh = sessionIdBeforeSend;
  if (!modalVisibleForFresh) {
    record('F21-6', '「新しく始める」で前セッションclose+新規相談画面', 2,
      'modal not shown before fresh-click test');
  } else {
    await page.click('.resume-button-fresh');
    await page.waitForTimeout(1500);
    const modalAfterFresh = await page.locator('#resume-modal').isVisible().catch(() => false);
    const messagesAfterFresh = await page.locator('.message:not(.message-welcome)').count();
    // DBで前セッションのclosed_atが埋まったか確認
    try {
      const sessionsAfterFresh = await queryDb("SELECT * FROM sessions WHERE id=?", [sessionBeforeFresh]);
      const closedAt = sessionsAfterFresh[0]?.closed_at;
      if (!modalAfterFresh && messagesAfterFresh === 0 && closedAt) {
        record('F21-6', '「新しく始める」で前セッションclose+新規相談画面', 10,
          `closed_at=${closedAt}, modal dismissed, chat cleared`);
      } else {
        record('F21-6', '「新しく始める」で前セッションclose+新規相談画面',
          (!modalAfterFresh && closedAt) ? 7 : 4,
          `modalClosed=${!modalAfterFresh}, msgs=${messagesAfterFresh}, closed_at=${closedAt}`);
      }
    } catch (err) {
      record('F21-6', '「新しく始める」で前セッションclose+新規相談画面', 2,
        `queryDb failed: ${err.message}`);
    }
  }

  // F21-7: 初回訪問時は再開モーダル非表示
  const context3 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page3 = await context3.newPage();
  await page3.goto(BASE);
  await page3.waitForTimeout(1500);
  const resumeModal3 = await page3.locator('#resume-modal').isVisible().catch(() => false);
  const onboard3 = await page3.locator('#onboarding-screen').isVisible().catch(() => false);
  if (!resumeModal3 && onboard3) {
    record('F21-7', '初回訪問時は再開モーダル非表示（オンボ優先）', 10,
      `onboarding shown, no resume modal`);
  } else {
    record('F21-7', '初回訪問時は再開モーダル非表示（オンボ優先）', 3,
      `resumeModal=${resumeModal3}, onboard=${onboard3}`);
  }
  await context3.close();

  // F21-8: 前日以前の未closeセッションは候補に出ない（当日判定）
  // DBに手動で古いセッションを追加 → リロードしてモーダル出ないことを確認
  const yesterdayIso = new Date(Date.now() - 24*60*60*1000).toISOString();
  const testSessionId = 'test-yesterday-' + Date.now();
  try {
    // まず前の全セッションを全close
    await queryDb(
      "UPDATE sessions SET closed_at=datetime('now') WHERE user_uuid=? AND closed_at IS NULL",
      [userUuidBeforeClose]
    );
    // 昨日のstarted_atで未closeセッション INSERT
    await queryDb(
      "INSERT INTO sessions (id, user_uuid, started_at, closed_at) VALUES (?, ?, ?, NULL)",
      [testSessionId, userUuidBeforeClose, yesterdayIso]
    );
    // messages も1件入れておく（APIが messages 0件セッションをresumable返却するか確認のため、1件入れる）
    const testMsgId = 'test-msg-' + Date.now();
    await queryDb(
      "INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, 'user', '昨日の相談', ?)",
      [testMsgId, testSessionId, yesterdayIso]
    );
  } catch (err) {
    log(`F21-8 DB prep failed: ${err.message}`);
  }

  // リロードしてモーダル出ないことを確認
  await page.goto(BASE);
  await page.waitForTimeout(2500);
  const modalVisibleAfterYest = await page.locator('#resume-modal').isVisible().catch(() => false);
  // F21-8判定：昨日のsession は server起動時のorphan closeで既に閉じられている可能性が高い
  // リロード後は別のセッションを渡らない（当日判定）
  try {
    const yestSession = await queryDb("SELECT * FROM sessions WHERE id=?", [testSessionId]);
    const isClosedByApp = yestSession[0]?.closed_at !== null;
    // モーダルが出なければOK。DB上 closed にされているかは副次的に確認
    if (!modalVisibleAfterYest) {
      record('F21-8', '前日以前の未closeセッションは候補にならない', 10,
        `modal not shown, yesterday session closed_at=${yestSession[0]?.closed_at}`);
    } else {
      record('F21-8', '前日以前の未closeセッションは候補にならない', 2,
        `modal shown unexpectedly for yesterday session, closed_at=${yestSession[0]?.closed_at}`);
    }
  } catch (err) {
    record('F21-8', '前日以前の未closeセッションは候補にならない', 5, `DB check failed: ${err.message}`);
  }

  // =============================================================
  // FEATURE 20: 履歴画面
  // =============================================================
  log('=== Feature 20: History screen ===');

  // F20-1の準備：当日のセッションを2つ以上作る（今は空状態なので新規1件分送信）
  // 現在 page は F21-8 の状態（新規セッションなし）。ウェルカムメッセージが出ている。
  await page.waitForTimeout(500);
  const welcomeShown = await page.locator('#welcome-message, .message-welcome').count();
  log(`  current welcome count: ${welcomeShown}`);

  // 新規相談を送信 → 第一セッション
  await page.click('.mode-button[data-mode="default"]');
  // カテゴリは未選択に戻す
  const categoryActive = await page.locator('.category-button.active').count();
  if (categoryActive > 0) {
    await page.locator('.category-button.active').first().click();
  }
  const s1 = await sendConsult(page, '履歴テスト用: 最初のセッションの相談です。');
  // 絵文字も記録
  if (s1) {
    const sel = page.locator('.emotion-selector').first();
    const cnt = await sel.count();
    if (cnt > 0) {
      await sel.locator('.emotion-button').nth(1).click(); // 😟
      await page.waitForTimeout(600);
    }
  }
  // 新しい相談ボタン→サマリ→リセット
  await page.click('#new-consultation-button');
  await page.waitForTimeout(500);
  const summaryModalVis = await page.locator('#summary-modal').isVisible().catch(() => false);
  if (summaryModalVis) {
    await page.click('.summary-reset-button');
    await page.waitForTimeout(1000);
  }

  // 第二セッション
  const s2 = await sendConsult(page, '履歴テスト用: 2つめのセッションの相談です。');
  if (s2) {
    const sel = page.locator('.emotion-selector').first();
    const cnt = await sel.count();
    if (cnt > 0) {
      await sel.locator('.emotion-button').nth(3).click(); // 🙂
      await page.waitForTimeout(600);
    }
  }

  // F20-1: ヘッダの「過去の相談履歴」押下 → #/history
  const historyLinkVisible = await page.locator('#header-history-link').isVisible().catch(() => false);
  if (!historyLinkVisible) {
    record('F20-1', '履歴リンク押下で#/historyへ遷移', 2, 'history link hidden');
  } else {
    await page.click('#header-history-link');
    await page.waitForTimeout(1500);
    const hashHistory = await page.evaluate(() => location.hash);
    const historyVisible = await page.locator('#history-screen').isVisible().catch(() => false);
    if (hashHistory === '#/history' && historyVisible) {
      record('F20-1', '履歴リンク押下で#/historyへ遷移', 10,
        `hash=${hashHistory}, history screen visible`);
    } else {
      record('F20-1', '履歴リンク押下で#/historyへ遷移', 4,
        `hash=${hashHistory}, visible=${historyVisible}`);
    }
  }

  // F20-2: 日付別セッション一覧（新しい順、日付+冒頭テキスト）
  const historyBody = await page.locator('#history-screen').innerHTML().catch(() => '');
  const hasDateHeader = /日|\d{4}|\d{1,2}月|\d{1,2}\/|\d{4}-\d{2}-\d{2}|本日|今日/i.test(historyBody);
  const sessionItemCount = await page.locator('#history-screen .history-session-item, #history-screen [data-session-id], #history-screen button[class*="session"], #history-screen li').count();
  // preview text（履歴テスト用)が表示されるか
  const showsPreview = historyBody.includes('履歴テスト用');
  if (hasDateHeader && sessionItemCount >= 2 && showsPreview) {
    record('F20-2', '日付別セッション一覧・新しい順・冒頭テキスト表示', 10,
      `date header found, sessions=${sessionItemCount}, preview shown`);
  } else {
    // もう少し緩やかにチェック
    const sessionGenericCount = await page.locator('#history-screen').evaluate(el => {
      // どれぐらいのセッション項目があるか見る
      const items = el.querySelectorAll('button, a, li, .history-item, [data-session-id]');
      return items.length;
    });
    record('F20-2', '日付別セッション一覧・新しい順・冒頭テキスト表示',
      (sessionItemCount >= 2 || sessionGenericCount >= 2) ? 6 :
      (showsPreview ? 5 : 3),
      `dateHeader=${hasDateHeader}, specific sessionItems=${sessionItemCount}, generic=${sessionGenericCount}, preview=${showsPreview}`);
  }

  // F20-3: セッションクリックで詳細遷移
  // まず実際のセッション要素を探してクリック
  let detailOK = false;
  const candidates = ['button[data-session-id]', '[data-session-id]', '.history-session-item', '.history-item'];
  let clickedSel = null;
  for (const c of candidates) {
    const cnt = await page.locator(c).count();
    if (cnt > 0) {
      await page.locator(c).first().click();
      clickedSel = c;
      await page.waitForTimeout(1500);
      detailOK = true;
      break;
    }
  }
  const hashAfterClick = await page.evaluate(() => location.hash);
  const hasDetailRoute = /^#\/history\/[^\/]+$/.test(hashAfterClick);
  const historyScreenVisible = await page.locator('#history-screen').isVisible().catch(() => false);
  if (detailOK && hasDetailRoute && historyScreenVisible) {
    record('F20-3', 'セッションクリックで#/history/:id詳細遷移', 10,
      `clicked via "${clickedSel}", hash=${hashAfterClick}`);
  } else {
    record('F20-3', 'セッションクリックで#/history/:id詳細遷移',
      detailOK ? 5 : 1,
      `clicked=${detailOK}, hash=${hashAfterClick}, screenVisible=${historyScreenVisible}`);
  }

  // F20-3bis: 詳細画面の発言表示 (時系列)
  const detailBody = await page.locator('#history-screen').innerHTML().catch(() => '');
  const hasUserText = /履歴テスト用/.test(detailBody);
  const hasAIResponse = detailBody.length > 200; // 何かしらのテキストがある
  if (hasUserText && hasAIResponse) {
    record('F20-3b', 'セッション詳細で発言が時系列で表示', 10,
      `user text + AI response present, body len=${detailBody.length}`);
  } else {
    record('F20-3b', 'セッション詳細で発言が時系列で表示', hasUserText ? 5 : 1,
      `hasUser=${hasUserText}, bodyLen=${detailBody.length}`);
  }

  // F20-4: 気分推移 (開始/中盤/終盤)
  const hasEmotionTrack = /emotion|気分|mood|推移/.test(detailBody) || /[😢😟😐🙂😊]/.test(detailBody);
  if (hasEmotionTrack) {
    record('F20-4', '気分推移（開始/中盤/終盤）の可視化', 10,
      `emotion track visible in detail`);
  } else {
    record('F20-4', '気分推移（開始/中盤/終盤）の可視化', 3,
      `no emotion track found in detail body`);
  }

  // F20-5: 戻るナビ
  const backButtonCount = await page.locator('button:has-text("戻る"), a:has-text("戻る"), button:has-text("相談"), #header-user-name, .history-back').count();
  // 実装確認のためテキストで広めに探す
  let backClicked = false;
  const backButtonLocators = [
    page.locator('button:has-text("戻る")'),
    page.locator('a:has-text("戻る")'),
    page.locator('button:has-text("履歴に戻る")'),
    page.locator('button:has-text("一覧に戻る")'),
    page.locator('.history-back-button'),
    page.locator('.history-back'),
    page.locator('button:has-text("相談画面")'),
  ];
  for (const loc of backButtonLocators) {
    if (await loc.count() > 0) {
      await loc.first().click();
      await page.waitForTimeout(1000);
      backClicked = true;
      break;
    }
  }
  const hashAfterBack = await page.evaluate(() => location.hash);
  if (backClicked && (hashAfterBack === '#/' || hashAfterBack === '#/history' || hashAfterBack === '#')) {
    record('F20-5', '戻るナビで相談画面または履歴一覧に戻れる', 10,
      `hash after back: ${hashAfterBack}`);
  } else {
    // 明示的なボタンがなくてもヘッダタイトル等でたどり着ければOK
    const headerTitleClickable = await page.locator('.header-title, .header, #app-header').count();
    record('F20-5', '戻るナビで相談画面または履歴一覧に戻れる',
      backClicked ? 5 : (headerTitleClickable > 0 ? 5 : 2),
      `backClicked=${backClicked}, hashAfterBack=${hashAfterBack}`);
  }

  // F20-6: 履歴画面で編集・削除UIがない
  // 相談画面に戻っているかもしれないので履歴詳細に戻る
  await page.goto(BASE + '/#/history');
  await page.waitForTimeout(1000);
  for (const c of ['button[data-session-id]', '[data-session-id]']) {
    const cnt = await page.locator(c).count();
    if (cnt > 0) {
      await page.locator(c).first().click();
      await page.waitForTimeout(1000);
      break;
    }
  }
  const editDeleteCount = await page.locator(
    'button:has-text("編集"), button:has-text("削除"), [class*="edit"], [class*="delete"]'
  ).count();
  if (editDeleteCount === 0) {
    record('F20-6', '履歴画面に編集・削除UIがない（閲覧専用）', 10, 'no edit/delete UI');
  } else {
    record('F20-6', '履歴画面に編集・削除UIがない（閲覧専用）', 4,
      `found ${editDeleteCount} edit/delete elements`);
  }

  // =============================================================
  // 回帰テスト Sprint 1-6
  // =============================================================
  log('=== Regression: Sprint 1-6 ===');

  await page.goto(BASE);
  await page.waitForTimeout(2000);
  // モーダルが出たら閉じる（fresh）
  const openResume = await page.locator('#resume-modal').isVisible().catch(() => false);
  if (openResume) {
    await page.click('.resume-button-fresh').catch(() => {});
    await page.waitForTimeout(1500);
  }

  // R1: カテゴリ/モード/テーマ切替
  let cActive = await page.locator('.category-button.active').count();
  if (cActive > 0) await page.locator('.category-button.active').first().click();
  await page.click('.category-button[data-category="仕事"]');
  const catActive = await page.locator('.category-button[data-category="仕事"].active').count();
  await page.click('.mode-button[data-mode="solution"]');
  const modeActive = await page.locator('.mode-button[data-mode="solution"].active').count();
  // テーマ切替
  await page.click('.theme-button[data-theme="forest"]');
  await page.waitForTimeout(200);
  const forestBodyClass = await page.evaluate(() => document.body.className);
  await page.click('.theme-button[data-theme="default"]');
  if (catActive > 0 && modeActive > 0 && /forest/.test(forestBodyClass)) {
    record('R1', 'カテゴリ/モード/テーマ切替（Sprint 3/6）', 10,
      `cat active, mode active, theme forest applied (${forestBodyClass})`);
  } else {
    record('R1', 'カテゴリ/モード/テーマ切替（Sprint 3/6）', 4,
      `cat=${catActive}, mode=${modeActive}, themeClass=${forestBodyClass}`);
  }

  // R2: ストリーミング表示が壊れていない
  // 一度ボタンをリセット
  const c2Active = await page.locator('.category-button.active').count();
  if (c2Active > 0) await page.locator('.category-button.active').first().click();

  await page.fill('#message-input', '回帰テスト: ストリーミングは壊れていないか確認。');
  await page.click('#send-button');
  await page.waitForTimeout(700); // 中途
  const streamingMidCount = await page.locator('.message-streaming').count();
  const streamComplete = await waitForStreamingDone(page);
  const streamingDoneCount = await page.locator('.streaming-done, .message-ai:not(.message-streaming)').count();
  if (streamingMidCount > 0 && streamComplete) {
    record('R2', 'ストリーミング表示が壊れていない（Sprint 5）', 10,
      `mid-stream element count=${streamingMidCount}, completed OK`);
  } else {
    record('R2', 'ストリーミング表示が壊れていない（Sprint 5）',
      streamComplete ? 6 : 2,
      `midCount=${streamingMidCount}, complete=${streamComplete}`);
  }

  // R3: 絵文字セレクタ (Sprint 6 Feature 14)
  const emoSelCount = await page.locator('.emotion-selector').count();
  const emoButtonsCount = await page.locator('.emotion-selector').first().locator('.emotion-button').count();
  if (emoSelCount >= 1 && emoButtonsCount === 5) {
    record('R3', '絵文字セレクタ（Sprint 6 Feature 14）', 10,
      `selector=${emoSelCount}, buttons=${emoButtonsCount}`);
  } else {
    record('R3', '絵文字セレクタ（Sprint 6 Feature 14）', 3,
      `selector=${emoSelCount}, buttons=${emoButtonsCount}`);
  }

  // R4: 気分トーン（DB経由）- 😢 押して → 次の相談
  if (emoSelCount > 0) {
    await page.locator('.emotion-selector').first().locator('.emotion-button').first().click(); // 😢
    await page.waitForTimeout(500);
    await page.fill('#message-input', 'とてもつらくて、どうしたらいいか分かりません。');
    await page.click('#send-button');
    await waitForStreamingDone(page);
    const lastAi = await page.locator('.message-ai:not(.message-welcome)').last().innerText().catch(() => '');
    const hasEmpathy = /つらい|つらく|気持ち|受け止め|寄り添|わかり|分かり|大切に|一緒に/.test(lastAi);
    if (hasEmpathy) {
      record('R4', '気分トーン調整（Sprint 6 Feature 15 / DB経由）', 10,
        `empathy words detected in last AI response`);
    } else {
      record('R4', '気分トーン調整（Sprint 6 Feature 15 / DB経由）', 5,
        `no clear empathy markers in response (len=${lastAi.length})`);
    }
  } else {
    record('R4', '気分トーン調整（Sprint 6 Feature 15 / DB経由）', 3,
      'no emotion selector to test with');
  }

  // R5: サマリカード (Sprint 6 Feature 16)
  await page.click('#new-consultation-button');
  await page.waitForTimeout(500);
  const summaryVisible = await page.locator('#summary-modal').isVisible().catch(() => false);
  const summaryOpen = await page.locator('#summary-modal.is-open').count();
  if (summaryVisible || summaryOpen > 0) {
    record('R5', 'サマリカード表示（Sprint 6 Feature 16）', 10,
      `summary modal visible on new-consultation click`);
    // 閉じる
    const cancelBtn = page.locator('.summary-close-button, button:has-text("閉じる")');
    if (await cancelBtn.count() > 0) {
      await cancelBtn.first().click();
    }
  } else {
    record('R5', 'サマリカード表示（Sprint 6 Feature 16）', 2,
      `summary modal did not open on new-consultation click`);
  }

  // R6: 文字数カウンタ + Enter送信
  await page.fill('#message-input', 'テスト文字列');
  const charText = await page.locator('#char-count').textContent().catch(() => '');
  const hasCharCount = /6\s*\/\s*1000/.test(charText);
  // Enter送信確認 (Shift+Enterは改行、Enterは送信)
  await page.fill('#message-input', 'Enterで送信されるテスト');
  await page.locator('#message-input').press('Enter');
  await page.waitForTimeout(500);
  const inputCleared = await page.locator('#message-input').inputValue().catch(() => 'stillHere') === '';
  const enterSent = inputCleared || (await page.locator('.message-user').count()) > 0;
  if (hasCharCount && enterSent) {
    record('R6', '文字数カウンタ + Enter送信', 10,
      `char="${charText}", Enter sent message`);
    // 余計な送信を完了待ち
    await waitForStreamingDone(page, 30000);
  } else {
    record('R6', '文字数カウンタ + Enter送信',
      (hasCharCount || enterSent) ? 6 : 2,
      `charCount="${charText}", enterSent=${enterSent}`);
  }

  // R7: コンソールエラー
  const nonFaviconErrors = consoleErrors.filter(e => !/favicon/.test(e));
  if (nonFaviconErrors.length === 0) {
    record('R7', 'コンソールエラー0件（favicon除く）', 10, 'no errors');
  } else {
    record('R7', 'コンソールエラー0件（favicon除く）',
      nonFaviconErrors.length < 3 ? 6 : 2,
      `${nonFaviconErrors.length} errors: ${nonFaviconErrors.slice(0,3).join(' / ')}`);
  }

  // =============================================================
  // A11y チェック（Sprint 6 宿題）
  // =============================================================
  log('=== A11y checks ===');

  await page.goto(BASE);
  await page.waitForTimeout(1500);
  const resumeOpen = await page.locator('#resume-modal').isVisible().catch(() => false);
  if (resumeOpen) {
    await page.click('.resume-button-fresh').catch(() => {});
    await page.waitForTimeout(1000);
  }

  // 絵文字セレクタへのTabフォーカス確認
  // まず新規相談を送って絵文字セレクタを出す
  await sendConsult(page, 'A11yテスト用の相談です。');
  await page.waitForTimeout(300);
  const a11yEmoCount = await page.locator('.emotion-selector').count();
  if (a11yEmoCount > 0) {
    // 1個目の絵文字ボタンにフォーカスできるか
    const firstEmoBtn = page.locator('.emotion-selector .emotion-button').first();
    await firstEmoBtn.focus();
    const focused = await page.evaluate(() =>
      document.activeElement && document.activeElement.classList.contains('emotion-button'));
    // Space/Enter キーで選択できるか
    await firstEmoBtn.press('Enter');
    await page.waitForTimeout(600);
    const activeAfterEnter = await page.locator('.emotion-button.active').count();
    const ariaAfterEnter = await page.locator('.emotion-button[aria-pressed="true"]').count();
    if (focused && (activeAfterEnter > 0 || ariaAfterEnter > 0)) {
      record('A11y-1', '絵文字セレクタがTab+Enterで操作可能', 10,
        `focused=${focused}, activeAfterEnter=${activeAfterEnter}, ariaPressed=${ariaAfterEnter}`);
    } else {
      record('A11y-1', '絵文字セレクタがTab+Enterで操作可能',
        focused ? 5 : 2,
        `focused=${focused}, activeAfterEnter=${activeAfterEnter}, aria=${ariaAfterEnter}`);
    }
  } else {
    record('A11y-1', '絵文字セレクタがTab+Enterで操作可能', 2, 'no emotion selector to test');
  }

  // オンボーディング画面のキーボード操作（別コンテキストで）
  const a11yCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const a11yPage = await a11yCtx.newPage();
  await a11yPage.goto(BASE);
  await a11yPage.waitForTimeout(1000);
  const obInput = await a11yPage.locator('#onboarding-name-input').count();
  let a11yResult = 0;
  if (obInput > 0) {
    const isAutoFocused = await a11yPage.evaluate(() =>
      document.activeElement && document.activeElement.id === 'onboarding-name-input');
    await a11yPage.locator('#onboarding-name-input').fill('キーボード太郎');
    await a11yPage.locator('#onboarding-name-input').press('Enter');
    await a11yPage.waitForTimeout(2000);
    const uuidAfterEnter = await a11yPage.evaluate(() => localStorage.getItem('consultationApp.userUuid'));
    if (isAutoFocused && uuidAfterEnter) {
      a11yResult = 10;
      record('A11y-2', 'オンボーディング画面がキーボードで操作可能', 10,
        `autofocused=${isAutoFocused}, Enter submitted`);
    } else {
      a11yResult = uuidAfterEnter ? 7 : 3;
      record('A11y-2', 'オンボーディング画面がキーボードで操作可能',
        a11yResult, `autofocused=${isAutoFocused}, enterSubmitted=${!!uuidAfterEnter}`);
    }
  } else {
    record('A11y-2', 'オンボーディング画面がキーボードで操作可能', 2, 'no onboarding input');
  }
  await a11yCtx.close();

  // ========== まとめ ==========
  await browser.close();

  const summary = {
    results,
    bugs,
    consoleErrors,
    avg: (results.reduce((a, r) => a + r.score, 0) / results.length).toFixed(2),
    min: Math.min(...results.map(r => r.score)),
  };
  // P0基準: Feature 18/19 + 回帰
  const p0Ids = ['F18-1','F18-2','F18-3','F18-4','F18-5','F18-6','F18-7',
    'F19-1','F19-2','F19-3','F19-4','F19-5',
    'R1','R2','R3','R4','R5','R6','R7'];
  const p0Results = results.filter(r => p0Ids.includes(r.id));
  summary.p0Avg = (p0Results.reduce((a, r) => a + r.score, 0) / p0Results.length).toFixed(2);
  summary.p0Min = Math.min(...p0Results.map(r => r.score));

  fs.writeFileSync('.evaluator_tmp/sprint7-results.json',
    JSON.stringify(summary, null, 2), 'utf-8');

  console.log('\n===== Summary =====');
  console.log(`Total: ${results.length} criteria`);
  console.log(`Avg score: ${summary.avg}`);
  console.log(`Min score: ${summary.min}`);
  console.log(`P0 avg: ${summary.p0Avg}`);
  console.log(`P0 min: ${summary.p0Min}`);
  console.log(`Bugs: ${bugs.length}`);
  console.log(`Console errors: ${consoleErrors.length}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  fs.writeFileSync('.evaluator_tmp/sprint7-fatal.txt',
    `${err.stack || err.message}`, 'utf-8');
  process.exit(1);
});
