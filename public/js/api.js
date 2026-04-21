// api.js — fetch ラッパ。Sprint 7 で x-user-uuid ヘッダ自動付与 + REST エンドポイントの集約。

import { state } from "./state.js";

const OVERALL_TIMEOUT_MS = 60000;
const IDLE_TIMEOUT_MS = 20000;

/**
 * localStorage から UUID を毎回読み出し、ヘッダに x-user-uuid を自動付与する fetch。
 * メソッドや body は呼び出し側が自由に組める。
 */
async function apiFetch(input, init = {}) {
  const headers = new Headers(init.headers || {});
  // Content-Type が明示されてなく、body があるなら JSON 前提で付与
  if (!headers.has("Content-Type") && init.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  const uuid = state.getUserUuid();
  if (uuid && !headers.has("x-user-uuid")) {
    headers.set("x-user-uuid", uuid);
  }
  return fetch(input, { ...init, headers });
}

/**
 * 統一エラーハンドラ。成功時は JSON を返し、失敗時は Error を throw（message にサーバ側 error を入れる）。
 */
async function handleJson(res) {
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    if (ct.includes("application/json")) {
      try {
        const body = await res.json();
        if (body && body.error) msg = body.error;
      } catch (_) {}
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (ct.includes("application/json")) {
    return res.json();
  }
  return null;
}

// ---------- User ----------

export async function registerUser(userName) {
  const res = await apiFetch("/api/user/register", {
    method: "POST",
    body: JSON.stringify({ userName }),
  });
  return handleJson(res);
}

export async function getUser(uuid) {
  const res = await apiFetch(`/api/user/${encodeURIComponent(uuid)}`, { method: "GET" });
  if (res.status === 404) {
    const err = new Error("ユーザーが見つかりません。");
    err.status = 404;
    throw err;
  }
  return handleJson(res);
}

// ---------- Sessions ----------

export async function createSession(clientSessionId) {
  const res = await apiFetch("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ clientSessionId: clientSessionId || undefined }),
  });
  return handleJson(res);
}

export async function closeSession(sessionId) {
  const res = await apiFetch(
    `/api/sessions/${encodeURIComponent(sessionId)}/close`,
    { method: "POST", body: JSON.stringify({}) }
  );
  return handleJson(res);
}

/**
 * 204 → null, 200 → { session, messages, emotions }。
 */
export async function getResumableSession() {
  const uuid = state.getUserUuid();
  if (!uuid) return null;
  const res = await apiFetch(
    `/api/sessions/resumable?uuid=${encodeURIComponent(uuid)}`,
    { method: "GET" }
  );
  return handleJson(res);
}

// ---------- Emotions ----------

export async function saveEmotion({ sessionId, messageId, emojiValue }) {
  const res = await apiFetch("/api/emotions", {
    method: "POST",
    body: JSON.stringify({ sessionId, messageId, emojiValue }),
  });
  return handleJson(res);
}

// ---------- History ----------

export async function listHistory() {
  const uuid = state.getUserUuid();
  if (!uuid) return { sessions: [] };
  const res = await apiFetch(`/api/history?uuid=${encodeURIComponent(uuid)}`, {
    method: "GET",
  });
  return handleJson(res);
}

export async function getHistoryDetail(sessionId) {
  const res = await apiFetch(`/api/history/${encodeURIComponent(sessionId)}`, {
    method: "GET",
  });
  return handleJson(res);
}

// ---------- Consult Stream ----------

/**
 * /api/consult/stream を呼び、SSE を 1 行ずつハンドラへ渡す。
 * @param {Object} payload - body 本体（messages / category / mode / lastEmotion ほか）
 * @param {Object} handlers
 * @param {(text: string) => void} handlers.onDelta
 * @param {(payload: {reply, assistantMessageId, persisted}) => void} handlers.onDone
 * @param {(err: Error) => void} handlers.onError
 * @returns {{ cancel: () => void, done: Promise<void> }}
 */
export function consultStream(payload, handlers) {
  const abortController = new AbortController();
  let timedOutReason = null;

  const overallTimer = setTimeout(() => {
    timedOutReason =
      "AIからの回答を取得できませんでした。しばらくしてからもう一度お試しください。";
    try {
      abortController.abort();
    } catch (_) {}
  }, OVERALL_TIMEOUT_MS);

  let idleTimer = null;
  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      timedOutReason =
        "AIからの応答がありません。ネットワーク状況を確認の上、もう一度お試しください。";
      try {
        abortController.abort();
      } catch (_) {}
    }, IDLE_TIMEOUT_MS);
  };

  let errorReported = false;
  const reportError = (msg) => {
    if (errorReported) return;
    errorReported = true;
    try {
      handlers.onError && handlers.onError(new Error(msg));
    } catch (_) {}
  };

  const done = (async () => {
    try {
      // Sprint 7: x-user-uuid ヘッダを付与（apiFetch 経由では SSE が読みづらいので手動）
      const headers = { "Content-Type": "application/json" };
      const uuid = state.getUserUuid();
      if (uuid) headers["x-user-uuid"] = uuid;

      const res = await fetch("/api/consult/stream", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      if (!res.ok) {
        let errMsg = "エラーが発生しました。";
        try {
          const data = await res.json();
          if (data && data.error) errMsg = data.error;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream") || !res.body) {
        throw new Error("ストリーミングレスポンスを受信できませんでした。");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let streamStarted = false;
      let serverFinalReply = null;
      let serverAssistantMessageId = null;
      let serverPersisted = undefined;
      let serverSignaledError = null;
      resetIdleTimer();

      const handleEvent = (eventName, dataStr) => {
        let parsed;
        try {
          parsed = JSON.parse(dataStr);
        } catch (_) {
          return;
        }
        if (eventName === "delta" && parsed && typeof parsed.text === "string") {
          streamStarted = true;
          try {
            handlers.onDelta && handlers.onDelta(parsed.text);
          } catch (_) {}
        } else if (eventName === "error" && parsed && parsed.error) {
          serverSignaledError = parsed.error;
        } else if (eventName === "done") {
          if (parsed && typeof parsed.reply === "string") {
            serverFinalReply = parsed.reply;
          }
          if (parsed && typeof parsed.assistantMessageId === "string") {
            serverAssistantMessageId = parsed.assistantMessageId;
          }
          if (parsed && typeof parsed.persisted === "boolean") {
            serverPersisted = parsed.persisted;
          }
        }
      };

      while (true) {
        const { value, done: rd } = await reader.read();
        if (rd) break;
        resetIdleTimer();
        buffer += decoder.decode(value, { stream: true });

        let sep;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          let eventName = "message";
          const dataLines = [];
          for (const line of rawEvent.split("\n")) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          }
          if (dataLines.length === 0) continue;
          handleEvent(eventName, dataLines.join("\n"));
        }
      }

      if (serverSignaledError) {
        throw new Error(serverSignaledError);
      }
      if (!streamStarted) {
        throw new Error(
          "AIからの回答を取得できませんでした。しばらくしてからもう一度お試しください。"
        );
      }

      try {
        handlers.onDone &&
          handlers.onDone({
            reply: serverFinalReply,
            assistantMessageId: serverAssistantMessageId,
            persisted: serverPersisted,
          });
      } catch (_) {}
    } catch (err) {
      let msg;
      if (timedOutReason) {
        msg = timedOutReason;
      } else if (err && err.name === "AbortError") {
        msg =
          "AIからの回答を取得できませんでした。しばらくしてからもう一度お試しください。";
      } else {
        msg = (err && err.message) || "通信エラーが発生しました。もう一度お試しください。";
      }
      reportError(msg);
    } finally {
      clearTimeout(overallTimer);
      if (idleTimer) clearTimeout(idleTimer);
    }
  })();

  return {
    cancel() {
      try {
        abortController.abort();
      } catch (_) {}
    },
    done,
  };
}
