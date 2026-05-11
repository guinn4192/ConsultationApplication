// public/js/dailyMessage.js
// Sprint 8 / Feature 22: 日付 → 「今日のひとこと」算出（純粋関数群）
//
// 設計参照:
// - DESIGN.md §1.7（辞書格納方式 + 2D テーブル算出 + 季節境界）
// - DESIGN.md §7.8.1（純粋関数化と Date 注入）
// - DESIGN.md §7.8.2（決定性 / 冪等性）
// - DESIGN.md §7.8.3（エラーハンドリング: 辞書欠損時フォールバック）
// - DESIGN.md §7.8.4（タイムゾーン: クライアントローカルを受容）
// - DESIGN.md §9 R10 / R11
//
// 全関数は外部状態（current date, locale 等）を一切参照せず、引数で受け取った
// Date オブジェクトのみで結果を決定する。これにより Evaluator が page.clock.install()
// で日付を固定してテストできる。

import {
  MESSAGES,
  WEEKDAY_LABELS,
  SEASON_LABELS,
  DEFAULT_MESSAGE,
} from "./data/dailyMessages.js";

/**
 * Date → 季節キー (DESIGN §1.7 季節境界に厳密に従う)。
 *   春 (spring): getMonth() ∈ {2, 3, 4}   (3〜5月)
 *   夏 (summer): getMonth() ∈ {5, 6, 7}   (6〜8月)
 *   秋 (autumn): getMonth() ∈ {8, 9, 10}  (9〜11月)
 *   冬 (winter): getMonth() ∈ {11, 0, 1}  (12〜2月)
 *
 * @param {Date} date
 * @returns {"spring"|"summer"|"autumn"|"winter"}
 */
export function getSeason(date) {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  // 11, 0, 1 のみ残る
  return "winter";
}

/**
 * Date → 曜日インデックス（0=Sun..6=Sat）。
 * `Date.getDay()` の戻り値をそのまま返す純粋関数。
 * `dailyMessages.js` の配列順と同一規約（R10）。
 *
 * @param {Date} date
 * @returns {number} 0..6
 */
export function getWeekdayIndex(date) {
  return date.getDay();
}

/**
 * 与えられた Date（既定: 今）に対応する「今日のひとこと」情報を返す純粋関数。
 *
 * 同一日（同一曜日・同一季節）であれば常に同じ message が返る決定的関数。
 * 乱数・時刻ハッシュ等の非決定要素は一切使わない（§7.8.2）。
 *
 * @param {Date} [date=new Date()]
 * @returns {{
 *   message: string,
 *   weekdayLabel: string,
 *   seasonLabel: string,
 *   weekdayIndex: number,
 *   season: "spring"|"summer"|"autumn"|"winter",
 * }}
 */
export function getDailyMessage(date = new Date()) {
  const season = getSeason(date);
  const weekdayIndex = getWeekdayIndex(date);

  // 防御的フォールバック (§7.8.3)
  const seasonBucket = MESSAGES[season];
  const rawMessage =
    seasonBucket && typeof seasonBucket[weekdayIndex] === "string"
      ? seasonBucket[weekdayIndex]
      : DEFAULT_MESSAGE;

  const weekdayLabel = WEEKDAY_LABELS[weekdayIndex] || "";
  const seasonLabel = SEASON_LABELS[season] || "";

  return {
    message: rawMessage,
    weekdayLabel,
    seasonLabel,
    weekdayIndex,
    season,
  };
}
