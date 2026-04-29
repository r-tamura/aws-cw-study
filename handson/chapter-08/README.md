# Chapter 8 ハンズオン: Transaction Search

Application Signals の **Transaction Search** をアカウントレベルで有効化し、
第7章でデプロイ済みのスタック（API GW → Checkout Lambda → Inventory Lambda → DynamoDB）から流れてくるスパンを `aws/spans` ロググループに 100% 取り込み、Visual Editor / Logs Insights で検索する一連の流れを試します。

## 前提

- **第7章のスタック (`Chapter07Stack`) がデプロイ済み**であること。Transaction Search は単体ではスパンを作りません。スパンの「送信側」が必要です。
  - 第7章を未デプロイなら先に `cd handson/chapter-07 && npx cdk deploy`
- AWS CLI v2 が `aws configure` 済み（CLI 内部で `xray update-trace-segment-destination` などを呼びます）
- 実行ユーザーに以下の権限があること:
  - `xray:UpdateTraceSegmentDestination`, `xray:GetTraceSegmentDestination`
  - `xray:UpdateIndexingRule`, `xray:GetIndexingRules`
  - `logs:PutResourcePolicy`, `logs:DeleteResourcePolicy`
  - `sts:GetCallerIdentity`

## 構成

```text
[第7章でデプロイ済み]
  Checkout (TS) ──► Inventory (Py) ──► DynamoDB
        │                │
        └─ ADOT/OTel スパン ─► [X-Ray API]
                                     │
              ┌──────────────────────┴──────────────────────┐
              ▼ (このハンズオンで切り替え)                   ▼
   aws/spans ロググループ (100%)             X-Ray インデックス (1%)
              │                                              │
              ▼                                              ▼
   Application Signals → Transaction Search       X-Ray Trace Map
   (Visual Editor / Logs Insights)
```

第7章の Lambda はすでに ADOT で計装済みなので、Transaction Search を有効化するだけで追加実装ゼロでスパンが流れ込みます。

## 1. Transaction Search を有効化

```bash
cd handson/chapter-08
bash enable-transaction-search.sh ap-northeast-1
# または、無料枠に収めたいときは indexing 1%:
# bash enable-transaction-search.sh ap-northeast-1 1
```

スクリプトは以下を行います（[`enable-transaction-search.sh`](./enable-transaction-search.sh) 参照）。

1. **`PutResourcePolicy`**: X-Ray サービスプリンシパルが `aws/spans` および `/aws/application-signals/data` に `PutLogEvents` できるリソースポリシーを作成
2. **`UpdateTraceSegmentDestination`**: スパンの送信先を `CloudWatchLogs` に切替
3. **`UpdateIndexingRule`**: トレースサマリーのインデックス割合を 100%（または引数で指定した値）に設定
4. **`GetTraceSegmentDestination`**: 設定が `Destination=CloudWatchLogs / Status=ACTIVE` であることを確認

> **冪等性**: 同名 `--policy-name` で `put-resource-policy` を呼び直すと上書きされ、`update-trace-segment-destination` `update-indexing-rule` も既存値を上書きするだけです。何度再実行しても安全です。

## 2. トラフィックを流す

第7章のスタックに対して負荷を流します（第7章 README からの再掲）。

```bash
API_URL=$(aws cloudformation describe-stacks \
  --stack-name Chapter07Stack \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)

while true; do
  curl -s -X POST "$API_URL/checkout" -d '{"sku":"ABC-123","qty":1}'
  echo
  sleep 1
done
```

**有効化から 5〜10 分待ち**、スパンが `aws/spans` に到達するのを待ちます。

## 3. Visual Editor で見る

CloudWatch コンソール → **Application Signals → Transaction Search** へ移動します。Visual Editor で 3 つのモードを切り替えながら触ってみます。

### List モード（個別スパンを目視）

- フィルタ: `service.name = CheckoutApi` AND `status.code = ERROR`
- 「在庫切れ時の 409 を返したスパン」を 1 件選び、属性ツリーで `attributes.http.status_code`, `attributes.aws.lambda.invoked_arn` などを確認
- スパン → トレース全体（X-Ray Trace Map）へジャンプ可能

