// Sprint 8 / Feature 22 evaluator script
// Runs a headless Chromium via Playwright against the local server.
// Logs results as JSON-ish lines for downstream parsing by the evaluator agent.

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BASE_URL = "http://localhost:3000/";
const SCREENSHOT_DIR = "C:/ConsultationApplication/specs/evaluations/screenshots";

function log(label, payload) {
  if (payload === undefined) {
    console.log(`[${label}]`);
  } else {
    console.log(`[${label}] ${typeof payload === "string" ? payload : JSON.stringify(payload)}`);
  }
}

async function ensureOnboarded(page, name = "Eval太郎") {
  // Register a user via API so server returns the assigned UUID, then inject into localStorage.
  const res = await fetch("http://localhost:3000/api/user/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: name }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`register failed: ${res.status} ${txt}`);
  }
  const data = await res.json();
  const uuid = data.uuid;
  const userName = data.userName || name;
  await page.addInitScript(
    ({ uuid, userName }) => {
      localStorage.setItem("consultationApp.userUuid", uuid);
      localStorage.setItem("consultationApp.userName", userName);
    },
    { uuid, userName },
  );
  return uuid;
}

// Pin a specific clock date+time. Must be called BEFORE page.goto.
// Note: page.clock.install with `time` initialises a "fake" time and pauses by default.
// We then call page.clock.resume() so timers run as usual but date is fixed reference.
async function pinClock(page, isoLocal) {
  // We treat `time` as a local-time wall clock reference.
  await page.clock.install({ time: new Date(isoLocal) });
  // Resume so timers advance from the pinned moment (Date.now() advances forward).
  await page.clock.resume();
}

async function getDailyMessageInfo(page) {
  const locator = page.locator("[data-daily-message]");
  const exists = (await locator.count()) > 0;
  if (!exists) {
    return { exists: false };
  }
  const visible = await locator.first().isVisible();
  const weekday = await locator.first().getAttribute("data-weekday");
  const season = await locator.first().getAttribute("data-season");
  const text = (await locator.first().locator(".daily-message-text").textContent()).trim();
  const label = (await locator.first().locator(".daily-message-label").textContent()).trim();
  const meta = (await locator.first().locator(".daily-message-meta").textContent()).trim();
  return { exists: true, visible, weekday, season, text, label, meta };
}

