// ui/history.js — Feature 20: 過去の相談履歴閲覧画面（一覧 + 詳細）。
// 閲覧専用。編集・削除なし。

import { listHistory, getHistoryDetail } from "../api.js";
import { navigate } from "../router.js";

const EMOJI_MAP = {
  1: { emoji: "😢", label: "とてもつらい" },
  2: { emoji: "😟", label: "不安" },
  3: { emoji: "😐", label: "ふつう" },
  4: { emoji: "🙂", label: "前向き" },
  5: { emoji: "😊", label: "とても前向き" },
};

let screenEl = null;

export function initHistory(screen) {
  screenEl = screen;
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch (_) {
    return iso;
  }
}

function formatDateOnly(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch (_) {
    return iso;
  }
}

/** 履歴一覧画面 */
export async function showList() {
  if (!screenEl) return;
  screenEl.innerHTML = "";
  screenEl.hidden = false;

  const wrap = document.createElement("div");
  wrap.classList.add("history-screen");

  const header = document.createElement("div");
  header.classList.add("history-header");

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.classList.add("history-back-button");
  backBtn.textContent = "← 相談画面に戻る";
  backBtn.addEventListener("click", () => navigate("#/"));
  header.appendChild(backBtn);

  const title = document.createElement("h2");
  title.classList.add("history-title");
  title.textContent = "過去の相談履歴";
  header.appendChild(title);

  wrap.appendChild(header);

  const body = document.createElement("div");
  body.classList.add("history-body");

  const loader = document.createElement("p");
  loader.classList.add("history-loading");
  loader.textContent = "読み込み中...";
  body.appendChild(loader);

  wrap.appendChild(body);
  screenEl.appendChild(wrap);

  try {
    const result = await listHistory();
    body.innerHTML = "";
    const sessions = (result && result.sessions) || [];
    if (sessions.length === 0) {
      const empty = document.createElement("p");
      empty.classList.add("history-empty");
      empty.textContent = "まだ相談履歴はありません。";
      body.appendChild(empty);
      return;
    }

    // 日付でグループ化
    const groups = new Map();
    for (const s of sessions) {
      const dateKey = formatDateOnly(s.startedAt);
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey).push(s);
    }

    for (const [dateKey, list] of groups) {
      const group = document.createElement("section");
      group.classList.add("history-group");

      const dateHeading = document.createElement("h3");
      dateHeading.classList.add("history-group-date");
      dateHeading.textContent = dateKey;
      group.appendChild(dateHeading);

      const ul = document.createElement("ul");
      ul.classList.add("history-session-list");

      for (const s of list) {
        const li = document.createElement("li");
        li.classList.add("history-session-item");

        const btn = document.createElement("button");
        btn.type = "button";
        btn.classList.add("history-session-button");
        btn.dataset.sessionId = s.sessionId;

        const time = document.createElement("span");
        time.classList.add("history-session-time");
        time.textContent = formatDate(s.startedAt);
        btn.appendChild(time);

        const preview = document.createElement("span");
        preview.classList.add("history-session-preview");
        preview.textContent = s.preview || "（発言はまだありません）";
        btn.appendChild(preview);

        const status = document.createElement("span");
        status.classList.add("history-session-status");
        status.textContent = s.closedAt ? "完了" : "継続中";
        if (!s.closedAt) status.classList.add("is-open");
        btn.appendChild(status);

        btn.addEventListener("click", () => {
          navigate(`#/history/${encodeURIComponent(s.sessionId)}`);
        });

        li.appendChild(btn);
        ul.appendChild(li);
      }
      group.appendChild(ul);
      body.appendChild(group);
    }
  } catch (err) {
    body.innerHTML = "";
    const e = document.createElement("p");
    e.classList.add("history-error");
    e.textContent = (err && err.message) || "履歴の取得に失敗しました。";
    body.appendChild(e);
  }
}

