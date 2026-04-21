// ui/onboarding.js — Feature 18: ユーザー名入力画面。
// システムが UUID を発行し、localStorage に保存する。

import { state } from "../state.js";
import { registerUser } from "../api.js";

let screenEl = null;
let onCompleteCb = null;

export function initOnboarding(screen, { onComplete }) {
  screenEl = screen;
  onCompleteCb = onComplete;
}

/**
 * オンボーディング画面を構築して表示。
 */
export function show() {
  if (!screenEl) return;
  screenEl.innerHTML = "";
  screenEl.hidden = false;

  const card = document.createElement("div");
  card.classList.add("onboarding-card");

  const title = document.createElement("h2");
  title.classList.add("onboarding-title");
  title.textContent = "はじめまして";
  card.appendChild(title);

  const desc = document.createElement("p");
  desc.classList.add("onboarding-description");
  desc.textContent =
    "「こころの相談室」へようこそ。\n" +
    "まずは、あなたの呼び方を教えてください。\n" +
    "（パスワードやメールアドレスは不要です）";
  card.appendChild(desc);

  const form = document.createElement("form");
  form.classList.add("onboarding-form");
  form.noValidate = true;

  const label = document.createElement("label");
  label.classList.add("onboarding-label");
  label.htmlFor = "onboarding-name-input";
  label.textContent = "お名前（ニックネーム可）";
  form.appendChild(label);

  const input = document.createElement("input");
  input.type = "text";
  input.id = "onboarding-name-input";
  input.classList.add("onboarding-input");
  input.placeholder = "例: たろう";
  input.maxLength = 50;
  input.autocomplete = "off";
  input.required = true;
  form.appendChild(input);

  const errorEl = document.createElement("div");
  errorEl.classList.add("onboarding-error");
  errorEl.id = "onboarding-error";
  errorEl.hidden = true;
  form.appendChild(errorEl);

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.classList.add("onboarding-submit");
  submit.textContent = "はじめる";
  form.appendChild(submit);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = (input.value || "").trim();
    if (!name) {
      errorEl.textContent = "お名前を入力してください。";
      errorEl.hidden = false;
      return;
    }
    if (name.length > 50) {
      errorEl.textContent = "50文字以内で入力してください。";
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    submit.disabled = true;
    submit.textContent = "登録中...";
    try {
      const result = await registerUser(name);
      if (!result || !result.uuid) {
        throw new Error("登録結果が取得できませんでした。");
      }
      state.setUserUuid(result.uuid);
      state.setUserName(result.userName);
      if (typeof onCompleteCb === "function") {
        onCompleteCb();
      }
    } catch (err) {
      errorEl.textContent =
        (err && err.message) || "登録に失敗しました。もう一度お試しください。";
      errorEl.hidden = false;
      submit.disabled = false;
      submit.textContent = "はじめる";
    }
  });

  card.appendChild(form);
  screenEl.appendChild(card);

  // オートフォーカス
  setTimeout(() => input.focus(), 0);
}

export function hide() {
  if (!screenEl) return;
  screenEl.hidden = true;
  screenEl.innerHTML = "";
}
