# RUM（Real User Monitoring）

CloudWatch RUM は、**実ユーザーのブラウザ・モバイル端末から見た体験**を観測するサービスです。サーバ側の指標がどれだけ良くても、ネットワーク・端末・ブラウザの差で「ユーザー体験」は変わります。RUM はその差を埋めるための情報源です。

## サーバ側監視と何が違うのか

サーバ視点の APM（Application Signals）は「サーバが受け付けたリクエストの処理時間」しか測れません。一方、ユーザーが感じる「画面が出るまでの時間」は次のような要素の総和です。

```text
[ユーザーの端末] ──────────────────────────────────────
  │
  │ 1. ブラウザがHTMLを要求するまで（リダイレクト、DNS、TCP、TLS）
  │ 2. サーバ処理時間 ← サーバ側 APM が測れる範囲はここだけ
  │ 3. HTML受信、JS/CSS/画像の取得
  │ 4. JavaScriptの実行、レンダリング
  │ 5. ユーザーの操作可能になるまで（インタラクティブ）
  ▼
[ユーザーが「速い/遅い」と感じる]
```

**1, 3, 4, 5** はサーバからは見えません。RUM はこれらを実ユーザーの端末で測り、CloudWatch に送ります。

## App Monitor という単位

RUM の管理単位は **App Monitor** です。1つのアプリケーション（Webサイト・モバイルアプリ）に対して1つの App Monitor を作り、そこにテレメトリが集約されます。

```text
App Monitor "shop-frontend"
  ├─ Web SDK が埋まったWebサイト
  ├─ iOS SDK が埋まったiOSアプリ
  └─ Android SDK が埋まったAndroidアプリ
       ↓
       [CloudWatch RUM データストア]
       ↓
       ダッシュボード / 分析 / アラーム
```

## Web RUM

