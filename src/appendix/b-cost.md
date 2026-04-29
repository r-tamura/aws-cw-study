# 付録B: コスト設計チェックリスト

CloudWatch の請求書を読みやすく、節約レバーを正しい順序で引けるようにするためのチェックリストです。本書の各機能章で出てきた料金軸を 1 ページにまとめ、優先度順に「最初に手を入れるべきこと」を示します。

## CloudWatch の課金軸の全体像

CloudWatch の請求は AWS Cost Explorer で **`Service: AmazonCloudWatch`** と **`Service: AWSLogs`** に分かれて出ます。さらにその内側で次のディメンションに切れます。

| 大分類 | 細分類 | 単位 | 影響を受ける章 |
|---|---|---|---|
| **Logs** | Ingestion（取り込み） | GB | [Ch4](../part2/04-logs.md) |
| | Storage（保管） | GB-month | [Ch4](../part2/04-logs.md) |
| | Insights queries | スキャンした GB | [Ch4](../part2/04-logs.md) |
| | Live Tail | セッション × 分 | [Ch4](../part2/04-logs.md) |
| | Vended logs delivery | GB（CloudTrail 等の標準割引あり） | [Ch4](../part2/04-logs.md) |
| | Centralization 追加コピー | GB | [Ch19](../part6/19-setup.md) |
| **Metrics** | カスタムメトリクス | メトリクス × 月 | [Ch3](../part2/03-metrics.md) |
| | API リクエスト | `GetMetricData` / `PutMetricData` 等のコール数 | [Ch3](../part2/03-metrics.md) |
| | Detailed Monitoring | EC2 等の 1 分粒度オプション | [Ch3](../part2/03-metrics.md) |
| | Metric Streams | 配信 GB（Firehose 連携） | [Ch3](../part2/03-metrics.md) |
| **Alarms** | 標準アラーム | アラーム × 月 | [Ch5](../part2/05-alarms.md) |
| | Composite Alarm | アラーム × 月 | [Ch5](../part2/05-alarms.md) |
| **Dashboards** | カスタムダッシュボード | ダッシュボード × 月（最初の 3 枚は無料） | [Ch6](../part2/06-dashboards.md) |
| **Application Signals** | サービス × 月 + Application Signals | サービス × 月 + リクエスト × 月 | [Ch7](../part3/07-application-signals.md) |
| | SLO | SLI × 月 | [Ch7](../part3/07-application-signals.md) |
| **X-Ray / Transaction Search** | スパン取り込み | Logs Ingestion 経由 | [Ch8](../part3/08-transaction-search.md) |
| | トレースインデックス | 1% 無料、超過分は X-Ray 通常料金 | [Ch8](../part3/08-transaction-search.md) |
| **RUM** | イベント | 100 イベント単位 | [Ch9](../part3/09-rum.md) |
| **Synthetics** | Canary 実行 | 実行回数 | [Ch10](../part3/10-synthetics.md) |
| **Container Insights** | 取り込み | Logs Ingestion 経由 | [Ch13](../part4/13-container-insights.md) |
| **Database Insights** | Standard / Advanced | DB × vCPU / ACU × 月 | [Ch14](../part4/14-database-insights.md) |
| **Lambda Insights** | 取り込み | Logs Ingestion 経由（Layer 自体は無料） | [Ch15](../part4/15-lambda-insights.md) |
| **Internet Monitor** | モニター対象リソース + City-Network | リソース × 月 + City-Network × 月 | [Ch16](../part5/16-network-monitoring.md) |
| **Network Flow Monitor** | エージェント + 出力メトリクス数 | リソース × 月 + メトリクス | [Ch16](../part5/16-network-monitoring.md) |
| **Investigations** | Enhanced investigations 月 150 件無料 | 件 × 月 | [Ch17](../part5/17-investigations.md) |
| **OAM** | クロスアカウント | Logs / Metrics / AppSignals は無料、初回 1 トレースコピーまで無料 | [Ch19](../part6/19-setup.md) |