### Timeseries モード（傾向を見る）

- 集計: `avg(durationNano)` group by `service.name`、粒度 1 分
- 期待: `CheckoutApi` のレイテンシが `InventoryApi` より一段太いことを確認（呼び出し側はネスト時間が乗る）

### Group Analysis モード（Top N 分析）

- 集計: `count by attributes.http.status_code`
- 期待: `200` と `409`（在庫切れ）の比率が把握できる

## 4. Logs Insights で同じデータをクエリする

`aws/spans` は普通の CloudWatch Logs ロググループなので、Logs Insights から自由なクエリも書けます。`queries/` ディレクトリに 3 本のサンプルを置いてあります。

| ファイル | 用途 |
|---------|------|
| [`queries/slowest-operations.sql`](./queries/slowest-operations.sql) | 平均レイテンシが遅い操作 Top 5 |
| [`queries/top-customers-affected.sql`](./queries/top-customers-affected.sql) | エラー件数が多い顧客 Top 10 |
| [`queries/error-traces.sql`](./queries/error-traces.sql) | 直近のエラー spans + traceId |

CloudWatch コンソール → **Logs → Logs Insights** で

1. ロググループ `aws/spans` を選択
2. 上記ファイルの中身を貼り付け
3. **Run query**

> Visual Editor は属性ツリーを GUI で組むのに向き、Logs Insights は複数フィールドの結合・サブクエリ的処理に向きます。両方を行き来して使い分けます。

## 5. コストに関する注意

| 軸 | 内容 |
|----|------|
| **Logs Ingestion** | 100% スパン取り込みで `aws/spans` への取り込み量が増える |
| **Logs Storage** | `aws/spans` は既定で永続保存。`aws logs put-retention-policy --log-group-name aws/spans --retention-in-days 7` などで保持期間を絞ることを推奨 |
| **Trace summary indexing** | 既定 1% は **無料枠**。100% にすると X-Ray の indexing 課金が発生 |
| **Logs Insights クエリ** | スキャンしたデータ量で課金 |

検証目的なら、ハンズオン後は速やかに片付けるか、indexing を 1% に戻すのが安全です。

## 6. 片付け

```bash
# 第7章の curl ループを止めてから:
bash disable-transaction-search.sh ap-northeast-1
```

このスクリプト（[`disable-transaction-search.sh`](./disable-transaction-search.sh)）は以下を行います。

1. **`UpdateTraceSegmentDestination --destination XRay`**: 送信先を従来の X-Ray インデックスに戻す
2. **`UpdateIndexingRule`**: Default ルールを 1% に戻す
3. **`DeleteResourcePolicy`**: `TransactionSearchXrayAccess` を削除

`aws/spans` ロググループ自体はストレージ課金が続く可能性があるため、不要なら明示的に削除します。

```bash
aws logs delete-log-group --log-group-name aws/spans --region ap-northeast-1
```

第7章のスタックを片付けるなら、最後に:

```bash
cd ../chapter-07 && npx cdk destroy
```

## トラブルシュート

| 症状 | 原因 / 対処 |
|------|-------------|
| 10 分待っても `aws/spans` が空 | Lambda にトラフィックが流れているか確認（API GW の Invocations メトリクス）。`get-trace-segment-destination` が `Status: ACTIVE` を返すか確認 |
| `AccessDenied` on `PutResourcePolicy` | 実行ユーザーに `logs:PutResourcePolicy` 権限がない |
| Visual Editor に何も出ないが Logs Insights には出る | indexing が 1% のままで、Trace Map 側にだけスパンが反映されていない可能性。`update-indexing-rule` で 100% にしてから 5〜10 分再度待つ |
| 課金が想定より高い | indexing を 1% に戻し、`aws/spans` の retention を短くする |

## 参考

- [Transaction Search 概要](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Transaction-Search.html)
- [Transaction Search の有効化（API 手順）](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Enable-TransactionSearch.html)
- [CloudFormation で有効化する場合](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Transaction-Search-Cloudformation.html) — `AWS::XRay::TransactionSearchConfig` + `AWS::Logs::ResourcePolicy`
