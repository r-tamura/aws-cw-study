# Chapter 05: Alarms ハンズオン

3 種類のアラーム（静的しきい値・Anomaly Detection・Composite）を **同じメトリクス** に対して同時にデプロイし、SNS Email でアラート通知を受け取るところまでを実機で体験する。

## 構成

```
EventBridge (rate 1 min)
        │
        ▼
   Lambda (spike-emitter)         ← EMF を stdout に出力
        │
        ▼
CloudWatch Metric: AwsCwStudy/Ch05.OrderValue
        │
        ├── Alarm: 静的しきい値 (> 800)
        ├── Alarm: Anomaly Detection band (stdev=2)
        └── CompositeAlarm: 上記 2 つの AND
                              │
                              ▼
                          SNS Topic
                              │
                              ▼
                          Email 通知
```

Lambda は 95% のリクエストで 100〜400 程度の値、5% で 1500〜2500 のスパイクを発行する。

## 前提

- Node.js 22 / npm
- AWS CLI 設定済み（`aws sts get-caller-identity` が通る）
- 通知を受け取りたい受信可能なメールアドレス
- まだ実施していなければ `npx cdk bootstrap`

## デプロイ

```bash
cd handson/chapter-05
npm install
npm run build
npm test                                       # 単体テスト
npx cdk synth                                  # CFn テンプレ確認
npx cdk deploy --context email=you@example.com
```

デプロイ直後に届く SNS の確認メール（`AWS Notification - Subscription Confirmation`）から **Confirm subscription** をクリックして購読を有効化する。これを忘れるとアラート時にメールが飛ばない。

## メトリクスの育成（10〜15 分待機）

EventBridge が 1 分間隔で Lambda を起動するので、**最低 10〜15 分** 放置してメトリクス点数を貯める。コンソール側では:

- メトリクス → `AwsCwStudy/Ch05` → `ServiceName, Operation` → `OrderValue`
- 「Statistic = Average」「Period = 1 minute」で時系列がベースライン値（〜250 前後）を中心にバラつき、スパイクが点在することを確認

### Anomaly Detector のトレーニング

CloudWatch の Anomaly Detection モデルは、**最低 14 日間** のデータがあると本番品質のバンドが描けるが、最初の **約 1 時間** で「とりあえず予測バンドを描き始める」状態になる。本ハンズオンの目的は仕組みの確認なので、

- 1 時間程度待つ → 灰色のバンドがコンソールで描画されることを確認
- バンドが落ち着くまで観察したい場合は数時間〜1 日放置するのが理想
- 本番運用で使う場合は **14 日以上の baseline** を確保した上でアラームを有効化するのが推奨

「数日間ベースラインを取ってからアラームを使うべき」点が Ch 5 本文で扱う重要な設計判断。

## アラーム発火の確認（手動スパイク）

ベースラインが溜まったら、Lambda を手動で起動して大きな値を直接書き込む。

```bash
FUNC=$(aws cloudformation describe-stacks \
  --stack-name AwsCwStudyCh05Alarms \
  --query "Stacks[0].Outputs[?OutputKey=='EmitterFunctionName'].OutputValue" \
  --output text)

# 1 分間隔で 10 回、3000 を撃ち込んでアラームを INSUFFICIENT/OK → ALARM に遷移させる
for _ in $(seq 1 10); do
  aws lambda invoke \
    --function-name "$FUNC" \
    --payload '{"value": 3000}' \
    --cli-binary-format raw-in-base64-out \
    /tmp/out.json
  cat /tmp/out.json; echo
  sleep 60
done
```

数分以内に:

1. 静的しきい値アラーム (`AwsCwStudyCh05-OrderValueHigh`) が **ALARM**
2. Anomaly Detection アラーム (`AwsCwStudyCh05-OrderValueAnomaly`) が **ALARM**（バンド外）
3. Composite アラーム (`AwsCwStudyCh05-OrderValueComposite`) が **ALARM**（AND）

の順で点灯し、登録したメールアドレスに通知が届く。

### CLI で状態確認

```bash
aws cloudwatch describe-alarms \
  --alarm-name-prefix "AwsCwStudyCh05-" \
  --query "MetricAlarms[].[AlarmName,StateValue]" \
  --output table

aws cloudwatch describe-alarms \
  --alarm-name-prefix "AwsCwStudyCh05-" \
  --alarm-types CompositeAlarm \
  --query "CompositeAlarms[].[AlarmName,StateValue]" \
  --output table
```

## 期待結果

- **OrderValueHigh**: ベースライン中はほぼ常に OK、自然スパイク or 手動スパイクで ALARM
- **OrderValueAnomaly**: バンドの外にハネた瞬間に ALARM。ベースライン期間が短いと擬陽性が出やすい（章本文で議論）
- **OrderValueComposite**: 単一メトリクスでも「2 種類の検出が同時に陽性」を要求するので、誤検知が片側に出ても発火しない

## 片付け

```bash
npx cdk destroy
```

CloudWatch Logs の Lambda ロググループは `RetentionDays.ONE_WEEK` + `RemovalPolicy.DESTROY` で stack 削除と同時に消える。**Anomaly Detector** はスタックリソースとして消えるが、メトリクス自体（カスタムメトリクスは 15 か月の保持）は AWS 側で自動失効するまで残る点に注意。
