# Sprint 3 評価レポート（最終スプリント）

## テスト環境
- URL: http://localhost:3000
- 日時: 2026-04-14
- テスト方法: HTTP通信によるAPI動作検証、HTML/CSS/JS静的解析、curlによるエンドポイントテスト
- 備考: ANTHROPIC_API_KEYが未設定のため、AI回答は「APIキーが設定されていません」エラーで返却される。エラーハンドリングの動作はこの環境で検証済み。Playwright MCP未使用のため、ブラウザ動作はソースコード解析による間接検証。

## Sprint 3 受け入れ基準テスト結果

### Feature 4: 相談カテゴリ選択 (P1)

| # | 基準 | スコア | 詳細 |
|---|------|--------|------|
| 4-1 | カテゴリ選択UIが相談入力フォームの近くに表示されている | 10 | `div.category-section` が `div.input-area` 内に配置されており、テキスト入力フォームの直上に表示される。HTMLのHTTPレスポンスで `<div class="category-section">` が `<form id="consult-form">` の直前に存在することを確認。CSSで `margin-bottom: 12px` により適度な間隔が確保されている。「相談カテゴリ（任意）:」ラベルも付与され、ユーザーに任意選択であることが明示されている。 |
| 4-2 | 少なくとも4つ以上のカテゴリが選択肢として存在する | 10 | 6つのカテゴリボタンが存在: 「仕事」「人間関係」「健康」「日常生活」「恋愛」「お金」。HTMLで `<button type="button" class="category-button" data-category="...">` として6つ確認。4つ以上の基準を大きく超えている。カテゴリも相談アプリとして妥当な分類。 |
| 4-3 | カテゴリを1つ選択できる | 10 | app.jsのカテゴリボタンクリックハンドラで、クリック時に `categoryButtons.forEach((b) => b.classList.remove("active"))` で全ボタンの選択を解除してから、クリックされたボタンに `active` クラスを付与。`selectedCategory` 変数に選択値を保持。同じボタンを再クリックすると `selectedCategory === category` の条件でトグル解除される。ラジオボタン的な排他選択が正しく実装されている。 |
| 4-4 | 選択中のカテゴリが視覚的にハイライトされる | 10 | `.category-button.active` CSSルールで、背景色が `var(--color-accent)` (#d4845a, 暖色系オレンジ)、文字色が `#fff`（白）、ボーダーも `var(--color-accent)` に変化。未選択状態の `var(--color-bg)` (#fdf6f0) + `var(--color-text)` (#4a3728) と明確にコントラストが異なり、選択状態が一目で判別可能。ホバー時のスタイル（`.category-button:hover`）も別途定義されている。 |
| 4-5 | カテゴリ未選択でも相談を送信できる（任意選択） | 10 | フォーム送信処理（`form.addEventListener("submit", ...)`）内で、カテゴリの選択状態は送信可否の判定に一切使用されていない。バリデーションは `message` の空欄チェックと文字数上限チェックのみ。`selectedCategory` が `null` でも `fetch` リクエストは正常に送信される。サーバー側（server.js）でも `category` は任意パラメータとして扱われ、`if (category && typeof category === "string" && category.trim() !== "")` の条件で存在する場合のみシステムプロンプトに追記される。curlテストでカテゴリなしの送信が正常にAPIキーエラー（バリデーション通過後のエラー）に到達することを確認。 |
| 4-6 | 選択したカテゴリがAIの回答内容に反映される | 9 | server.jsの `/api/consult` エンドポイントで、カテゴリが送信された場合にシステムプロンプトへ `現在のユーザーの相談カテゴリは「${category}」です。このカテゴリに特に関連したアドバイスや視点を意識して回答してください。` を追加する処理を確認。クライアント側でも `body: JSON.stringify({ messages: conversationHistory, category: selectedCategory })` で選択カテゴリをサーバーに送信する処理を確認。curlテストで `{"message":"テスト","category":"仕事"}` を送信し、APIキー不足エラーに到達（カテゴリパラメータがバリデーション通過後に処理される流れを確認）。-1点: ANTHROPIC_API_KEY未設定のため、実際のAI回答にカテゴリが反映されるかの直接検証は不可。 |

**Feature 4 平均スコア: 9.83**

### Feature 7: ウェルカムメッセージ (P2)

| # | 基準 | スコア | 詳細 |
|---|------|--------|------|
| 7-1 | ページ読み込み完了時にウェルカムメッセージが画面に表示されている | 10 | `DOMContentLoaded` イベントリスナー内で、初期化処理の一環として `showWelcomeMessage()` が呼び出される（app.js 19行目）。ウェルカムメッセージは `id="welcome-message"` のdiv要素として `chatMessages` コンテナに追加され、ページ読み込み直後に表示される。CSSクラス `message-welcome` により、AIメッセージと同様のスタイル（左寄せ、クリーム背景）で表示される。 |
| 7-2 | メッセージ内に、相談の始め方や使い方のヒントが含まれている | 10 | ウェルカムメッセージの内容を確認: 「こんにちは！「こころの相談室」へようこそ。」で挨拶、続いて「私はあなたの悩みに寄り添うAIカウンセラーです。」で自己紹介、さらに「【使い方のヒント】」セクションで4項目のガイドを提供。具体的には: (1) カテゴリ選択の案内、(2) テキスト入力と送信方法、(3) 会話の継続について、(4) 新しい相談の始め方。相談の始め方と使い方が網羅的に説明されている。 |
| 7-3 | 「新しい相談を始める」実行後にもウェルカムメッセージが再表示される | 10 | `newConsultationButton` のクリックイベントハンドラ（app.js 73-83行目）で、`chatMessages.innerHTML = ""` によりチャット領域をクリアした直後に `showWelcomeMessage()` が呼び出される。これにより、新しい相談開始後もウェルカムメッセージが再表示される。また、フォーム送信時には `const welcome = document.getElementById("welcome-message"); if (welcome) { welcome.remove(); }` によりウェルカムメッセージが除去されるため、会話中は表示されず、リセット後に再表示される設計。 |

**Feature 7 平均スコア: 10.00**

### Feature 8: 入力中のリアルタイムフィードバック (P2)

| # | 基準 | スコア | 詳細 |
|---|------|--------|------|
| 8-1 | テキスト入力中に現在の文字数がリアルタイムで表示される | 10 | `input.addEventListener("input", () => { updateCharCount(); })` でテキストエリアの入力イベントを監視。`updateCharCount()` 関数内で `charCount.textContent = \`${len} / ${MAX_CHARS}\`` により、現在の文字数と上限を「0 / 1000」形式でリアルタイム更新。HTMLの初期状態でも `<span id="char-count" class="char-count">0 / 1000</span>` が表示されており、HTTPレスポンスで確認済み。CSSで `.char-count-wrapper` は `text-align: right` で入力欄の右下に配置。 |
| 8-2 | 上限文字数が設定されており、上限に近づくと警告色に変わる | 10 | `MAX_CHARS = 1000` で上限文字数を定義、`WARN_THRESHOLD = 900` で警告閾値を定義。`updateCharCount()` 関数で `len >= WARN_THRESHOLD` の場合に `charCount.classList.add("warning")` を適用。CSSの `.char-count.warning` で `color: #e67e22`（オレンジ警告色）と `font-weight: 600` が設定され、視覚的に警告状態が明示される。上限超過時（`len > MAX_CHARS`）は `.char-count.over` で `color: var(--color-error)` (#c0392b, 赤)と `font-weight: 700` でさらに強い警告表示。3段階（通常→警告→超過）のフィードバックが実装されている。 |
| 8-3 | 上限文字数を超えると送信ボタンが非活性になる | 10 | `updateCharCount()` 関数内で `if (len > MAX_CHARS) { charCount.classList.add("over"); sendButton.disabled = true; }` により、1000文字超過時に送信ボタンが非活性化される。さらにフォーム送信ハンドラでも `if (input.value.length > MAX_CHARS)` のサーバーサイドバリデーション（クライアント側二重チェック）が実装されている。ローディング中の状態管理も考慮されており、`setLoading(false)` の後に `updateCharCount()` を呼び出して、ローディング終了後も文字数に応じたボタン状態が正しく復元される。 |

**Feature 8 平均スコア: 10.00**

## Sprint 1-2 回帰テスト

| # | 項目 | 結果 | 詳細 |
|---|------|------|------|
| R-1 | テキスト入力・送信動作 | PASS | `<textarea id="message-input">` と `<button type="submit" id="send-button">送信する</button>` がHTMLに存在。フォーム送信ハンドラで `fetch("/api/consult", ...)` によるAPI通信処理を確認。curlでAPIエンドポイントへの送信が正常に動作することを確認。 |
| R-2 | 空欄バリデーション | PASS | クライアント側: `if (!message)` で空文字チェック → `showError("相談内容を入力してください。")` 表示。サーバー側: curlで空メッセージ送信 → `{"error":"相談内容を入力してください。"}` (HTTP 400) を確認。空白のみ（`"  "`）も正しく拒否されることを確認。 |
| R-3 | ローディング表示 | PASS | `setLoading(true)` で `loading-indicator` div（バウンスアニメーション付き3ドット + 「回答を考えています...」テキスト）をDOMに追加。`setLoading(false)` で除去。CSSの `@keyframes bounce` アニメーションも定義済み。ローディング中は `sendButton.disabled = true` と `input.disabled = true` で入力を無効化。 |
| R-4 | エラー表示 | PASS | APIキー未設定時のエラーレスポンス `{"error":"APIキーが設定されていません..."}` をcurlで確認。クライアント側で `addMessage(err.message, "error")` によりエラーメッセージがチャット領域に表示される処理を確認。`.message-error` CSSクラスで赤色背景・中央配置のエラー表示スタイルが定義済み。 |
| R-5 | 暖色系デザイン維持 | PASS | CSS変数が維持されている: `--color-bg: #fdf6f0`（ベージュ）、`--color-header: #e8a87c`（ピーチ）、`--color-accent: #d4845a`（テラコッタ）、`--color-user-bubble: #fce4d6`（淡ピーチ）、`--color-ai-bubble: #fff8f2`（ライトクリーム）。全体的に暖色系パレットが維持されている。 |
| R-6 | 会話履歴の時系列表示 | PASS | `addMessage()` で `chatMessages.appendChild(div)` により送信順にDOMへ追加。`conversationHistory` 配列でuser/assistant双方のメッセージを保持しサーバーへ送信。curlで複数ターンの会話履歴送信を確認済み。 |
| R-7 | ユーザー/AI発言の視覚的区別 | PASS | ユーザー: 右寄せ (`align-self: flex-end`) + ピーチ背景 + 「あなた」ラベル。AI: 左寄せ (`align-self: flex-start`) + クリーム背景 + 「AIカウンセラー」ラベル。吹き出し角丸も左右非対称。3つの視覚的区別手段が維持されている。 |
| R-8 | 自動スクロール | PASS | `scrollToBottom()` 関数（`chatMessages.scrollTop = chatMessages.scrollHeight`）が `addMessage()` 末尾および `setLoading(true)` 内で呼び出される。新メッセージ追加・ローディング表示の両方で最下部へスクロールされる。 |
| R-9 | 「新しい相談を始める」ボタン動作 | PASS | ボタンクリックで: (1) `conversationHistory = []`、(2) `chatMessages.innerHTML = ""`、(3) `showWelcomeMessage()`（Sprint 3で追加）、(4) `selectedCategory = null` + カテゴリボタンのactive解除（Sprint 3で追加）、(5) `input.value = ""` + `updateCharCount()`（Sprint 3で追加）、(6) `updateNewConsultationButton()` でボタンdisabled化。Sprint 1-2の機能を維持しつつ、Sprint 3のカテゴリとウェルカムメッセージのリセットも追加。 |
| R-10 | 初期状態でのボタン非活性 | PASS | HTMLで `disabled` 属性が付与。JSでも `updateNewConsultationButton()` を初期化時に呼び出し、`conversationHistory.length === 0` でdisabled設定。CSSで `opacity: 0.4; cursor: not-allowed` で視覚的にも非活性表示。 |

**回帰テスト: 全10項目 PASS（回帰なし）**

## 総合スコアサマリー

### Sprint 3 新機能スコア

| Feature | スコア |
|---------|--------|
| Feature 4: 相談カテゴリ選択 (P1) | 9.83 |
| Feature 7: ウェルカムメッセージ (P2) | 10.00 |
| Feature 8: 入力中のリアルタイムフィードバック (P2) | 10.00 |

### 全基準スコア一覧

| # | 基準 | スコア |
|---|------|--------|
| 4-1 | カテゴリ選択UIが入力フォーム近くに表示 | 10 |
| 4-2 | 4つ以上のカテゴリ選択肢 | 10 |
| 4-3 | カテゴリを1つ選択できる | 10 |
| 4-4 | 選択中カテゴリのハイライト | 10 |
| 4-5 | カテゴリ未選択でも送信可能 | 10 |
| 4-6 | カテゴリがAI回答に反映 | 9 |
| 7-1 | ページ読み込み時にウェルカムメッセージ表示 | 10 |
| 7-2 | 使い方ヒントの記載 | 10 |
| 7-3 | 新しい相談後のウェルカムメッセージ再表示 | 10 |
| 8-1 | 文字数リアルタイム表示 | 10 |
| 8-2 | 上限接近時の警告色変化 | 10 |
| 8-3 | 上限超過時の送信ボタン非活性 | 10 |

### 合格基準チェック

| 基準 | 要件 | 結果 | 判定 |
|------|------|------|------|
| 全基準の平均スコア | >= 7.0 | **9.92** | PASS |
| 個別基準の最低スコア | >= 4 | **9**（4-6） | PASS |
| P0機能のスコア（回帰テスト） | >= 8 | 全項目PASS | PASS |
| 前スプリント機能の回帰 | 回帰なし | 全10項目PASS | PASS |

## 最終判定

**合格 (9.92/10)**

Sprint 3の全3機能（相談カテゴリ選択、ウェルカムメッセージ、入力中のリアルタイムフィードバック）は、受け入れ基準をほぼ完璧に満たしている。唯一の減点はカテゴリのAI回答反映（4-6）で、実装は正しく行われているが、ANTHROPIC_API_KEY未設定環境のため実際のAI回答での反映を直接検証できなかったことによる-1点のみ。

Sprint 1-2の回帰テストも全10項目PASSで、過去機能への影響は一切確認されなかった。むしろSprint 3の実装により、「新しい相談を始める」ボタンの動作がカテゴリリセットやウェルカムメッセージ再表示を含むようになり、UXが向上している。

## プロジェクト全体サマリー

| Sprint | スコア | 主要機能 |
|--------|--------|----------|
| Sprint 1 | 9.44/10 | テキスト入力・送信、AI回答表示、暖色系デザイン |
| Sprint 2 | 9.38/10 | 会話履歴表示、新しい相談を始める機能 |
| Sprint 3 | 9.92/10 | カテゴリ選択、ウェルカムメッセージ、文字数フィードバック |
| **最終平均** | **9.58/10** | |
