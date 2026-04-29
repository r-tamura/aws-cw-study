# Chapter 9 — CloudWatch RUM ハンズオン

S3 + CloudFront に静的サイトを置き、ブラウザに RUM Web SDK を埋め込んで、
ページビュー / 性能 / エラー / HTTP テレメトリを CloudWatch RUM に送信するまでの手順です。

## 構成図

```text
[Browser]
  │  ① ページ取得（HTTPS, OAC 経由）
  ▼
[CloudFront] ── origin ──> [S3 (private)]
  │
  ▼
[Browser] ② RUM SDK が起動
  │  ③ Cognito Identity Pool（未認証）から一時クレデンシャル取得
  │  ④ rum:PutRumEvents で AppMonitor へテレメトリ送信
  ▼
[CloudWatch RUM AppMonitor "aws-cw-study-ch09"]
  ↓  cwLogEnabled: true
[CloudWatch Logs: /aws/vendedlogs/RUMService_*]
```

## 前提

- Node.js 22.x / npm
- AWS CLI v2、`aws configure` 済み
- CDK v2 ブートストラップ済み（`npx cdk bootstrap`）
- デフォルトリージョン: **us-east-1 推奨**（RUM Web SDK の CDN URL が `client.rum.us-east-1.amazonaws.com` のため。
  別リージョンに置く場合は `web/index.html` の CDN URL とエンドポイントを書き換える）

## デプロイ手順（2 段階）

### Stage 1: スタックを作って出力を採取する

```bash
cd handson/chapter-09
npm install
npx cdk bootstrap   # 初回のみ
npx cdk deploy
```

完了後、`cdk deploy` の **Outputs** に以下が出ます。

```
AwsCwStudyChapter09.CloudFrontUrl    = https://dxxxxxxxx.cloudfront.net/
AwsCwStudyChapter09.AppMonitorName   = aws-cw-study-ch09
AwsCwStudyChapter09.AppMonitorIdHint = aws rum get-app-monitor --name aws-cw-study-ch09 --query AppMonitor.Id --output text
AwsCwStudyChapter09.IdentityPoolId   = us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AwsCwStudyChapter09.GuestRoleArn     = arn:aws:iam::123456789012:role/...
AwsCwStudyChapter09.Region           = us-east-1
```

`AppMonitor` の **ID** はスタック出力には現れない（`CfnAppMonitor` は ID をエクスポートしない）ため、AWS CLI で取得します。

```bash
aws rum get-app-monitor --name aws-cw-study-ch09 \
  --query 'AppMonitor.Id' --output text
# 例: 12345678-aaaa-bbbb-cccc-1234567890ab
```

### Stage 2: SDK 設定値を `web/index.html` に貼って再デプロイ

`web/index.html` 内の RUM スニペットに以下のプレースホルダがあります。

```js
'REPLACE_WITH_APP_MONITOR_ID',     // <- Stage 1 で取得した AppMonitor ID
'1.0.0',
'us-east-1',                        // <- Region 出力と揃える
'https://client.rum.us-east-1.amazonaws.com/1.20.0/cwr.js',
{
  identityPoolId: 'REPLACE_WITH_IDENTITY_POOL_ID',
  endpoint: 'https://dataplane.rum.us-east-1.amazonaws.com',
  ...
}
```

`AppMonitorId` と `IdentityPoolId` を実値に書き換え、再デプロイします。

```bash
npx cdk deploy
```

`BucketDeployment` は CloudFront キャッシュも自動でインバリデートします。

## 動作確認

1. ブラウザで `CloudFrontUrl`（例: `https://dxxxx.cloudfront.net/`）を開く
2. ボタンを押して以下を発火させる
   - `/home` `/about` ナビ → 仮想ページビュー
   - **fetch 公開 API** → HTTP テレメトリ
   - **JS エラーを発生させる** → エラーテレメトリ
   - **カスタムイベント送信** → `recordEvent` イベント
3. AWS コンソールで **CloudWatch → RUM → app monitor → `aws-cw-study-ch09`** を開き、
   - **Overview** に Page views / Sessions / Errors のカウントが出ることを確認
   - **Errors** タブで `intentional client error` のスタックトレース
   - **Performance** タブで Core Web Vitals (LCP / INP / CLS)

### Logs Insights でクエリしてみる

`cwLogEnabled: true` にしているので、テレメトリは `/aws/vendedlogs/RUMService_aws-cw-study-ch09<...>`
に流れます。CloudWatch Logs Insights で次を試してください。

```text
fields @timestamp, event_type, event_details.target_id
| sort @timestamp desc
| limit 50
```

エラーだけ抽出するなら:

```text
fields @timestamp, event_details.message, event_details.stack
| filter event_type = 'com.amazon.rum.js_error_event'
| sort @timestamp desc
```

## 片付け

```bash
npx cdk destroy
```

CloudFront ディストリビューションの無効化に数分かかります。`destroy` 完了後、
RUM コンソールから AppMonitor が消え、関連ロググループもスタックの削除と同時に消えます。

> 注: S3 バケットは `autoDeleteObjects: true` のため中身ごと消えます。
> 残らない設計なので、念のためバケットが残っていないか `aws s3 ls` で確認すれば十分です。

## トラブルシュート

| 症状 | 原因 / 対処 |
|------|-------------|
| RUM コンソールに何も出ない | `AppMonitor ID` / `IdentityPoolId` の貼り付け忘れ。`web/index.html` を修正後 `cdk deploy` |
| `403 PutRumEvents` がブラウザコンソールに | AppMonitor 名と IAM ポリシー上の名前が一致していない／別リージョンに作成した |
| CloudFront が 403 | `BucketDeployment` がまだ走っていない／OAC のポリシー反映待ち。1〜2 分待つ |
| Core Web Vitals がゼロ | `telemetries` に `'performance'` が入っているか確認（本ハンズオンは入っている） |

## 参考

- aws-observability/aws-rum-web: https://github.com/aws-observability/aws-rum-web
- CloudWatch RUM ドキュメント: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-RUM.html
