# Chapter 04: Logs ハンズオン

CloudWatch Logs を「構造化ログ → Logs Insights → Live Tail → Pattern analysis → Metric Filter」の流れで触る最小スタック。

## 構成

```
API Gateway HTTP API
  ├─ /api  → Lambda (TypeScript, api-handler) — INFO/WARN/ERROR を確率的に JSON で出す
  └─ /work → Lambda (Python,     worker)      — ジョブのライフサイクルを構造化ログで出す
```

- 各 Lambda に **1 週間保持の LogGroup** を明示的に紐付け
- TS Lambda のロググループに **Metric Filter** を仕込み、`level = "ERROR"` のログを namespace `AwsCwStudy/Ch04` のメトリクス `Ch04ErrorCount` にカウントアップ

## デプロイ

```bash
cd handson/chapter-04
npm install
npx cdk bootstrap   # 初回のみ (リージョン × アカウント単位)
npx cdk deploy
```

デプロイが終わると `ApiUrl` / `ApiHandlerLogGroupName` / `WorkerLogGroupName` が出力される。以降のスニペットは下記環境変数を前提にしている。

```bash
export STACK=AwsCwStudyCh04Logs
export API_URL=$(aws cloudformation describe-stacks --stack-name $STACK \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
export API_LG=$(aws cloudformation describe-stacks --stack-name $STACK \
  --query "Stacks[0].Outputs[?OutputKey=='ApiHandlerLogGroupName'].OutputValue" --output text)
export WORK_LG=$(aws cloudformation describe-stacks --stack-name $STACK \
  --query "Stacks[0].Outputs[?OutputKey=='WorkerLogGroupName'].OutputValue" --output text)
```

## トラフィック投入

ログを溜めるために、別ターミナルで `curl` ループを流す。

```bash
while true; do
  curl -s "$API_URL/api"  >/dev/null
  curl -s "$API_URL/work" >/dev/null
  sleep 1
done
```

数十秒回すと、`api-handler` が概ね `INFO` 主体・10% 程度 `ERROR`・20% 程度 `WARN` というレベル分布で構造化ログを書いていく。

## Logs Insights クエリ例

CloudWatch コンソール → **Logs Insights** で `$API_LG` を選び、以下を貼って `Run query`。

### 1. レベル別の時系列

```text
fields @timestamp, level
| filter ispresent(level)
| stats count(*) as n by bin(1m), level
| sort @timestamp asc
```

`level` 軸でスタックチャートを表示すると、`ERROR` が一定割合で混ざっていることが見える。

### 2. Pattern analysis (Top 5)

```text
fields @message
| pattern @message
| sort @count desc
| limit 5
```

`pattern @message` は CloudWatch が自動で似たメッセージをクラスタリングするコマンド。`request failed`, `received`, `completed` などの代表パターンが上位に並ぶ。

### 3. ERROR レコードを `requestId` 付きで一覧

```text
fields @timestamp, level, msg, requestId, errorCode, durationMs
| filter level = "ERROR"
| sort @timestamp desc
| limit 20
```

`errorCode` (`E_DOWNSTREAM_TIMEOUT` / `E_VALIDATION`) ごとに `stats count(*) by errorCode` に変えて集計するのも有効。

### 4. ERROR 率の時系列 (5 分ビン)

```text
fields @timestamp, level
| stats count(*) as total,
        sum(level = "ERROR") as errors,
        errors / total * 100 as errorRatePct
        by bin(5m)
```

`errorRatePct` を可視化すれば SLO アラートの素材になる。

### 5. Python ワーカー側のジョブ所要時間 P95

`$WORK_LG` を選んで:

```text
fields @timestamp, jobId, durationMs
| filter ispresent(durationMs)
| stats pct(durationMs, 95) as p95, pct(durationMs, 50) as p50, count(*) as n by bin(1m)
```

## Live Tail

CloudWatch Logs Live Tail で「いま流れているログ」をリアルタイムに眺める。CLI からも叩ける。

```bash
# AWS CLI (v2.13+) の Live Tail。 LogGroup ARN を取得して渡す
API_LG_ARN=$(aws logs describe-log-groups --log-group-name-prefix "$API_LG" \
  --query "logGroups[0].arn" --output text)

aws logs start-live-tail \
  --log-group-identifiers "$API_LG_ARN" \
  --log-event-filter-pattern '{ $.level = "ERROR" }'
```

`--log-event-filter-pattern` を付けないと全レベル流れる。`Ctrl-C` で停止。

## Metric Filter で ERROR を可視化

`level=ERROR` のログ件数は CloudWatch メトリクス **`AwsCwStudy/Ch04 / Ch04ErrorCount`** に自動集約される。

```bash
aws cloudwatch get-metric-statistics \
  --namespace "AwsCwStudy/Ch04" \
  --metric-name "Ch04ErrorCount" \
  --start-time $(date -u -v-15M +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d '-15 min' +"%Y-%m-%dT%H:%M:%SZ") \
  --end-time   $(date -u +"%Y-%m-%dT%H:%M:%SZ") \
  --period 60 \
  --statistics Sum
```

このメトリクスは Ch 5 (Alarms) の演習で「しきい値アラーム」を載せる素材としても使える。

## 片付け

```bash
npx cdk destroy
```

`cdk destroy` で Lambda / API Gateway / IAM ロール / 明示的に作った LogGroup（このスタックでは `removalPolicy=DESTROY` を付けてある）はまとめて消える。万一残った場合は手動で:

```bash
aws logs delete-log-group --log-group-name "$API_LG"
aws logs delete-log-group --log-group-name "$WORK_LG"
```

カスタムメトリクスは保持期間 (デフォルト 15 ヶ月) で自動失効する。
