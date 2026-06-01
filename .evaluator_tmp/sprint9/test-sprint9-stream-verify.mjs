// Verify template insertion during actual streaming (after first chunk arrives)

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000/';

async function registerUser() {
  const res = await fetch(BASE_URL + 'api/user/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'EvaluatorSprint9Stream' }),
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
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  const input = page.locator('#message-input');
  await input.fill('');
  await page.locator('.template-button[data-template-id="workplace"]').click();
  await page.waitForTimeout(200);
  await page.keyboard.type('短く答えて');
  await page.locator('#send-button').click();

  // ストリーミングが真に開始（最初のチャンクが到達して message-streaming-content が描画される）まで待つ
  await page.waitForSelector('.message-streaming-content', { timeout: 30000 });
  await page.waitForTimeout(50); // 直後

  // 直後にテンプレ family をクリック
  const inputValBefore = await input.inputValue();
  const isStreamingState = await page.evaluate(() => {
    // state は ESM の内部なので window 経由参照は不能。代わりに input.disabled で代替
    return {
      inputDisabled: document.querySelector('#message-input').disabled,
      streamingMsgExists: !!document.querySelector('.message-streaming-content'),
      streamingDone: !!document.querySelector('.message-ai.streaming-done'),
    };
  });
  console.log(`[mid-stream] inputValBefore="${inputValBefore}" state=`, isStreamingState);

  await page.locator('.template-button[data-template-id="family"]').click();
  await page.waitForTimeout(200);
  const inputValAfter = await input.inputValue();
  console.log(`[mid-stream] inputValAfter="${inputValAfter}"`);
  console.log(`[mid-stream] template inserted during streaming? ${inputValBefore !== inputValAfter}`);
  console.log(`[mid-stream] expectation: false (DESIGN §7.9.4 早期 return)`);

  // 完了待ち
  try {
    await page.waitForSelector('.message-ai.streaming-done', { timeout: 60000 });
  } catch (e) {
    console.log('streaming-done timeout');
  }

  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