実際の料金は [CloudWatch 料金ページ](https://aws.amazon.com/cloudwatch/pricing/) と [Cost Explorer](https://console.aws.amazon.com/cost-management/home) で確認します。本書執筆時点の単価は時期で変動するため、絶対値ではなく**比率と挙動**を覚えておくのが要点です。

## 経験則: コストの 80% は Logs と Application Signals

実装してみるとほぼ毎回、CloudWatch 請求書の上位 2 行は次の形になります。

1. **CloudWatch Logs Ingestion**（GB）— アプリケーションログの構造化が雑だと真っ先に膨らむ
2. **Application Signals**（サービス × リクエスト × SLI）— サービス分解能を上げすぎると膨らむ

逆に言えば、この 2 つを抑えれば総コストは大きく下がります。Metrics / Alarms / Dashboards はよほど数を作らない限り上位には来ません。

## 優先度順の節約チェックリスト

### Lv1: 最初に確認（30 分以内）

- [ ] **AWS Budgets と Cost Anomaly Detection を有効化**（→ [Ch2](../part1/02-setup.md)）
- [ ] **Cost Explorer で `AmazonCloudWatch` と `AWSLogs` を 1 か月分グループ別表示**してトップ 5 を把握
- [ ] **CloudWatch → Logs → Settings → Account level usage** で取り込み量上位ロググループを把握
- [ ] **CloudWatch → Metrics → Custom Namespaces** でメトリクス数上位の名前空間を把握

ここまでで「どの機能に金がかかっているか」の見当がつきます。

### Lv2: Logs 系の手当（数時間〜1 日）

ログが請求の大半を占めることを確認したら、次の順で手を入れます。

- [ ] **保持期間の見直し** — 既定の「Never expire」を 30 日 / 90 日 / 1 年などに切替（[Ch4](../part2/04-logs.md)）
- [ ] **アプリケーションのログレベル整理** — DEBUG ログを本番で出していないか確認、JSON 構造化で重複文字列を排除
- [ ] **Pipelines の Drop Events プロセッサ** — 不要イベントを取り込み前に破棄（[Ch11](../part4/11-ingestion.md)）
- [ ] **Logs Insights クエリの定期実行を抑制** — ダッシュボードの LogQueryWidget は表示頻度に注意
- [ ] **Vended logs を **Standard ではなく **Infrequent Access (IA)** に** — アクセス頻度の低い CloudTrail / VPC Flow Logs 等

> Lv2 だけで月額が 30〜50% 落ちるケースが多いです。

### Lv3: Application Signals / Transaction Search の手当（1〜数日）

- [ ] **Application Signals のサービス分解能を整理** — `service.name` をデプロイ単位ではなくビジネス機能単位に（[Ch7](../part3/07-application-signals.md)）
- [ ] **Transaction Search の Head sampling 率を調整** — 全サービス 100% は重い。重要サービスのみ 100%、その他はサンプリング（[Ch8](../part3/08-transaction-search.md)）
- [ ] **トレースサマリーのインデックス率を 1% に保つ** — 無料枠内に収める（[Ch8](../part3/08-transaction-search.md)）
- [ ] **`aws/spans` ロググループの保持期間を短く** — 30 日もあれば多くの調査に十分

### Lv4: メトリクス・ダッシュボードの手当

- [ ] **高カーディナリティのカスタムメトリクスを統合** — `userId` ディメンションを切ると爆発、集計してから出す
- [ ] **EMF メトリクスの Dimensions 配列を最小化** — 1 EMF イベントに不要な軸を入れない（[Ch3](../part2/03-metrics.md)）
- [ ] **Dashboards 数を 3 枚以内に保つ** — 無料枠を意識
- [ ] **アラームの "M out of N" 評価で大量の M を避ける** — メトリクス API コールが増える

### Lv5: その他

- [ ] **RUM のセッションサンプリング率を 10〜30% に** — 100% は学習用、本番は母集団十分（[Ch9](../part3/09-rum.md)）
- [ ] **Synthetics の頻度を見直し** — 1 分間隔は重要パスのみ、その他は 5 分以上（[Ch10](../part3/10-synthetics.md)）
- [ ] **Database Insights は Standard で十分なら Advanced を切る**（[Ch14](../part4/14-database-insights.md)）
- [ ] **Internet Monitor の City-Network 数を絞る** — 上位 100 / 200 / 500 でコスト × 解像度を選ぶ（[Ch16](../part5/16-network-monitoring.md)）
- [ ] **Investigations の月 150 件 Enhanced 枠を超えないか確認**（[Ch17](../part5/17-investigations.md)）

## 計算例: 中規模 Lambda アプリの月額目安

仮に「Lambda 5 関数、各 100 万呼び出し / 月、Application Signals 有効、Transaction Search 100%」の場合の構造を見てみます。

| 項目 | 単価想定 | 月額（USD） |
|---|---|---|
| Lambda 実行料金（CloudWatch 外、参考） | — | 約 5 |
| Logs Ingestion（5 関数 × 平均 50 GB / 月） | 約 0.50/GB | 約 125 |
| Logs Storage（90 日保持で 200 GB） | 約 0.03/GB-month | 約 6 |
| Logs Insights queries（10 GB / 月） | 約 0.005/GB | 約 0.05 |
| カスタムメトリクス（50 メトリクス） | 約 0.30/月 | 約 15 |
| Alarms（20 個） | 約 0.10/月 | 約 2 |
| Application Signals（5 サービス + 500 万リクエスト） | サービス + リクエスト枠 | 約 50 |
| Transaction Search（spans 取り込み 30 GB） | Logs Ingestion 経由 | 約 15 |
| Trace summary indexing（1% 無料枠内） | — | 0 |
| **合計（CloudWatch 部）** | | **約 213** |

ここから Lv2-3 の手当を入れると 100 ドル前後まで落とせるのが典型です。

## 学習用アカウントの月額

本書のハンズオン（Phase 3a 全 8 章を順次デプロイ → curl ループで数分動かす → `cdk destroy`）であれば月額は **USD 1〜5 の範囲**に収まります。AWS Budgets を USD 10 に張っておけば、走らせ放しでも警告が来ます。

```bash
# 現状の月初〜今日までの請求実績
aws ce get-cost-and-usage \
  --time-period Start=$(date -u +%Y-%m-01),End=$(date -u +%Y-%m-%d) \
  --granularity DAILY \
  --metrics UnblendedCost \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["AmazonCloudWatch","AWSLogs"]}}' \
  --query 'ResultsByTime[].{date:TimePeriod.Start, cost:Total.UnblendedCost.Amount}' \
  --output table
```

## チェックリスト総括

「**Logs Ingestion を最優先で見る** → Application Signals → Transaction Search → メトリクス → ダッシュボード等のオプション」という順序を覚えておけば、ほとんどのコスト不安は解消できます。逆に「アラーム数を減らせばコストが下がるはず」のような直感は外れがちです。常に Cost Explorer の上位 5 行から手を入れてください。
