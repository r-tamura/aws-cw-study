# Chapter 06: Dashboards ハンズオン

CloudWatch Dashboard を **CDK で IaC 化**し、4 種類のウィジェット（GraphWidget / SingleValueWidget / LogQueryWidget / AlarmWidget）と、`SearchExpression` による動的なメトリクス取得、そしてダッシュボード変数（Environment 切替）を 1 つのスタックに詰め込んだサンプル。

## 構成

```
EventBridge (rate(1 minute))
        │
        ▼
Lambda (order-emitter, Node.js 22.x)
   └─ EMF stdout → CloudWatch Logs
         └─ namespace: AwsCwStudy/Ch06
               metrics: OrderCount / OrderLatency
                 ├─ Alarm: OrderLatency > 1000ms
                 └─ Dashboard: AwsCwStudy-Ch06
                       ├─ GraphWidget (Count / Latency / m2/m1)
                       ├─ SingleValueWidget (latest OrderLatency)
                       ├─ LogQueryWidget (last 20 emitter logs)
                       ├─ AlarmWidget (OrderLatency alarm)
                       └─ GraphWidget w/ SearchExpression (動的取得)
```

## デプロイ

```bash
cd handson/chapter-06
npm install
npx cdk bootstrap   # 初回のみ
npx cdk deploy
```

`cdk deploy` の出力に `DashboardUrl` / `DashboardName` / `AlarmName` が出る。

## ダッシュボードを開く

`cdk deploy` の `DashboardUrl` 出力をブラウザで開く。直接 URL を組み立てるなら次の通り。

```
https://<region>.console.aws.amazon.com/cloudwatch/home?region=<region>#dashboards:name=AwsCwStudy-Ch06
```

東京リージョン (`ap-northeast-1`) で固定なら:

<https://ap-northeast-1.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#dashboards:name=AwsCwStudy-Ch06>

EventBridge が Lambda を 1 分ごとに叩くので、デプロイ後 **約 5 分** で各ウィジェットにデータポイントが現れる。

## このハンズオンで確認するポイント

1. **4 ウィジェット種類の比較**
   - **GraphWidget**: 時系列の比較。`MathExpression` で `m2/m1` のような派生メトリクスも同じウィジェット内に並べられる
   - **SingleValueWidget**: 直近値の KPI 表示。`sparkline: true` でミニグラフ付き
   - **LogQueryWidget**: Logs Insights クエリの結果をテーブル/グラフ表示
   - **AlarmWidget**: アラームの状態とそのしきい値帯を時系列で可視化
2. **Dashboard 変数**: 画面上部の `Environment` セレクタで `dev` / `staging` / `prod` を切替。Lambda の環境変数 `ENVIRONMENT=dev` を `staging` などに書き換えてもう 1 度デプロイすれば、その環境の系列が出始める
3. **SearchExpression**: `SEARCH('{AwsCwStudy/Ch06,Environment,ServiceName} MetricName="OrderLatency"', 'Average', 60)` を使うと、新しい `ServiceName` ディメンションが増えても**ダッシュボードを書き換えずに**自動で系列が増える
4. **CDK 定義 ↔ コンソール JSON の対応**
   - CloudWatch コンソールでダッシュボード右上の **Edit dashboard** → **Actions** → **View/edit source** を開くと、CDK が生成した JSON が見られる。`lib/stack.ts` の `Dashboard` / 各 Widget の指定と JSON のフィールドを 1:1 で見比べると IaC 化のメリット（再現性・差分管理）が分かる

## トラブルシューティング

| 症状 | 確認ポイント |
|---|---|
| 5 分待ってもダッシュボードに線が出ない | `aws lambda invoke --function-name AwsCwStudy-Ch06-OrderEmitter /tmp/out.json` で手動実行してみる。CloudWatch Logs `/aws/lambda/AwsCwStudy-Ch06-OrderEmitter` に EMF JSON が出ていれば数秒〜数分でメトリクスとして見える |
| AlarmWidget が常に INSUFFICIENT_DATA | スパイクは 20% 確率なので、5〜10 サイクル待つ。`treatMissingData: NOT_BREACHING` なので欠損中は OK 判定 |
| SearchWidget が空 | EMF が `Environment` と `ServiceName` の両方をディメンションとして持つことが前提。`SEARCH` 式の dimension list を変えたら数分待つ |

## 片付け

```bash
npx cdk destroy
```

`cdk destroy` で Lambda / EventBridge ルール / Alarm / Dashboard / LogGroup（CDK で明示作成しているのでスタック削除と一緒に消える）がすべてクリーンアップされる。

> 補足: 万一 LogGroup が手動作成のものに切り替わった場合は `aws logs delete-log-group --log-group-name /aws/lambda/AwsCwStudy-Ch06-OrderEmitter` で削除できる。
