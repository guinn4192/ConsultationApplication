// api.js — fetch ラッパ。Sprint 6 時点では素通しだが、
// Sprint 7 で x-user-uuid ヘッダ自動付与を差し込めるようにここに集約する。

const OVERALL_TIMEOUT_MS = 60000;
const IDLE_TIMEOUT_MS = 20000;

/**
 * /api/consult/stream を呼び、SSE を 1 行ずつハンドラへ渡す。
 * @param {Object} payload - body 本体（messages / category / mode / lastEmotion ほか）
 * @param {Object} handlers
 * @param {(text: string) => void} handlers.onDelta - 差分テキスト到着時
 * @param {(reply: string) => void} handlers.onDone - 完了通知（サーバ確定 reply）
 * @param {(err: Error) => void} handlers.onError - 失敗時（1 回のみ呼ばれる）
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
      const res = await fetch("/api/consult/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        handlers.onDone && handlers.onDone(serverFinalReply);
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
