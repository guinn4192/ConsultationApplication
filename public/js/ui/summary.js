// ui/summary.js — Feature 16: 本日の変化サマリカード（モーダル）。
// DESIGN §4.3 / R6: 中盤 = floor(N/2) 番目（0 始まり）。

import { state } from "../state.js";
import { EMOJI_CHOICES } from "./emotion.js";

const VALUE_TO_EMOJI = EMOJI_CHOICES.reduce((acc, c) => {
  acc[c.value] = c;
  return acc;
}, {});

let modalEl = null;
let onReset = null; // () => void （呼び出し側が持つ実リセット処理）

export function initSummary(modal, { onResetClick }) {
  modalEl = modal;
  onReset = onResetClick;

  // ESC キーで閉じる
  modalEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      close();
    }
  });

  // 背景クリックで閉じる（.summary-modal 本体をクリックした場合のみ。内側は閉じない）
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) {
      close();
    }
  });
}

function compute(emotions) {
  const n = emotions.length;
  if (n === 0) {
    return { n: 0, points: [] };
  }
  if (n === 1) {
    return { n: 1, points: [{ label: "最初", value: emotions[0].emojiValue }] };
  }
  const first = emotions[0];
  const middleIdx = Math.floor(n / 2); // DESIGN §4.3 R6
  const middle = emotions[middleIdx];
  const last = emotions[n - 1];
  return {
    n,
    points: [
      { label: "はじめ", value: first.emojiValue },
      { label: "中盤", value: middle.emojiValue },
      { label: "いま", value: last.emojiValue },
    ],
  };
}

function trendIcon(fromValue, toValue) {
  if (toValue > fromValue) return { arrow: "↗", dir: "up", text: "気持ちが上向きました" };
  if (toValue < fromValue) return { arrow: "↘", dir: "down", text: "気持ちが下がりました" };
  return { arrow: "→", dir: "flat", text: "気持ちは保たれています" };
}

export function open() {
  if (!modalEl) return;
  const emotions = state.getEmotions();
  const { n, points } = compute(emotions);

  // 中身をクリアして再構築（毎回開くたびに最新）
  modalEl.innerHTML = "";

  const card = document.createElement("div");
  card.classList.add("summary-card");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "summary-title");

  const title = document.createElement("h2");
  title.id = "summary-title";
  title.classList.add("summary-title");
  title.textContent = "本日の変化";
  card.appendChild(title);

  const body = document.createElement("div");
  body.classList.add("summary-body");

  if (n === 0) {
    const msg = document.createElement("p");
    msg.classList.add("summary-empty");
    msg.textContent = "今回は気持ちの記録がありません。";
    body.appendChild(msg);
  } else {
    const track = document.createElement("div");
    track.classList.add("summary-track");

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const node = document.createElement("div");
      node.classList.add("summary-point");

      const lab = document.createElement("span");
      lab.classList.add("summary-point-label");
      lab.textContent = p.label;
      node.appendChild(lab);

      const emo = document.createElement("span");
      emo.classList.add("summary-point-emoji");
      const choice = VALUE_TO_EMOJI[p.value];
      emo.textContent = choice ? choice.emoji : "";
      node.appendChild(emo);

      const sub = document.createElement("span");
      sub.classList.add("summary-point-sub");
      sub.textContent = choice ? choice.label : "";
      node.appendChild(sub);

      track.appendChild(node);

      // 間に矢印
      if (i < points.length - 1) {
        const next = points[i + 1];
        const trend = trendIcon(p.value, next.value);
        const arrow = document.createElement("span");
        arrow.classList.add("summary-change-arrow");
        arrow.classList.add(`summary-change-${trend.dir}`);
        arrow.textContent = trend.arrow;
        arrow.setAttribute("aria-label", trend.text);
        track.appendChild(arrow);
      }
    }
    body.appendChild(track);

    // 全体コメント
    if (points.length >= 2) {
      const first = points[0].value;
      const last = points[points.length - 1].value;
      const trend = trendIcon(first, last);
      const p = document.createElement("p");
      p.classList.add("summary-caption");
      p.textContent = trend.text;
      body.appendChild(p);
    } else if (n === 1) {
      const p = document.createElement("p");
      p.classList.add("summary-caption");
      p.textContent = "1 件の気持ちが記録されています。";
      body.appendChild(p);
    }
  }

  card.appendChild(body);

  // ボタン列
  const actions = document.createElement("div");
  actions.classList.add("summary-actions");

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.classList.add("summary-button", "summary-button-reset");
  resetBtn.textContent = "リセットして新しい相談を始める";
  resetBtn.addEventListener("click", () => {
    close();
    if (typeof onReset === "function") onReset();
  });
  actions.appendChild(resetBtn);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.classList.add("summary-button", "summary-button-close");
  closeBtn.textContent = "閉じる";
  closeBtn.addEventListener("click", () => {
    close();
  });
  actions.appendChild(closeBtn);

  card.appendChild(actions);
  modalEl.appendChild(card);

  modalEl.hidden = false;
  modalEl.classList.add("is-open");

  // フォーカス
  setTimeout(() => {
    resetBtn.focus();
  }, 0);
}

export function close() {
  if (!modalEl) return;
  modalEl.classList.remove("is-open");
  modalEl.hidden = true;
  modalEl.innerHTML = "";
}
