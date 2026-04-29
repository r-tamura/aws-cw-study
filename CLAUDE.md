# aws-cw-study

Amazon CloudWatch を体系的に学ぶための mdBook プロジェクト。

## リッチ UI 機能を積極的に使う

Claude Code が提供する構造化 UI のツールがあれば、プレーンテキストで聞いたり羅列したりするより、必ずそちらを優先すること。

### 必ず使う

- **`AskUserQuestion`**: 2〜4 個の明確な選択肢を提示できる質問は、本文中の箇条書きで聞かずにこのツールを使う。複数質問は1回にまとめる。推奨選択肢は先頭に置きラベル末尾に `(Recommended)` を付ける。`multiSelect: true` で複数選択可。`preview` フィールドで mermaid・コード・設定例を比較表示できる。
- **`TaskCreate` / `TaskUpdate` / `TaskList`**: 3 ステップ以上の作業はタスク化する。開始時に `in_progress`、完了直後に `completed`（バッチ更新しない）。1〜2 ステップで終わる作業はタスク化しない。
- **`Skill` ツール**: 本プロジェクトに登録されたスキル（`.claude/skills/` 配下）が該当しそうなら必ず Skill ツール経由で呼ぶ。スキル名のみ言及して呼ばないのは禁止。

### 状況に応じて使う

- **`Bash` の `run_in_background`**: `mdbook serve` などの長期実行は必ずバックグラウンド化。前景で詰めない。
- **`Monitor`**: 1 回完了の待機は `Bash run_in_background` で `until` ループ、複数回通知が必要なら `Monitor`。
- **`mcp__aws-knowledge-mcp__*`**: AWS の最新仕様確認はこの MCP を最優先（一般知識より優先）。

### 使わない / 注意

- **Plan モード**: ユーザーが Shift+Tab で入るもの。こちらから `EnterPlanMode` を呼ばない。
- **「他のもっとリッチな UI が後で出てきたら」**: 新しいツールが利用可能になったら、その都度プロンプトの本文ではなくこの CLAUDE.md に追記する運用とする。

## 本書執筆の方針

### 構成

- mdBook + `mdbook-mermaid` プラグイン
- ソース: `src/` 以下、章ファイルは `partN/NN-name.md`
- ビルド成果物 `book/` は `.gitignore` 済み
- mermaid アセット (`mermaid.min.js` / `mermaid-init.js`) はリポジトリに含める

### 図

- 原則は **mermaid を Markdown に直書き**（` ```mermaid ` ブロック）
- 静的 SVG が必要なときだけ `@mermaid-js/mermaid-cli@11.12.0` で書き出す
- 詳細は `.claude/skills/diagram/SKILL.md`

### ハンズオン

- 全章共通で **CDK + Serverless** 構成
- IaC は **CDK (TypeScript)**、Lambda は **TypeScript と Python の両方**を使う
- EC2 / EKS は「Serverless で書けない」と判断したときのみ
- 配置: `handson/chapter-NN/`、内部に `lambda-ts/` `lambda-py/` `lib/` `bin/`

### 執筆順

- **座学（概念・仕様）を全章先行**で書き切る → ハンズオンは後でまとめて埋める
- 各章は「概念 → 全体像 → 主要仕様 → 設計判断のポイント → ハンズオン（TODO 可） → まとめ」の流れ

### スコープ判断

- **本書の最終ゴール**: CloudWatch コンソール左メニューの**全項目（11 項目）について、その概念と解決する課題を説明できる**こと
- **MVP（フェーズ 1）**: 第 I 部（基礎 2 章） + 第 II 部（中核 4 章） + 第 III 部（アプリオブザーバビリティ 4 章） = 計 10 章 + 付録 3 本
- **フェーズ 2**: 残りメニュー項目を必ず網羅
  - 取り込み（Ingestion / Pipelines）
  - インフラストラクチャモニタリング（Container / Database / Lambda Insights）
  - ネットワークモニタリング（Internet Monitor / Network Flow Monitor）
  - AI オペレーション（CloudWatch Investigations）
  - 生成 AI オブザーバビリティ（Bedrock AgentCore、MCP 連携）
  - セットアップ（Cross-account、OAM、Log Centralization）
- EventBridge は本書スコープ外
