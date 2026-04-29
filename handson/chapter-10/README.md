# Chapter 10: Synthetics ハンズオン

CDK で 3 種類の Canary を一括デプロイし、CloudWatch Synthetics と Application Signals の連携を体験するためのスタックです。

| Canary | 目的 | ランタイム |
|--------|------|-----------|
| `cw-study-heartbeat` | 公開 URL（`https://aws.amazon.com/`）の死活監視 | `syn-nodejs-puppeteer-9.1` |
| `cw-study-api` | 任意の API エンドポイントに GET → 200 / 本文非空を確認 | `syn-nodejs-puppeteer-9.1` |
| `cw-study-multi-checks` | HTTP + DNS + SSL を 1 Canary でまとめてチェック（Multi-checks Blueprint） | `syn-nodejs-3.0`（Playwright） |

すべての Canary で **X-Ray アクティブトレーシング** を有効化しており、Application Signals の Service detail ページ「Synthetics canaries」タブから辿れます。アーティファクト（HAR / スクリーンショット / ログ）は単一の S3 バケットに格納されます。

## 前提

- AWS アカウント / CLI 設定済み（`aws sts get-caller-identity` が通る）
- 初回のみ `npx cdk bootstrap` が必要

## デプロイ

```bash
cd handson/chapter-10
npm install
npm run build
npm test                                  # synth スナップショットチェック

# API canary の宛先はデフォルト https://example.com/。
# 自分の API がある場合は --context で指定。
npx cdk deploy
# もしくは
npx cdk deploy --context targetUrl=https://my-api.example.com/health
```

デプロイ完了後、最初の Canary 実行までは **約 5 分**待ってください（schedule rate 5min）。

## 確認

### CloudWatch Synthetics コンソール

1. AWS マネジメントコンソール → CloudWatch → **Synthetics → Canaries**
2. `cw-study-heartbeat` / `cw-study-api` / `cw-study-multi-checks` の 3 つが並ぶ
3. 各 Canary をクリック → **Status: Passed**、画面下に時系列のグラフ（Success / Duration / Errors）

### S3 アーティファクト

```bash
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name AwsCwStudyCh10Synthetics \
  --query "Stacks[0].Outputs[?OutputKey=='ArtifactBucketName'].OutputValue" \
  --output text)

# 階層: <prefix>/<canary-name>/<run-id>/...
aws s3 ls "s3://${BUCKET}/heartbeat/" --recursive | head
aws s3 ls "s3://${BUCKET}/api/"       --recursive | head
aws s3 ls "s3://${BUCKET}/multi-checks/" --recursive | head
```

`*.har` ファイルが **HTTP 通信ログ**、`*.png` がスクリーンショット、`*.json` がスクリプト実行結果のサマリです。Synthetics コンソールから直接プレビューも可能。

### X-Ray トレース

1. CloudWatch コンソール → **Application Signals → Services**
2. Canary が叩いた先のサービスをクリック
3. 詳細ページ右側のタブから **Synthetics canaries** を選択
4. 直近の Canary 実行が一覧表示される

`activeTracing: true` を入れたことで Canary 実行ごとに X-Ray セグメントが発行され、Application Signals のサービスマップに自動で「Synthetics 起点のトレース」として現れます。**追加コードは不要**です。

### CloudWatch メトリクスでアラーム化

Synthetics は `CloudWatchSynthetics` 名前空間に以下を発行します。

- `SuccessPercent`（直近実行の成功率）
- `Duration`（実行時間）
- `2xx` / `4xx` / `5xx`（リクエスト分類）

例: `SuccessPercent < 100` が 5 連続で続いたら通知 → CloudWatch アラーム → SNS。SLO のメトリクスソースにも選択可能です。

## 片付け

```bash
cd handson/chapter-10
npx cdk destroy
```

`ProvisionedResourceCleanup=AUTOMATIC` を設定しているため、Canary を消すと裏で作られた **Lambda 関数・IAM ロール・CloudWatch ロググループ**が自動的に削除されます。S3 アーティファクトバケットも `autoDeleteObjects: true` のため空にしてから削除されます。

```bash
# 念のため残骸チェック
aws synthetics describe-canaries \
  --query "Canaries[?starts_with(Name, 'cw-study-')].Name"
# -> []
```

## トラブルシュート

| 症状 | 対応 |
|------|------|
| `cdk deploy` で Canary 作成が ROLLBACK_COMPLETE | IAM 権限不足の可能性。`synthetics:CreateCanary` `s3:PutObject` `cloudwatch:PutMetricData` を含む実行ロールを確認 |
| Canary が `ERROR` ステータス | 該当 Canary → Logs タブからスクリプトの stack trace を確認 |
| Multi-checks が「Blueprint not supported」 | リージョン × ランタイムバージョンを再確認。`syn-nodejs-3.0` 以降が必要 |
| X-Ray トレースが Application Signals に出ない | サーバ側でも Application Signals が有効であること（Ch 7 のスタックなど）を確認 |