async function welcomeExists(page) {
  const c = await page.locator("#welcome-message").count();
  if (c === 0) return { exists: false };
  const visible = await page.locator("#welcome-message").first().isVisible();
  const text = (await page.locator("#welcome-message").first().textContent()).trim();
  return { exists: true, visible, text };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  // Track network requests to verify no daily-message-specific server traffic
  const allRequests = [];
  context.on("request", (req) => allRequests.push({ url: req.url(), method: req.method() }));

  const results = {};

  try {
    // ===== TC1: Monday Spring (2026-03-02) — initial display =====
    {
      const page = await context.newPage();
      await ensureOnboarded(page, "Eval太郎");
      await pinClock(page, "2026-03-02T10:00:00");
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1000);
      const info = await getDailyMessageInfo(page);
      const wm = await welcomeExists(page);
      log("TC1_initial", { info, welcome: wm });
      results.tc1 = { info, welcome: wm };

      // Reload to verify determinism on same date
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);
      const info2 = await getDailyMessageInfo(page);
      log("TC1_reload", info2);
      results.tc1_reload = info2;
      await page.screenshot({ path: `${SCREENSHOT_DIR}/sprint-8-tc1-monday-spring.png`, fullPage: true });
      await page.close();
    }

    // ===== TC2: Friday Winter (2026-01-23) — different message =====
    {
      const page = await context.newPage();
      await ensureOnboarded(page, "Eval太郎");
      await pinClock(page, "2026-01-23T10:00:00");
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);
      const info = await getDailyMessageInfo(page);
      log("TC2_friday_winter", info);
      results.tc2 = info;
      await page.screenshot({ path: `${SCREENSHOT_DIR}/sprint-8-tc2-friday-winter.png`, fullPage: true });
      await page.close();
    }

    // ===== TC3: 28-pattern coverage (sample sweep) =====
    // Picked anchor dates: spring=2026-03 (Sun=3/1), summer=2026-07 (Sun=7/5), autumn=2026-10 (Sun=10/4), winter=2026-01 (Sun=1/4)
    const seasonAnchors = {
      spring: "2026-03-01", // Sunday
      summer: "2026-07-05", // Sunday
      autumn: "2026-10-04", // Sunday
      winter: "2026-01-04", // Sunday
    };
    const seasonExpected = {
      spring: [
        "やわらかな春の日曜日、心ものんびり緩めていきましょう",
        "新しい一週間、まずは深呼吸から",
        "芽吹きの火曜日、小さな一歩がきっと花になります",
        "春風が背中を押してくれる水曜日、ゆっくり進んでいきましょう",
        "うららかな木曜日、できたことを少し数えてみませんか",
        "週末まであと少し、春の光に身を委ねるように",
        "桜のような土曜日、自分にやさしい時間を過ごせますように",
      ],
      summer: [
        "夏の日曜日、木陰のような穏やかな時間を大切に",
        "暑い月曜日、無理せずひとつだけ動いてみる、それで十分",
        "そよ風の火曜日、自分のペースで進んでいけますように",
        "真夏の水曜日、水分と休憩も大切な仕事のひとつ",
        "夕立のあとの空のように、今日もどこかに澄んだ瞬間がありますように",
        "風鈴が鳴る金曜日、頑張った自分にそっと拍手を",
        "蝉時雨の土曜日、心の声にも耳をすませる一日に",
      ],
      autumn: [
        "秋の日曜日、ゆっくり淹れたお茶のような静かな時間を",
        "色づきはじめの月曜日、今日のあなたも素敵な色をしています",
        "澄んだ秋空の火曜日、ふっと肩の力が抜けますように",
        "落ち葉が舞う水曜日、立ち止まっても大丈夫",
        "実りの木曜日、ここまでの自分を少し褒めてみませんか",
        "夕暮れが早い金曜日、今週もよく歩いてきましたね",
        "読書の似合う土曜日、自分だけの静けさを味わって",
      ],
      winter: [
        "冬の日曜日、温かい飲み物と一緒にゆるりと過ごせますように",
        "凛とした月曜日、まずは手を温めるところから始めましょう",
        "冬晴れの火曜日、深呼吸して、今日の自分に挨拶を",
        "雪のようにそっと、自分の心にやさしくふれてみる一日",
        "灯火のような木曜日、小さな安心をたいせつに",
        "あと一日、自分に『おつかれ』と言ってあげて",
        "毛布のような土曜日、心も体もそっとくるんであげましょう",
      ],
    };
    results.tc3 = { total: 0, pass: 0, fail: 0, details: [] };
    for (const season of Object.keys(seasonAnchors)) {
      for (let dow = 0; dow < 7; dow++) {
        // anchor is Sunday; add dow days
        const anchor = new Date(`${seasonAnchors[season]}T10:00:00`);
        const d = new Date(anchor.getTime());
        d.setDate(d.getDate() + dow);
        const isoLocal = d.toISOString().slice(0, 19); // good enough since Date was constructed local
        // Build local-time iso string manually to avoid timezone surprises:
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const fixed = `${yyyy}-${mm}-${dd}T10:00:00`;

        const page = await context.newPage();
        await ensureOnboarded(page, "Eval太郎");
        await pinClock(page, fixed);
        await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(500);
        const info = await getDailyMessageInfo(page);
        const expected = seasonExpected[season][dow];
        const ok =
          info.exists &&
          info.weekday === String(dow) &&
          info.season === season &&
          info.text === expected;
        results.tc3.total++;
        if (ok) results.tc3.pass++;
        else results.tc3.fail++;
        results.tc3.details.push({ season, dow, date: fixed, expected, actual: info, ok });
        await page.close();
      }
    }
    log("TC3_summary", { total: results.tc3.total, pass: results.tc3.pass, fail: results.tc3.fail });

    // ===== TC4: "Reset" → welcome + daily message both re-appear =====
    {
      const page = await context.newPage();
      await ensureOnboarded(page, "Eval太郎");
      await pinClock(page, "2026-03-02T10:00:00");
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);
      const initial = await getDailyMessageInfo(page);

      // Send one message to enable "新しい相談を始める" button (it is disabled when no history)
      // Type and click send
      await page.fill("#message-input", "こんにちは、テスト送信です");
      await page.click("#send-button");
      // wait for streaming to finish — wait for the AI message to fully appear and emotion selector
      await page.waitForSelector(".message-ai", { timeout: 30000 });
      // Wait until streaming class is removed or 12 seconds max
      await page
        .waitForFunction(
          () => {
            const m = document.querySelectorAll(".message-ai");
            if (!m.length) return false;
            const last = m[m.length - 1];
            return !last.classList.contains("message-streaming");
          },
          null,
          { timeout: 30000 },
        )
        .catch(() => {});
      await page.waitForTimeout(800);

      // Click "新しい相談を始める"
      await page.click("#new-consultation-button");
      // Summary modal appears — click "リセット" / "リセットして新しい相談を始める"
      // The summary card has a confirm button. Try multiple labels.
      const resetBtn = page.locator('button:has-text("リセットして新しい相談を始める")');
      let clicked = false;
      if (await resetBtn.count()) {
        await resetBtn.first().click();
        clicked = true;
      } else {
        const alt = page.locator('button:has-text("リセット")');
        if (await alt.count()) {
          await alt.first().click();
          clicked = true;
        }
      }
      await page.waitForTimeout(800);
      const afterReset = await getDailyMessageInfo(page);
      const wmAfter = await welcomeExists(page);
      log("TC4_after_reset", { clicked, afterReset, welcome: wmAfter });
      results.tc4 = { clicked, initial, afterReset, welcome: wmAfter };
      await page.screenshot({ path: `${SCREENSHOT_DIR}/sprint-8-tc4-after-reset.png`, fullPage: true });
      await page.close();
    }

    // ===== TC5: Resume modal "続きから" — daily-message must NOT appear =====
    {
      const page = await context.newPage();
      const uuid = await ensureOnboarded(page, "EvalResume");
      await pinClock(page, "2026-03-02T10:00:00");
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);
      // Send one message to create an open session
      await page.fill("#message-input", "再開テスト用のメッセージ");
      await page.click("#send-button");
      await page.waitForSelector(".message-ai", { timeout: 30000 });
      await page
        .waitForFunction(
          () => {
            const m = document.querySelectorAll(".message-ai");
            if (!m.length) return false;
            return !m[m.length - 1].classList.contains("message-streaming");
          },
          null,
          { timeout: 30000 },
        )
        .catch(() => {});
      await page.waitForTimeout(800);

      // Reload — resume modal should appear
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      // The resume modal has a button "前回の続きから再開する"
      const resumeBtn = page.locator('button:has-text("前回の続きから再開する")');
      const resumeBtnCount = await resumeBtn.count();
      log("TC5_resume_button_count", resumeBtnCount);
      let resumed = false;
      if (resumeBtnCount > 0) {
        await resumeBtn.first().click();
        resumed = true;
      }
      await page.waitForTimeout(1500);
      const after = await getDailyMessageInfo(page);
      const wm = await welcomeExists(page);
      const userMsgCount = await page.locator(".message-user").count();
      log("TC5_after_resume", { resumed, dailyExists: after.exists, welcomeExists: wm.exists, userMsgCount });
      results.tc5 = { resumed, after, welcome: wm, userMsgCount };
      await page.screenshot({ path: `${SCREENSHOT_DIR}/sprint-8-tc5-resume.png`, fullPage: true });
      await page.close();
    }

    // ===== TC6: All themes — verify daily-message is still visible & has decent contrast =====
    {
      const page = await context.newPage();
      await ensureOnboarded(page, "EvalTheme");
      await pinClock(page, "2026-03-02T10:00:00");
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);

      const themes = ["default", "ocean", "forest", "night", "sakura"];
      results.tc6 = { themes: [] };
      for (const theme of themes) {
        await page.click(`.theme-button[data-theme="${theme}"]`);
        await page.waitForTimeout(300);
        const info = await getDailyMessageInfo(page);
        // Sanity: bounding box not zero
        const box = await page.locator("[data-daily-message]").first().boundingBox();
        const visible = await page.locator("[data-daily-message]").first().isVisible();
        results.tc6.themes.push({ theme, visible, w: box?.width, h: box?.height, info });
        await page.screenshot({ path: `${SCREENSHOT_DIR}/sprint-8-tc6-theme-${theme}.png`, fullPage: true });
      }
      log("TC6_themes", results.tc6.themes.map((t) => ({ theme: t.theme, visible: t.visible, w: t.w, h: t.h })));
      await page.close();
    }

    // ===== TC7: Tone screening of all 28 strings (no negative/command words) =====
    {
      const banned = ["しなさい", "するな", "してはいけない", "だめ", "ダメ", "禁止", "やめろ"];
      const messagesFlat = [];
      const dictPath = "C:/ConsultationApplication/public/js/data/dailyMessages.js";
      const src = fs.readFileSync(dictPath, "utf-8");
      const regex = /"([^"]{6,})"/g;
      let m;
      while ((m = regex.exec(src))) {
        const s = m[1];
        if (s.match(/月曜|火曜|水曜|木曜|金曜|土曜|日曜|春|夏|秋|冬|今日もおつかれ|今日のひとこと|新しい|うららか|落ち葉|読書|凛|灯火|毛布|桜|蝉|風鈴|夕立|真夏|そよ風|暑い|芽吹|週末|温か|雪|冬晴|色づき|澄|実り|やわらか/) || s.length >= 12) {
          messagesFlat.push(s);
        }
      }
      // Better: extract only string literals from the spring/summer/autumn/winter blocks
      const bucketRegex = /(spring|summer|autumn|winter):\s*\[([\s\S]*?)\]/g;
      const bucketed = {};
      let bm;
      while ((bm = bucketRegex.exec(src))) {
        const season = bm[1];
        const body = bm[2];
        const strs = [];
        const sre = /"([^"]+)"/g;
        let sm;
        while ((sm = sre.exec(body))) {
          strs.push(sm[1]);
        }
        bucketed[season] = strs;
      }
      const allStrings = Object.values(bucketed).flat();
      const offenders = [];
      for (const s of allStrings) {
        for (const w of banned) {
          if (s.includes(w)) offenders.push({ s, w });
        }
      }
      results.tc7 = {
        totalStrings: allStrings.length,
        offenders,
        bucketed,
        uniqueCount: new Set(allStrings).size,
      };
      log("TC7_tone_screening", {
        totalStrings: results.tc7.totalStrings,
        unique: results.tc7.uniqueCount,
        offenders,
      });
    }

    // ===== TC8: Server-stopped (offline-equivalent) — we can't actually stop server, but verify no /api/daily request =====
    {
      const page = await context.newPage();
      await ensureOnboarded(page, "EvalNet");
      await pinClock(page, "2026-03-02T10:00:00");
      const seen = [];
      page.on("request", (req) => seen.push(req.url()));
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      const info = await getDailyMessageInfo(page);
      const dailyReqs = seen.filter((u) => /daily|message-of-day|today/i.test(u));
      log("TC8_network", { dailyReqsCount: dailyReqs.length, sampleSeen: seen.slice(0, 8), info });
      results.tc8 = { dailyReqsCount: dailyReqs.length, dailyReqs, info };
      await page.close();
    }

    // ===== TC9: Regression — streaming send + emoji + summary + history =====
    {
      const page = await context.newPage();
      const uuid = await ensureOnboarded(page, "EvalRegression");
      await pinClock(page, "2026-03-02T10:00:00");
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);

      // Send a message
      await page.fill("#message-input", "最近、仕事のことで悩んでいて、なんだか落ち着かないんです。");
      await page.click("#send-button");
      // Check that input gets disabled during streaming (Sprint 5 regression)
      const inputDisabledDuringStreaming = await page.locator("#message-input").isDisabled();
      log("TC9_input_disabled_during_streaming", inputDisabledDuringStreaming);
      await page.waitForSelector(".message-ai", { timeout: 30000 });
      await page
        .waitForFunction(
          () => {
            const m = document.querySelectorAll(".message-ai");
            if (!m.length) return false;
            return !m[m.length - 1].classList.contains("message-streaming");
          },
          null,
          { timeout: 30000 },
        )
        .catch(() => {});
      await page.waitForTimeout(800);
      // Streaming complete
      const aiCount = await page.locator(".message-ai").count();
      const aiText = (await page.locator(".message-ai").last().textContent()).trim();
      const inputEnabledAfter = !(await page.locator("#message-input").isDisabled());

      // Emoji selector
      const emojiSelectorCount = await page.locator(".emotion-selector").count();
      // Click 🙂
      const happyBtn = page.locator(".emotion-selector .emotion-button").nth(3); // index 3 should be 🙂
      const buttonsTotal = await page.locator(".emotion-selector .emotion-button").count();
      log("TC9_emoji_buttons", { selectorCount: emojiSelectorCount, buttonsTotal });
      let emojiClicked = false;
      if (buttonsTotal >= 4) {
        await page.locator(".emotion-selector").last().locator(".emotion-button").nth(3).click();
        emojiClicked = true;
        await page.waitForTimeout(300);
      }
      const activeButtonCount = await page.locator(".emotion-button.active, .emotion-button.selected").count();

      // Click "新しい相談を始める" to invoke summary
      await page.click("#new-consultation-button");
      await page.waitForTimeout(800);
      // Look for summary card
      const summaryVisible =
        (await page.locator('.summary-card, [data-summary-card], :has-text("本日の変化")').count()) > 0;
      log("TC9_summary_visible", summaryVisible);
      // Close summary (without reset) to keep session for history
      const closeBtn = page.locator('button:has-text("閉じる")');
      if (await closeBtn.count()) {
        await closeBtn.first().click();
        await page.waitForTimeout(500);
      }

      // History link
      const historyLink = page.locator("#header-history-link");
      const historyLinkVisible = await historyLink.isVisible();
      log("TC9_history_link_visible", historyLinkVisible);
      let historyPageOk = false;
      if (historyLinkVisible) {
        await historyLink.click();
        await page.waitForTimeout(1500);
        // History page should show at least one session entry
        const entries = await page.locator(".history-session, .history-item, [data-history-session]").count();
        // Generic fallback: any list-like article/li
        const fallback = await page.locator("a[href*='#/history/'], li").count();
        historyPageOk = entries > 0 || fallback > 0;
        log("TC9_history_entries", { entries, fallback });
      }

      results.tc9 = {
        inputDisabledDuringStreaming,
        aiCount,
        aiTextLen: aiText.length,
        aiTextSample: aiText.slice(0, 80),
        inputEnabledAfter,
        emojiSelectorCount,
        emojiClicked,
        activeButtonCount,
        summaryVisible,
        historyLinkVisible,
        historyPageOk,
      };
      log("TC9_summary", results.tc9);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/sprint-8-tc9-regression.png`, fullPage: true });
      await page.close();
    }

    // Write all results to JSON for evaluator parsing
    fs.writeFileSync("C:/ConsultationApplication/tmp/sprint8_results.json", JSON.stringify(results, null, 2));
    log("DONE");
  } catch (e) {
    console.error("FATAL", e && e.stack ? e.stack : e);
    fs.writeFileSync(
      "C:/ConsultationApplication/tmp/sprint8_results.json",
      JSON.stringify({ ...results, fatal: String(e && e.stack ? e.stack : e) }, null, 2),
    );
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();