/** 履歴詳細画面 */
export async function showDetail(sessionId) {
  if (!screenEl) return;
  screenEl.innerHTML = "";
  screenEl.hidden = false;

  const wrap = document.createElement("div");
  wrap.classList.add("history-screen", "history-detail-screen");

  const header = document.createElement("div");
  header.classList.add("history-header");

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.classList.add("history-back-button");
  backBtn.textContent = "← 履歴一覧に戻る";
  backBtn.addEventListener("click", () => navigate("#/history"));
  header.appendChild(backBtn);

  const title = document.createElement("h2");
  title.classList.add("history-title");
  title.textContent = "相談詳細";
  header.appendChild(title);

  wrap.appendChild(header);

  const body = document.createElement("div");
  body.classList.add("history-body");

  const loader = document.createElement("p");
  loader.classList.add("history-loading");
  loader.textContent = "読み込み中...";
  body.appendChild(loader);

  wrap.appendChild(body);
  screenEl.appendChild(wrap);

  try {
    const detail = await getHistoryDetail(sessionId);
    body.innerHTML = "";

    if (!detail || !detail.session) {
      const empty = document.createElement("p");
      empty.classList.add("history-error");
      empty.textContent = "セッションが見つかりません。";
      body.appendChild(empty);
      return;
    }

    // 気分推移（開始/中盤/最終）。DESIGN §4.3 R6: floor(N/2)
    const emotionsSection = renderEmotionTrack(detail.emotions || []);
    body.appendChild(emotionsSection);

    // 発言一覧
    const log = document.createElement("div");
    log.classList.add("history-messages");

    // message_id ごとの最新 emoji を引けるように（§7.6 最新採用）
    const latestEmoByMsg = {};
    for (const e of detail.emotions || []) {
      if (!e.messageId) continue;
      const prev = latestEmoByMsg[e.messageId];
      const ca = e.createdAt || "";
      if (!prev || prev.createdAt < ca) {
        latestEmoByMsg[e.messageId] = e;
      }
    }

    for (const m of detail.messages || []) {
      const msgDiv = document.createElement("div");
      msgDiv.classList.add("history-message");
      msgDiv.classList.add(m.role === "user" ? "history-message-user" : "history-message-ai");

      const label = document.createElement("span");
      label.classList.add("message-label");
      label.textContent = m.role === "user" ? "あなた" : "AIカウンセラー";
      msgDiv.appendChild(label);

      const content = document.createElement("span");
      content.classList.add("history-message-content");
      content.textContent = m.content;
      msgDiv.appendChild(content);

      // 対応 emoji があれば表示
      const emo = latestEmoByMsg[m.id];
      if (emo && m.role === "assistant") {
        const tag = document.createElement("span");
        tag.classList.add("history-message-emoji");
        const choice = EMOJI_MAP[emo.emojiValue];
        tag.textContent = choice ? `記録: ${choice.emoji} ${choice.label}` : "";
        tag.setAttribute("aria-label", `この回答後の気分記録: ${choice ? choice.label : ""}`);
        msgDiv.appendChild(tag);
      }

      log.appendChild(msgDiv);
    }

    body.appendChild(log);
  } catch (err) {
    body.innerHTML = "";
    const e = document.createElement("p");
    e.classList.add("history-error");
    e.textContent = (err && err.message) || "履歴詳細の取得に失敗しました。";
    body.appendChild(e);
  }
}

/** 気分推移（開始/中盤/最終）を可視化。§4.3 R6 floor(N/2) */
function renderEmotionTrack(emotions) {
  const section = document.createElement("section");
  section.classList.add("history-emotion-summary");

  const h = document.createElement("h3");
  h.classList.add("history-emotion-title");
  h.textContent = "気分の変化";
  section.appendChild(h);

  const n = emotions.length;
  if (n === 0) {
    const p = document.createElement("p");
    p.classList.add("history-emotion-empty");
    p.textContent = "このセッションでは気分の記録がありません。";
    section.appendChild(p);
    return section;
  }

  // 時系列ソート
  const sorted = emotions.slice().sort((a, b) => {
    const ca = a.createdAt || "";
    const cb = b.createdAt || "";
    return ca < cb ? -1 : ca > cb ? 1 : 0;
  });

  let points;
  if (n === 1) {
    points = [{ label: "最初", value: sorted[0].emojiValue }];
  } else {
    const first = sorted[0];
    const mid = sorted[Math.floor(n / 2)]; // R6
    const last = sorted[n - 1];
    points = [
      { label: "はじめ", value: first.emojiValue },
      { label: "中盤", value: mid.emojiValue },
      { label: "いま", value: last.emojiValue },
    ];
  }

  const track = document.createElement("div");
  track.classList.add("history-emotion-track");

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const node = document.createElement("div");
    node.classList.add("history-emotion-point");

    const lab = document.createElement("span");
    lab.classList.add("history-emotion-point-label");
    lab.textContent = p.label;
    node.appendChild(lab);

    const emo = document.createElement("span");
    emo.classList.add("history-emotion-point-emoji");
    const choice = EMOJI_MAP[p.value];
    emo.textContent = choice ? choice.emoji : "";
    node.appendChild(emo);

    const sub = document.createElement("span");
    sub.classList.add("history-emotion-point-sub");
    sub.textContent = choice ? choice.label : "";
    node.appendChild(sub);

    track.appendChild(node);

    if (i < points.length - 1) {
      const next = points[i + 1];
      const arrow = document.createElement("span");
      arrow.classList.add("history-emotion-arrow");
      if (next.value > p.value) {
        arrow.textContent = "↗";
        arrow.classList.add("is-up");
      } else if (next.value < p.value) {
        arrow.textContent = "↘";
        arrow.classList.add("is-down");
      } else {
        arrow.textContent = "→";
        arrow.classList.add("is-flat");
      }
      track.appendChild(arrow);
    }
  }
  section.appendChild(track);

  const note = document.createElement("p");
  note.classList.add("history-emotion-note");
  note.textContent = `このセッションで押された気分ボタンの記録 ${n} 件から作成しています。`;
  section.appendChild(note);
  return section;
}

export function hide() {
  if (!screenEl) return;
  screenEl.hidden = true;
  screenEl.innerHTML = "";
}
