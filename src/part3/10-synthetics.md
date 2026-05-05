# Synthetics

CloudWatch Synthetics は、**合成監視（synthetic monitoring）** を提供する機能です。実ユーザーが来るのを待たず、AWS 側から定期的にスクリプトでアクセスを発生させ、可用性とパフォーマンスを監視します。

## RUM と Synthetics の役割分担

両方とも「ユーザー視点の監視」ですが、性質が逆です。

| 観点 | RUM | Synthetics |
|------|-----|-----------|
| 計測の駆動源 | 実ユーザーのアクセス | スケジュール実行 |
| 検出できる問題 | 実環境固有（端末・回線） | サービス側の体系的な問題 |
| トラフィックがない時間帯 | 何も検出できない | 検出できる |
| エンドポイントカバレッジ | 「人が訪れる場所」のみ | 「重要だが訪問が少ない」場所も網羅可能 |
| 主な用途 | 体験品質の継続観測 | SLA・契約監視・リグレッション検知 |

両者は補完関係にあり、AWS Well-Architected の **OPS04-BP03** でも「両方を実装する」ことが推奨されています。

## Canary という単位

Synthetics の管理単位は **Canary** です。1つの Canary は次の構成要素を持ちます。

```text
Canary "shop-checkout-flow"
├─ Code             … スクリプト本体（ヘッドレスブラウザ操作 or APIコール）
├─ Runtime          … 実行環境（Node.js+Puppeteer/Playwright、Python+Selenium、Java+Selenium）
├─ Schedule         … 1分ごと、5分ごと、cron式 等
├─ ExecutionRole    … スクリプトが使う IAM ロール
├─ ArtifactS3       … スクリーンショット・HARファイル・ログの保存先
└─ VpcConfig        … 必要なら VPC 内エンドポイントもテスト可能
```

裏で動いているのは **AWS Lambda** で、起動するたびに料金が発生します。

## ランタイム種別

Canary を作るときに選べるランタイムは大別して 3 系統です。

### Node.js + Puppeteer / Playwright

主流。ヘッドレス Chrome を制御してブラウザ操作を再現します。

- `syn-nodejs-puppeteer-X.Y` 系: Puppeteer ベース
- `syn-nodejs-3.0+`: Playwright ベース。**Multi-checks blueprint** などの新機能はこちらで提供される
- ブラウザは Chrome / Firefox の選択が可能

### Python + Selenium WebDriver

Python で書きたい場合、または既存 Selenium テストを流用したい場合に選択。

### Java + Selenium WebDriver

Java で書きたい場合の選択肢。エンタープライズ系で既存の Selenium テストがある場合に有効。

> **Tip**: 公式ガイドでは「**最新ランタイムを使う**」ことが推奨されています。古いランタイムは [サポートポリシー](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_runtimesupportpolicy.html) で順次廃止されるためです。

## Blueprint（テンプレート）

ゼロからスクリプトを書くのは大変なので、典型ユースケース向けの **Blueprint** がいくつも用意されています。

| Blueprint | 用途 |
|-----------|------|
| **Heartbeat** | 単純な GET、URL の生死確認 |
| **API canary** | REST API のリクエスト・レスポンス検証 |
| **Broken link checker** | ページ内のリンク切れを再帰チェック |
| **GUI workflow** | フォーム送信のような複数ステップ |
| **Visual monitoring** | スクリーンショットを基準画像と比較し、見た目のリグレッションを検出 |
| **Canary recorder** | ブラウザ拡張で操作を録画してスクリプト生成 |
| **Multi-checks** | JSON 設定だけで HTTP/DNS/SSL/TCP の組み合わせチェック（syn-nodejs-3.0+ で追加） |

特に **Multi-checks** は新しく、コードを書かずに JSON 設定だけで「証明書の有効期限チェック → DNS 解決チェック → HTTPS 応答チェック」のような連鎖監視を1 Canary で組めます。

## アーティファクトと結果の見方

Canary が走るたびに以下が記録されます。

- **Pass / Fail / Running** の状態
- スクリーンショット（ヘッドレスブラウザ系）
- HAR ファイル（HTTP 通信ログ）
- スクリプトのログ
- 実行時間、各ステップのタイミング

これらは指定した S3 バケットに保存され、コンソールから直接プレビューできます。失敗した Canary では **失敗時のスクリーンショット**を見るのが第一手です。

## Application Signals との連携

Canary に **X-Ray トレーシングを有効化**すると、Canary が呼んだサーバ側の処理が Application Signals の **Service detail** ページの「Synthetics canaries」タブに表示されます。

```text
[Canary]
  │ X-Ray trace ID 付き HTTPリクエスト
  ▼
[サーバ側 (Application Signals)]
```

これにより、Canary が「失敗した」ときに Service Map から原因サービスへたどれる、という導線ができます。

## アラームと SLO

Canary の Pass/Fail は CloudWatch Metrics の `SuccessPercent` 等として出力されるので、通常のアラーム機構で通知できます。

- 例: 5 連続で `SuccessPercent < 100` なら SNS で通知
- 例: 重要 Canary は SLO の指標として登録（Application Signals SLO は **Canary をメトリクスソースに選択可能**）

## 設計判断のポイント

### 監視頻度

| 用途 | 推奨頻度 |
|------|---------|
| 公開ページの死活 | 5分 |
| 決済等のクリティカルパス | 1分 |
| 月次レポート画面 | 1時間 |
| 業務時間帯のみ | cron で時間帯指定 |

