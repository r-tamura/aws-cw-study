# Chapter 7 ハンズオン: Application Signals & SLO

API Gateway → TypeScript Lambda（Checkout）→ Python Lambda（Inventory）→ DynamoDB という典型的なサーバレス構成を CDK で組み、Application Signals が**多言語のサービス連携**をどう可視化するかを確認します。

## アーキテクチャ

```text
[curl loop]
    │ HTTP POST /checkout {"sku":"ABC-123","qty":1}
    ▼
[API Gateway HTTP API]
    │
    ▼
[CheckoutApi (Node.js 22.x / TypeScript)] ──┐
    │ Lambda invoke {op:"decrement", ...}    │
    ▼                                        │ Application Signals
[InventoryApi (Python 3.13)]                 │ (ADOT Lambda Layer)
    │ DynamoDB read/write                    │
    ▼                                        │
[DynamoDB: Inventory] ───────────────────────┘
```

両 Lambda は `@aws-cw-study/common` の `enableAppSignals(fn, runtime)` ヘルパで Application Signals を有効化します。`CfnDiscovery` はスタック内で 1 個だけ作成されます（複数 Lambda で `enableAppSignals` を呼んでも重複しません）。

## 前提

- Node.js 20+ / npm
- Python 3.11+（lambda-py のローカル試験は不要、デプロイのみ）
- AWS CLI / CDK v2 のクレデンシャル設定済み
- Docker（`NodejsFunction` の esbuild バンドル時に使う場合あり。通常はローカル esbuild で済む）

## 1. ビルドとデプロイ

```bash
cd handson/_common && npm install && npm run build
cd ../chapter-07
npm install
npm run build
npx cdk bootstrap   # 初回のみ
npx cdk deploy
```

デプロイ完了後、`Outputs` に表示される `ApiUrl` を控えてください。

## 2. 在庫の初期データ投入

`InventoryApi` を直接 invoke して在庫を仕込みます。

```bash
aws lambda invoke \
  --function-name $(aws cloudformation describe-stack-resources \
      --stack-name Chapter07Stack \
      --logical-resource-id InventoryApi \
      --query 'StackResources[0].PhysicalResourceId' --output text) \
  --payload '{"op":"set","sku":"ABC-123","qty":100000}' \
  --cli-binary-format raw-in-base64-out /tmp/out.json && cat /tmp/out.json
```

## 3. トラフィック投入

別ターミナルで負荷を流します。

```bash
API_URL=<ApiUrl from cdk deploy outputs>
while true; do
  curl -s -X POST "$API_URL/checkout" -d '{"sku":"ABC-123","qty":1}'
  echo
  sleep 1
done
```

## 4. CloudWatch コンソールで確認（5〜10 分待つ）

Application Signals がメトリクスを集計し始めるまで数分かかります。

- **Application Signals → Services**: `CheckoutApi` と `InventoryApi` が一覧に現れる
- **Application Signals → Service Map**: `CheckoutApi → InventoryApi → DynamoDB::Inventory` のトポロジー
- 各サービスの **Service detail** ページで `Latency / Faults / Errors`（RED 指標）が描画される

## 5. SLO を作成

1. Application Signals → **Service Level Objectives → Create SLO**
2. **Service**: `CheckoutApi` を選択
3. **SLI Type**: Request-based を選択
4. **Metric**: Availability（Good request = HTTP 2xx）
5. **Target**: `99.5%`、**Window**: rolling 30 days
6. SLO Recommendations ボタンで AWS 提案値を確認するのも可
7. `Create SLO` をクリック

> Period-based に切り替えると「P99 Latency 300ms 以下のスライス比率」のような目標も設定できます。

## 6. Burn Rate アラーム

Burn Rate は「エラーバジェットを消費している速度」です。SLO 詳細画面の Burn Rate 設定から fast-burn 閾値を作ります。

- **Fast burn**: 1 時間の窓で Burn Rate `> 14.4`（30 日のうち 2 日分の予算を 1 時間で消費）→ 即時通知
- **Slow burn**: 6 時間の窓で Burn Rate `> 6`（同 5 日分を 6 時間で消費）→ オンコールの警告

CloudWatch Alarms 側で SNS トピックに紐付けると Slack / Email に通知できます。

| 用途 | Window | Burn Rate 閾値 | 推奨アクション |
|------|--------|----------------|----------------|
| Fast burn | 1h | > 14.4 | ページャー / オンコール起床 |
| Slow burn | 6h | > 6 | チケット起票 / 翌営業日対応 |

## 7. 期待する結果

- `ApplicationSignals` 名前空間に `Latency` `Error` `Fault` メトリクスが現れる
- Service Map にノード 3 つ（`CheckoutApi` / `InventoryApi` / `DynamoDB::Inventory`）と依存エッジが描かれる
- SLO 詳細ページで Attainment（達成率）と残りエラーバジェットが見える
- 在庫切れになると `CheckoutApi` の HTTP 409 が増え、Errors のメトリクスが上昇する

## 8. 片付け

```bash
npx cdk destroy
```

加えて、コンソールから以下を手動削除してください。

1. 作成した SLO（Application Signals → Service Level Objectives）
2. 作成した Burn Rate アラーム（CloudWatch → Alarms）
3. 残存ロググループ `/aws/lambda/CheckoutApi`、`/aws/lambda/InventoryApi`、`/aws/application-signals/data`
4. （任意）`AWSServiceRoleForCloudWatchApplicationSignals`（次に試すアカウントで再作成される）

## テスト

```bash
npm test
```

CDK の Template assertions で「Lambda 2 つ・DynamoDB 1 つ・HTTP API 1 つ・`CfnDiscovery` 1 つだけ（Lambda が 2 つあっても重複しない）」を検証します。
