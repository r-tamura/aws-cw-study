# Chapter 03: Metrics ハンズオン

Lambda（TypeScript / Python）から **Embedded Metric Format (EMF)** で構造化ログを出力し、CloudWatch にカスタムメトリクスとして取り込む。API Gateway HTTP API でトラフィックを発生させ、Metrics Insights で集計する。

## 構成

- **TS Lambda** (`lambda-ts/order-metrics`): `POST /order` を受けて `OrderCount` / `OrderValue` を emit
- **Python Lambda** (`lambda-py/inventory-metrics`): `GET /inventory` を受けて `InventoryQueries` / `InventoryLatency` を emit
- **HTTP API**: 2 つの Lambda を統合
- 名前空間: `AwsCwStudy/Ch03` / ディメンション: `ServiceName`, `Operation`

## 前提

- AWS アカウントと CDK のブートストラップ済（未済の場合は `npx cdk bootstrap`）
- Node.js 22.x / npm
- `~/.aws/credentials` または環境変数で認証情報設定済

## デプロイ

```bash
cd handson/chapter-03
npm install
npm run build
npx cdk synth          # ローカル検証
npx cdk bootstrap      # 初回のみ
npx cdk deploy
```

`Outputs` に `ApiUrl` が表示される。

## トラフィック投入

```bash
API_URL=$(aws cloudformation describe-stacks \
  --stack-name AwsCwStudyCh03Metrics \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)

while true; do
  curl -s -X POST "$API_URL/order" -d '{}' >/dev/null
  curl -s "$API_URL/inventory" >/dev/null
  sleep 1
done
```

数分間流すとメトリクスが揃う。

## 確認するもの

### 1. メトリクス一覧

CloudWatch コンソール → メトリクス → カスタム名前空間 → `AwsCwStudy/Ch03`

以下 4 つが現れる:

- `OrderCount` (Count)
- `OrderValue` (None)
- `InventoryQueries` (Count)
- `InventoryLatency` (Milliseconds)

### 2. Metrics Insights クエリ

CloudWatch → メトリクス → クエリビルダーで以下を実行:

```sql
SELECT AVG(OrderValue)
FROM SCHEMA("AwsCwStudy/Ch03", ServiceName, Operation)
WHERE ServiceName = 'order-metrics'
GROUP BY Operation
```

```sql
SELECT MAX(InventoryLatency), AVG(InventoryLatency)
FROM SCHEMA("AwsCwStudy/Ch03", ServiceName, Operation)
GROUP BY ServiceName
```

### 3. EMF イベントの実体

`/aws/lambda/AwsCwStudyCh03Metrics-OrderMetrics...` のロググループに `_aws` キー付き JSON ログが書き込まれているのを確認できる。

## 片付け

```bash
npx cdk destroy
```

CloudWatch Logs のロググループは Lambda 削除後も残るため、必要に応じて手動削除する:

```bash
for fn in OrderMetrics InventoryMetrics; do
  aws logs delete-log-group \
    --log-group-name "/aws/lambda/AwsCwStudyCh03Metrics-${fn}..." \
    2>/dev/null || true
done
```

実名前は `aws logs describe-log-groups --log-group-name-prefix /aws/lambda/AwsCwStudyCh03Metrics` で確認する。

## トラブルシューティング

- **`cdk synth` 失敗** → `npm install` を再実行 / Node.js のバージョン確認
- **Lambda が空のレスポンス** → CloudWatch Logs にエラーが出ていないか確認
- **メトリクスが表示されない** → 数分待つ（CloudWatch の集約まで遅延あり）/ EMF の `_aws.CloudWatchMetrics` が valid な JSON か確認