頻度が高いほど Lambda 起動コストが増えます。Visual monitoring は1回あたりの処理が重く、5分以上を推奨。

### スクリプトのべき等性

Canary が「フォーム送信」のような副作用を持つテストをすると、テストデータが本番に蓄積していくリスクがあります。

- テスト用テナント・テスト用ユーザーで実行
- 投入したデータは Canary 内で削除
- もしくはテスト先を **テスト環境**に分離

### `ProvisionedResourceCleanup`

Canary を削除しても、裏で作られた Lambda 関数や IAM ロールが残ることがあります。CloudFormation/CDK で Canary を作るときは、`ProvisionedResourceCleanup` プロパティを有効にして「Canary 削除時に Lambda も一緒に消える」設定にしておくと運用が楽です。

## ハンズオン

[handson/chapter-10/](https://github.com/r-tamura/aws-cw-study/tree/main/handson/chapter-10) に CDK プロジェクトを置いた。1 つのスタックで以下 3 種類の Canary を同時に立ち上げる。

1. **Heartbeat Canary** (`syn-nodejs-puppeteer-9.1`) — `https://aws.amazon.com/` の死活監視
2. **API Canary** (`syn-nodejs-puppeteer-9.1`) — 任意のエンドポイントに GET、200 と本文非空を検査（`--context targetUrl=...` で指定、デフォルトは `https://example.com/`）
3. **Multi-checks Canary** (`syn-nodejs-3.0`、Playwright ベース) — JSON 設定だけで HTTP + DNS + SSL を 1 Canary で連鎖チェック

要点は次の 4 つ。

- アーティファクト用 S3 バケットは 3 Canary で共有し、prefix で分ける（`heartbeat/` / `api/` / `multi-checks/`）
- Puppeteer 系の 2 Canary は **X-Ray アクティブトレーシング**を有効化し、Application Signals の Service detail ページから「Synthetics canaries」タブで参照できる状態にする
- Multi-checks Blueprint は L2 Construct がまだ未対応のため、`CfnCanary.addPropertyOverride('BlueprintTypes', ['multi-checks'])` の **L1 エスケープハッチ** で指定
- `provisionedResourceCleanup: true` を全 Canary に付け、Canary 削除時に裏 Lambda・IAM ロール・ロググループも一緒に消えるようにする

```bash
cd handson/chapter-10
npm install && npm run build
npx cdk deploy                                          # デフォルト URL で実行
npx cdk deploy --context targetUrl=https://my-api.example.com/health
```

デプロイから約 5 分で最初の実行結果が CloudWatch コンソール（Synthetics → Canaries）に出る。失敗時のスクリーンショット・HAR は同コンソールで直接プレビュー可能。`SuccessPercent` メトリクスをアラームソースにすれば、そのまま SLO の指標としても登録できる。

詳細は同ディレクトリの `README.md` を参照。

## 片付け

```bash
cd handson/chapter-10
npx cdk destroy
```

`provisionedResourceCleanup: true` を入れているので、Canary を消した時点で裏で動いていた **Lambda 関数・実行 IAM ロール・CloudWatch ロググループ**が自動的に削除される。S3 アーティファクトバケットも `autoDeleteObjects: true` にしているため、バケット内オブジェクトが消えてからバケットごと削除される。

```bash
# 残骸チェック
aws synthetics describe-canaries \
  --query "Canaries[?starts_with(Name, 'cw-study-')].Name"
# -> []
```

## 参考資料

**AWS 公式ドキュメント**
- [Synthetic monitoring (canaries)](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Canaries.html) — Canary・Blueprint・スケジュール・アーティファクトの総合リファレンス
- [Creating a multi checks blueprint canary](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Canaries_MultiCheck_Blueprint.html) — JSON 設定だけで HTTP / DNS / SSL / TCP を 1 Canary にバンドルする新 Blueprint
- [Runtime versions support policy](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Runtime_Support_Policy.html) — `syn-nodejs-3.0+` を含む各ランタイムの非推奨スケジュール
- [Library functions for Node.js canary scripts using Playwright](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Canaries_Nodejs_Playwright.html) — `syn-nodejs-3.0+` で利用できる Playwright ベースの Canary API リファレンス

**AWS ブログ / アナウンス**
- [Amazon CloudWatch Synthetics now supports bundled multi-check canaries](https://aws.amazon.com/about-aws/whats-new/2025/10/amazon-cloudwatch-synthetics-bundled-multi-check-canaries/) — Multi-checks blueprint 公開（2025/10）
- [AWS CloudWatch Synthetics adds safe canary updates and automatic retries](https://aws.amazon.com/about-aws/whats-new/2025/05/aws-cloudwatch-synthetics-canary-updates-automatic-retries/) — Canary 更新時のセーフテストと自動リトライ（2025/05）

## まとめ

- Synthetics は **能動的な合成監視**で、RUM の受動的な観測と補完関係
- Canary は実態としては **スケジュール起動 Lambda**
- Blueprint で典型ユースケースは即時カバー、複雑なものはスクリプトを書く
- Application Signals に X-Ray 経由でつなぐと、Canary 失敗からサーバ側障害までたどれる
- SLO のメトリクスソースとしても使えるので「契約・SLA 監視」と直結する