ブラウザに **JavaScript スニペット**を埋め込むことで動作します。SDK は OSS（[aws-observability/aws-rum-web](https://github.com/aws-observability/aws-rum-web)）として公開されています。

### 収集されるデータ

| 種類 | 例 |
|------|-----|
| ページロード性能 | DNS時間、TCP時間、TTFB、DOMContentLoaded、LoadEvent |
| Core Web Vitals | LCP（Largest Contentful Paint）、FID（First Input Delay）、CLS（Cumulative Layout Shift）、INP（Interaction to Next Paint） |
| クライアントエラー | JavaScript の uncaught exception、stack trace |
| ユーザー行動 | ページビュー、クリック、ナビゲーション |
| デバイス情報 | ブラウザ種別、OS、画面サイズ、地理情報 |

### Core Web Vitals の使いどころ

Google の検索ランキングにも使われる UX 指標。RUM では各メトリクスのパーセンタイル（P75 が業界標準）を見て、SEO への影響と UX 品質を同時に追えます。

| 指標 | 良い | 悪い |
|------|------|------|
| LCP | < 2.5s | > 4.0s |
| INP | < 200ms | > 500ms |
| CLS | < 0.1 | > 0.25 |

## モバイル RUM（iOS / Android）

**2025/11 追加**の機能で、CloudWatch RUM がネイティブモバイルアプリの計測に対応しました。実装は **[OpenTelemetry（OTel）](../part4/12-opentelemetry.md)標準**ベースです。

### 収集されるデータ

| 種類 | 内容 |
|------|------|
| アプリ起動時間 | コールドスタート / ウォームスタート |
| 画面ロード時間 | スクリーン単位の表示時間 |
| ネットワークコール | バックエンドAPI呼び出しのレイテンシ・エラー |
| クラッシュ | iOS のクラッシュ、Android のクラッシュ |
| ANR / AppHang | Android の Application Not Responding、iOS の AppHang |

### Web 版との設計の違い

- **OTel 標準**: モバイルは OTel ベースなので、他社 APM と互換性のあるデータ形式
- **シグナル種別**: Web は「ページ単位」、モバイルは「画面（screen）単位」が主単位
- **クラッシュレポート**: モバイルでは shaft重要なため、ネイティブクラッシュとフレームワーク例外の両方を扱う

## Application Signals との連携

RUM データ単体でも価値はありますが、本領を発揮するのは **X-Ray トレーシングと組み合わせた場合**です。

```text
[ユーザーのブラウザ]
  │ RUM SDK が X-Ray trace ID を発行・付与
  ▼
[Web Frontend (CloudFront / S3)]
  │ trace ID 伝播
  ▼
[API Gateway → Lambda (Application Signals 有効)]
  │ 同じ trace ID
  ▼
[DynamoDB]
```

RUM 側で「あるユーザーのページロードが 8 秒かかった」と検知 → 同じ trace ID で **Application Signals の Service Map と Transaction Search を辿れる** → サーバ側のどこで詰まったかが特定できる、という流れが組めます。

## データ保持と外部連携

| 項目 | 値 |
|------|-----|
| RUM 内のデータ保持 | 30日 |
| 長期保存 | CloudWatch Logs に転送可能（Log group `aws-rum-events-*`） |
| エクスポート | Logs から Kinesis / S3 へのサブスクリプションフィルタで外部分析基盤へ |

「30日を超える集計をしたい」「自社 BI に取り込みたい」場合は、Logs ルートで吐き出すのが定番です。

## 設計判断のポイント

### サンプリング率

RUM は「セッションサンプリング率」を 0〜100% で指定できます。

- 100%: すべてのユーザーセッションを記録。少トラフィック・高価値なアプリ向け
- 10%: 母集団は十分残りつつ、データ量とコストを 1/10 に。多くの公開サイトはこの帯
- 1%: 大規模サイト。母集団が大きいので統計的にはこれで十分なケースが多い

### 個人情報（PII）の扱い

RUM SDK は URL / クエリパラメータ / ユーザーエージェント等を送信します。

- URL に PII（メール・トークン）が含まれていないか確認
- 必要に応じて SDK の `urlsToInclude` / `urlsToExclude` で対象を絞る
- `recordPageView` / `recordError` のフックで送信前に値をマスク

### Cognito Identity Pool が必要

RUM SDK が CloudWatch にデータを送るには、未認証ユーザーでも使える **AWS 認証情報**が必要です。これを **Cognito Identity Pool（未認証ロール）** で発行する設計が標準です。

## ハンズオン

CDK で **S3 + CloudFront + Cognito Identity Pool + RUM AppMonitor** を一括構築し、
ブラウザに RUM Web SDK を埋め込んでテレメトリを送信するまでを体験します。

詳細手順は [`handson/chapter-09/README.md`](https://github.com/r-tamura/aws-cw-study/blob/main/handson/chapter-09/README.md) を参照。
要点だけ抜き出すと:

```bash
cd handson/chapter-09
npm install
npx cdk bootstrap   # 初回のみ
npx cdk deploy      # ① まずスタックを作る
```

`cdk deploy` の Outputs に `CloudFrontUrl` / `IdentityPoolId` / `AppMonitorName` などが出ます。
**AppMonitor の ID** はスタック出力には現れないので、AWS CLI で取得します。

```bash
aws rum get-app-monitor --name aws-cw-study-ch09 \
  --query 'AppMonitor.Id' --output text
```

取得した **AppMonitor ID** と **Identity Pool ID** を `web/index.html` の RUM スニペットの
`REPLACE_WITH_*` に貼り付けて再デプロイします。

```bash
npx cdk deploy   # ② SDK 設定値を反映して再デプロイ
```

`CloudFrontUrl` をブラウザで開くと、

- ナビボタン（`/home` / `/about`）で **ページビュー**
- `fetch` ボタンで **HTTP テレメトリ**
- エラーボタンで **JS エラー**
- カスタムイベントボタンで `recordEvent`

がそれぞれ発火し、CloudWatch RUM のコンソールから `aws-cw-study-ch09` AppMonitor を
開くと、Page views / Errors / Performance（Core Web Vitals）が反映されているのが確認できます。

`cwLogEnabled: true` にしているので、Logs Insights からも RUM イベントを直接クエリできます。

```text
fields @timestamp, event_type, event_details.target_id
| sort @timestamp desc
| limit 50
```

## 片付け

```bash
cd handson/chapter-09
npx cdk destroy
```

これだけで AppMonitor / Cognito Identity Pool / 未認証ロール / CloudFront /
S3 バケット（中身込み、`autoDeleteObjects: true`）/ ロググループがすべて消えます。
CloudFront の無効化に数分かかる点だけ注意してください。

## 参考資料

**AWS 公式ドキュメント**
- [What is CloudWatch RUM](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-RUM.html) — RUM の概念、App Monitor、収集データの総合リファレンス
- [Set up a mobile application to use CloudWatch RUM](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-RUM-web-mobile.html) — iOS / Android 向け ADOT SDK のセットアップ手順
- [Authorize your web application to send data to AWS](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-RUM-get-started-authorization.html) — Cognito Identity Pool（未認証ロール）など 4 種類の認可方式

**AWS ブログ / アナウンス**
- [Amazon CloudWatch real user monitoring (RUM) adds support for iOS and Android applications](https://aws.amazon.com/about-aws/whats-new/2025/11/real-user-monitoring-mobile-apps-cloudwatch/) — モバイル RUM（OTel ベース）追加（2025/11）
- [Amazon CloudWatch RUM now supports an improved App Monitors overview with health, SLO, and tracing status](https://aws.amazon.com/about-aws/whats-new/2026/04/amazon-cloudwatch-rum-app-monitors/) — フリート全体の health / SLO / tracing を一覧する新ダッシュボード（2026/04）

**OSS / 標準仕様**
- [aws-observability/aws-rum-web (GitHub)](https://github.com/aws-observability/aws-rum-web) — Web RUM SDK のソース・サンプル・設定リファレンス

## まとめ

- RUM は **ユーザー視点の体験**を測る、サーバ側 APM の補完物
- Web RUM は JS スニペット、モバイル RUM は OTel ベースの SDK
- Core Web Vitals（LCP / INP / CLS）は SEO と UX を同時に追える指標
- Application Signals と trace ID で連結すると、**ユーザー視点 → サーバ側のボトルネック**まで一本でたどれる
- 30日保持なので、長期保存は CloudWatch Logs 転送で
