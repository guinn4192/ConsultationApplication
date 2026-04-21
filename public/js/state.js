// state.js — Sprint 6/7: single source of truth.
// Sprint 7 で DB 永続化する際も同じ形状（id/role/content/mode/category/createdAt
// + emotion.{id,messageId,emojiValue,createdAt}）を流用する（DESIGN.md 付録 A）。

const LS_KEY_UUID = "consultationApp.userUuid";
const LS_KEY_NAME = "consultationApp.userName";

const genUuid = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: RFC4122 v4 相当の擬似 UUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// ブラウザ側の永続化ストレージから初期値を読む
function readLsSafe(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

// 内部状態（モジュール外から直接書かせない）
const _state = {
  userUuid: readLsSafe(LS_KEY_UUID), // Sprint 7: localStorage から初期化
  userName: readLsSafe(LS_KEY_NAME),
  sessionId: null, // 初回送信時に採番、または再開時に上書き
  sessionMessages: [], // [{ id, role, content, mode, category, createdAt, state }]
  emotions: [], // [{ id, messageId, emojiValue, createdAt }]
  isStreaming: false,
  selectedCategory: null,
  selectedMode: "default",
};

// R3 対策: message.state 遷移を購読できるよう event emitter 的 API を用意。
const _listeners = {
  messageDone: new Set(), // (message) => void
  emotionRecorded: new Set(), // ({ messageId, emojiValue }) => void
};

export const state = {
  // ---- 読み取り ----
  getUserUuid() {
    return _state.userUuid;
  },
  getUserName() {
    return _state.userName;
  },
  getSessionId() {
    return _state.sessionId;
  },
  getMessages() {
    return _state.sessionMessages.slice();
  },
  getEmotions() {
    return _state.emotions.slice();
  },
  isStreaming() {
    return _state.isStreaming;
  },
  getSelectedCategory() {
    return _state.selectedCategory;
  },
  getSelectedMode() {
    return _state.selectedMode;
  },

  /**
   * Claude API に渡す { role, content } のみの配列を返す。
   */
  getApiMessages() {
    return _state.sessionMessages.map((m) => ({ role: m.role, content: m.content }));
  },

  /**
   * 最新（= 直近）の絵文字記録を返す。なければ null。
   * Feature 15 の lastEmotion 送信に使う。
   */
  getLastEmotionValue() {
    if (_state.emotions.length === 0) return null;
    return _state.emotions[_state.emotions.length - 1].emojiValue;
  },

  /**
   * 特定 messageId に対する最新の emojiValue（なければ null）。
   * emotion セレクタの .active 復元・変更時に使う。
   */
  getEmotionForMessage(messageId) {
    for (let i = _state.emotions.length - 1; i >= 0; i--) {
      if (_state.emotions[i].messageId === messageId) {
        return _state.emotions[i].emojiValue;
      }
    }
    return null;
  },

  // ---- 書き込み ----

  /**
   * Sprint 7: オンボーディング完了時、または GET /api/user/:uuid 確認時に呼ぶ。
   * localStorage にも同期する。null を渡すとクリア。
   */
  setUserUuid(uuid) {
    _state.userUuid = uuid || null;
    try {
      if (uuid) localStorage.setItem(LS_KEY_UUID, uuid);
      else localStorage.removeItem(LS_KEY_UUID);
    } catch (_) {}
  },

  setUserName(name) {
    _state.userName = name || null;
    try {
      if (name) localStorage.setItem(LS_KEY_NAME, name);
      else localStorage.removeItem(LS_KEY_NAME);
    } catch (_) {}
  },

  clearUser() {
    this.setUserUuid(null);
    this.setUserName(null);
  },

  ensureSessionId() {
    if (!_state.sessionId) {
      _state.sessionId = genUuid();
    }
    return _state.sessionId;
  },

  /**
   * Sprint 7 Feature 21: 再開モーダル「続きから」選択時に、サーバ DB の sessionId に差し替える。
   */
  setSessionId(sessionId) {
    _state.sessionId = sessionId || null;
  },

  setSelectedCategory(value) {
    _state.selectedCategory = value;
  },

  setSelectedMode(value) {
    _state.selectedMode = value;
  },

  setStreaming(flag) {
    _state.isStreaming = !!flag;
  },

  /**
   * ユーザー発言を追加。id を採番して返す。
   */
  addUserMessage(content) {
    const id = genUuid();
    _state.sessionMessages.push({
      id,
      role: "user",
      content,
      mode: _state.selectedMode,
      category: _state.selectedCategory,
      createdAt: new Date().toISOString(),
      state: "done",
    });
    return id;
  },

  /**
   * ストリーミング中のアシスタントメッセージ枠を作成（まだ本文なし）。
   * state: "streaming"。
   */
  addStreamingAssistantMessage() {
    const id = genUuid();
    _state.sessionMessages.push({
      id,
      role: "assistant",
      content: "",
      mode: null,
      category: null,
      createdAt: new Date().toISOString(),
      state: "streaming",
    });
    return id;
  },

  /**
   * ストリーミング中のアシスタントメッセージ本文を更新。
   */
  updateStreamingAssistant(id, newContent) {
    const m = _state.sessionMessages.find((x) => x.id === id);
    if (m && m.role === "assistant") {
      m.content = newContent;
    }
  },

  /**
   * Sprint 7: サーバが返した assistantMessageId でクライアント採番 id を差し替える。
   * これにより DB の messages.id と state の id が揃う。
   */
  replaceAssistantMessageId(oldId, newId) {
    if (!oldId || !newId || oldId === newId) return;
    const m = _state.sessionMessages.find((x) => x.id === oldId);
    if (m && m.role === "assistant") {
      m.id = newId;
    }
    // 既に絵文字が紐付いていた場合も新 id に更新
    for (const e of _state.emotions) {
      if (e.messageId === oldId) e.messageId = newId;
    }
  },

  /**
   * ストリーミング完了を通知。state を "done" に遷移し、購読者を呼ぶ（R3 対策）。
   */
  markAssistantDone(id, finalContent) {
    const m = _state.sessionMessages.find((x) => x.id === id);
    if (!m || m.role !== "assistant") return;
    if (typeof finalContent === "string" && finalContent.length > 0) {
      m.content = finalContent;
    }
    m.state = "done";
    for (const cb of _listeners.messageDone) {
      try {
        cb(m);
      } catch (_) {
        // listener error は UI を壊さない
      }
    }
  },

  /**
   * ストリーミング途中で失敗 or 中断。枠ごと除去する。
   */
  removeMessage(id) {
    const idx = _state.sessionMessages.findIndex((x) => x.id === id);
    if (idx >= 0) {
      _state.sessionMessages.splice(idx, 1);
    }
  },

  /**
   * 絵文字を記録（新規 / 上書き両方）。history は append-only（DESIGN §5.2）。
   * Sprint 7: リスナー経由で api.js が POST /api/emotions を打つ（main.js で配線）。
   */
  recordEmotion(messageId, emojiValue) {
    const rec = {
      id: genUuid(),
      messageId,
      emojiValue,
      createdAt: new Date().toISOString(),
    };
    _state.emotions.push(rec);
    for (const cb of _listeners.emotionRecorded) {
      try {
        cb({ messageId, emojiValue, sessionId: _state.sessionId });
      } catch (_) {}
    }
    return rec;
  },

  /**
   * Sprint 7 Feature 21 再開時: サーバから取得した messages / emotions をそのまま注入。
   * 既存 state を一旦クリアしてから入れる。
   */
  restoreFromServer({ sessionId, messages = [], emotions = [] }) {
    _state.sessionId = sessionId || null;
    _state.sessionMessages = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      mode: m.mode || null,
      category: m.category || null,
      createdAt: m.createdAt || m.created_at || new Date().toISOString(),
      state: "done",
    }));
    // emotion_records は最新採用（§7.6-3）。ただし state.emotions は append-only のまま保持。
    _state.emotions = emotions
      .slice()
      .sort((a, b) => {
        const ca = a.createdAt || a.created_at || "";
        const cb = b.createdAt || b.created_at || "";
        return ca < cb ? -1 : ca > cb ? 1 : 0;
      })
      .map((e) => ({
        id: e.id,
        messageId: e.messageId || e.message_id || null,
        emojiValue: e.emojiValue || e.emoji_value,
        createdAt: e.createdAt || e.created_at || new Date().toISOString(),
      }));
  },

  /**
   * セッションを初期状態に戻す（「新しい相談」リセット処理）。
   * 選択中のモード/カテゴリは呼び出し側で個別にリセットする。
   * userUuid / userName は保持する（オンボーディングは不要）。
   */
  resetSession() {
    _state.sessionId = null;
    _state.sessionMessages = [];
    _state.emotions = [];
    _state.isStreaming = false;
  },

  // ---- 購読 ----
  onMessageDone(cb) {
    _listeners.messageDone.add(cb);
    return () => _listeners.messageDone.delete(cb);
  },
  onEmotionRecorded(cb) {
    _listeners.emotionRecorded.add(cb);
    return () => _listeners.emotionRecorded.delete(cb);
  },
};

// エクスポート: router / api.js から直接 UUID を採番するため外出し。
export { genUuid };
