// 検証: ローディング中（送信直後 / 最初のチャンク到達前）にテンプレ挿入したらどうなるか

import { chromium } from 'playwright';
const BASE_URL = 'http://localhost:3000/';

async function registerUser() {
  const res = await fetch(BASE_URL + 'api/user/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'EvaluatorSprint9Loading' }),
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
  await page.waitForTimeout(100);
  await page.keyboard.type('短く答えて');
  await page.locator('#send-button').click();

  // 送信直後（ローディング中）にテンプレを押す
  await page.waitForTimeout(50);
  const stateBefore = await page.evaluate(() => ({
    inputDisabled: document.querySelector('#message-input').disabled,
    streamingMsg: !!document.querySelector('.message-streaming-content'),
    inputVal: document.querySelector('#message-input').value,
  }));
  console.log(`[loading] before template click:`, stateBefore);

  await page.locator('.template-button[data-template-id="family"]').click();
  await page.waitForTimeout(100);
  const stateMid = await page.evaluate(() => ({
    inputDisabled: document.querySelector('#message-input').disabled,
    streamingMsg: !!document.querySelector('.message-streaming-content'),
    inputVal: document.querySelector('#message-input').value,
  }));
  console.log(`[loading] just after template click:`, stateMid);
  console.log(`[loading] => template inserted during loading? ${stateMid.inputVal !== stateBefore.inputVal}`);

  // ストリーミング完了まで待つ
  try {
    await page.waitForSelector('.message-ai.streaming-done', { timeout: 90000 });
  } catch (e) {
    console.log('streaming-done timeout');
  }
  await page.waitForTimeout(500);

  const stateAfter = await page.evaluate(() => ({
    inputDisabled: document.querySelector('#message-input').disabled,
    streamingMsg: !!document.querySelector('.message-streaming-content'),
    inputVal: document.querySelector('#message-input').value,
    streamingDone: !!document.querySelector('.message-ai.streaming-done'),
  }));
  console.log(`[loading] after streaming done:`, stateAfter);
  console.log(`[loading] => 挿入されたテンプレ value は残存？ ${stateAfter.inputVal !== ''}`);
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
