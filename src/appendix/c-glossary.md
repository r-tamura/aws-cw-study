# 付録C: 用語集

本書で頻出する略語・専門用語を 50 音順 + アルファベット順に並べました。各用語の初出章を併記しています。

## アルファベット

| 用語 | 説明 | 初出 |
|---|---|---|
| **AAS** | Average Active Sessions。Database Insights の DB Load の単位 | [Ch14](../part4/14-database-insights.md) |
| **ADOT** | AWS Distro for OpenTelemetry。AWS が OpenTelemetry をベースに AWS 統合を強化したディストリビューション。Lambda Layer / Collector / SDK の 3 形態 | [Ch7](../part3/07-application-signals.md) |
| **AppMonitor** | CloudWatch RUM の管理単位。1 アプリ（Web / iOS / Android）に対し 1 つ作成 | [Ch9](../part3/09-rum.md) |
| **Application Signals** | CloudWatch の APM 機能。OTel 経由で RED 指標と Service Map を自動収集し、SLO 管理に対応 | [Ch7](../part3/07-application-signals.md) |
| **Burn Rate** | エラーバジェットを消費している速度。`1.0` で 30 日かけて使い切る速度。`14.4` で 2 日で使い切る速度 | [Ch7](../part3/07-application-signals.md) |
| **Canary** | CloudWatch Synthetics の最小単位。スケジュール起動 Lambda として動く合成監視 | [Ch10](../part3/10-synthetics.md) |
| **CfnDiscovery** | CDK で `aws_applicationsignals.CfnDiscovery` を作ると Application Signals サービス検出が有効になる。アカウントに 1 つ | [Ch7](../part3/07-application-signals.md) |
| **City-Network** | Internet Monitor の集計単位。「都市 × ASN（ISP）」のペア | [Ch16](../part5/16-network-monitoring.md) |
| **Composite Alarm** | 複数の子アラームを論理式で組み合わせるアラーム種別 | [Ch5](../part2/05-alarms.md) |
| **Container Insights** | EKS / ECS / Kubernetes のコンテナ環境向けのインフラ観測機能 | [Ch13](../part4/13-container-insights.md) |
| **CloudWatch Pipelines** | 取り込み・変換・配送を担うフルマネージド ETL。最大 20 段のプロセッサで OCSF / OTel への正規化が可能 | [Ch11](../part4/11-ingestion.md) |
| **Cross-account observability** | 監視アカウントが他アカウントの Metrics / Logs / Traces を境界越えに参照する仕組み。中核は OAM | [Ch19](../part6/19-setup.md) |
| **Database Insights** | RDS / Aurora 向けのフリート俯瞰ダッシュボード。Performance Insights を内包する上位レイヤ | [Ch14](../part4/14-database-insights.md) |
| **Discovery** | Application Signals がアプリを自動検出する仕組み。`appsignals.CfnDiscovery` で有効化 | [Ch7](../part3/07-application-signals.md) |
| **EMF** | Embedded Metric Format。1 行の JSON ログにメトリクス定義と実値を同居させる構造化ログ | [Ch3](../part2/03-metrics.md) |
| **EventBridge** | CloudWatch Events の進化形イベントバス。本書スコープ外 | — |
| **Facets** | CloudWatch Logs Insights の対話的ファセット検索 UI。Pipelines で付与された Data Source を起点に絞り込み | [Ch11](../part4/11-ingestion.md) |
| **GenAI Observability** | CloudWatch の生成 AI ワークロード向け観測機能。Bedrock Model Invocations と AgentCore primitives | [Ch18](../part5/18-genai-observability.md) |
| **Honeycomb（ハニカム）** | Database Insights Fleet Health Dashboard の UI 要素。インスタンスを六角形タイルで色分け | [Ch14](../part4/14-database-insights.md) |
| **Internet Monitor** | エンドユーザー → AWS の外部到達性を監視するサービス | [Ch16](../part5/16-network-monitoring.md) |
| **Investigations** | CloudWatch の AI 駆動 RCA。観測 → 仮説 → 5 Whys → インシデントレポート生成 | [Ch17](../part5/17-investigations.md) |
| **Lambda Insights** | Lambda 関数の実行サンドボックス内のリソース指標（CPU 時間 / メモリ実測 / コールドスタート）を Lambda 拡張機能で収集 | [Ch15](../part4/15-lambda-insights.md) |
| **Live Tail** | CloudWatch Logs のリアルタイムログテール機能。`aws logs start-live-tail` | [Ch4](../part2/04-logs.md) |
| **Logs Insights** | CloudWatch Logs に対する SQL ライク（PPL/QL）クエリ機能 | [Ch4](../part2/04-logs.md) |
| **MCP** | Model Context Protocol。AI エージェントから観測データを叩く API 入口の標準。Application Signals MCP server / CloudWatch MCP server 等 | [Ch18](../part5/18-genai-observability.md) |
| **Metric Filter** | CloudWatch Logs のフィルタパターンにマッチしたイベントをカウントしてカスタムメトリクスに変換する機能 | [Ch4](../part2/04-logs.md) |
| **Metrics Insights** | CloudWatch Metrics に対する SQL ライククエリ機能。最大数千メトリクスを横断 | [Ch3](../part2/03-metrics.md) |
| **Multi-checks** | Synthetics の Blueprint。JSON 設定だけで HTTP / DNS / SSL / TCP の組み合わせチェック（syn-nodejs-3.0+） | [Ch10](../part3/10-synthetics.md) |
| **Network Flow Monitor** | 2024/re:Invent 発表。VPC 内 / 対 AWS サービスの TCP フロー品質を eBPF で観測 | [Ch16](../part5/16-network-monitoring.md) |
| **Network Monitor** | オンプレ → AWS のハイブリッド経路を AWS 側からプローブする能動監視。`aws synthetics-monitor` ではなく `networkmonitor` API | [Ch16](../part5/16-network-monitoring.md) |
| **NHI** | Network Health Indicator。Network Flow Monitor の劣化原因を AWS / ワークロードのバイナリで示す指標 | [Ch16](../part5/16-network-monitoring.md) |
| **OAM** | Observability Access Manager。Cross-account observability の Sink / Link を管理する API | [Ch19](../part6/19-setup.md) |
| **OCSF** | Open Cybersecurity Schema Framework。セキュリティログの業界標準スキーマ。Pipelines が `parseToOCSF` プロセッサで対応 | [Ch11](../part4/11-ingestion.md) |
| **OTel** | OpenTelemetry。CNCF ホストのベンダー中立観測フレームワーク。Signals / SDK / Collector / OTLP の 4 構成 | [Ch12](../part4/12-opentelemetry.md) |
| **OTLP** | OpenTelemetry Protocol。HTTP/1.1 + Protobuf or JSON、3 Signal を別エンドポイントに送る | [Ch12](../part4/12-opentelemetry.md) |
| **Performance Insights** | RDS / Aurora の SQL レベル分析。Database Insights の下層レイヤで動く | [Ch14](../part4/14-database-insights.md) |
| **PromQL** | Prometheus クエリ言語。CloudWatch は OTel メトリクスに対し PromQL クエリをサポート | [Ch12](../part4/12-opentelemetry.md) |
| **RED** | Rate / Errors / Duration。SRE で定番のリクエスト単位の SLI 3 指標 | [Ch7](../part3/07-application-signals.md) |
| **RUM** | Real User Monitoring。実ユーザーのブラウザ・モバイル端末から見た体験を観測 | [Ch9](../part3/09-rum.md) |
| **Service Map** | Application Signals の自動生成サービストポロジー図。ノード = サービス、エッジ = 呼び出し | [Ch7](../part3/07-application-signals.md) |
| **Sink / Link** | OAM のリソース。Sink は監視アカウント側、Link はソースアカウント側に置く | [Ch19](../part6/19-setup.md) |
| **SLI / SLO / SLA** | Service Level Indicator / Objective / Agreement。SLI は計測値、SLO は目標、SLA は契約 | [Ch7](../part3/07-application-signals.md) |
| **Synthetic monitoring** | 合成監視。実ユーザーのアクセスを待たずスケジュール起動で品質を測る | [Ch10](../part3/10-synthetics.md) |
| **Telemetry config** | CloudWatch の組織横断設定。Organizations と組み合わせ新規アカウントの取り込みを自動有効化 | [Ch19](../part6/19-setup.md) |
| **Top SQL** | Database Insights のクエリ単位の DB Load 寄与ランキング。実行計画 / ロック分析へ降りる起点 | [Ch14](../part4/14-database-insights.md) |
| **Transaction Search** | X-Ray のトレースを 100% で `aws/spans` ロググループに取り込み、Visual Editor / Logs Insights で検索する機能 | [Ch8](../part3/08-transaction-search.md) |
| **Trace summary** | Transaction Search のうち X-Ray インデックス側のサブセット。既定 1% 無料枠 | [Ch8](../part3/08-transaction-search.md) |
| **Visual Editor** | Transaction Search の UI。List / Timeseries / Group Analysis の 3 モード | [Ch8](../part3/08-transaction-search.md) |
| **X-Ray** | AWS の分散トレーシングサービス。Application Signals / Transaction Search の下層で動く | [Ch7](../part3/07-application-signals.md) |

## 日本語

| 用語 | 説明 | 初出 |
|---|---|---|
| **アラーム（CloudWatch Alarm）** | しきい値・Anomaly Detection・Composite の 3 種で、メトリクスや他アラームの状態を判定し SNS 等にアクション | [Ch5](../part2/05-alarms.md) |
| **エラーバジェット** | `100% - SLO 目標値` の余裕枠。SLO 99.9% なら 30 日で 43.2 分の許容ダウンタイム | [Ch7](../part3/07-application-signals.md) |
| **ガードレール** | 検証用アカウントで Budget / Cost Anomaly Detection / IAM 制約を予め張ること | [Ch2](./../part1/02-setup.md) |
| **観測（observation）** | CloudWatch Investigations の用語。AI が見つけた事実寄りの一次情報 | [Ch17](../part5/17-investigations.md) |
| **仮説（hypothesis）** | CloudWatch Investigations の用語。Observation を組み合わせて AI が立てた因果モデル | [Ch17](../part5/17-investigations.md) |
| **コールドスタート** | Lambda 関数の初回起動。`init_duration` メトリクスは Lambda Insights で取得 | [Ch15](../part4/15-lambda-insights.md) |
| **取り込み** | CloudWatch コンソール左メニュー項目。CloudWatch Pipelines / Facets / OCSF / OTel / S3 Tables 統合 | [Ch11](../part4/11-ingestion.md) |
| **自動計装（auto-instrumentation）** | アプリケーションコードを書き換えずに OTel / X-Ray のテレメトリを自動収集する手法 | [Ch12](../part4/12-opentelemetry.md) |
| **生成 AI オブザーバビリティ** | LLM / エージェントの呼び出し・トークン消費・ガードレール発火を可視化する CloudWatch 機能 | [Ch18](../part5/18-genai-observability.md) |
| **ダッシュボード** | カスタムレイアウトの可視化画面。CDK で IaC 化が標準 | [Ch6](../part2/06-dashboards.md) |
| **ディメンション（Dimension）** | CloudWatch メトリクスのキー。同じメトリクス名でもディメンション値ごとに別系列として保存 | [Ch3](../part2/03-metrics.md) |
| **トレースサマリー** | Transaction Search の X-Ray インデックス層。可視化用の 1% サンプル | [Ch8](../part3/08-transaction-search.md) |
| **取り込み（Ingestion）** | データを CloudWatch に流し込むこと。または対応するコンソールメニュー | [Ch11](../part4/11-ingestion.md) |
| **ハニカム（Honeycomb）** | Database Insights のフリートビューに使われる六角形タイル UI | [Ch14](../part4/14-database-insights.md) |
| **ヘッドサンプリング** | トレースの取得を「リクエスト開始時に決める」サンプリング方式。Transaction Search では 100% を推奨 | [Ch8](../part3/08-transaction-search.md) |
| **ファセット（Facet）** | Logs Insights の対話的絞り込み UI。Data Source / Region / Status などをチップで切替 | [Ch11](../part4/11-ingestion.md) |
| **保持期間** | CloudWatch Logs のロググループ単位で設定。RUM はサービス側で 30 日固定 | [Ch4](../part2/04-logs.md) |
| **未計装サービスの自動検出** | 2025/11 追加。X-Ray のトレースから Application Signals が未計装の AWS サービスをトポロジー上に推定表示 | [Ch7](../part3/07-application-signals.md) |
| **メトリクス（CloudWatch Metrics）** | 時系列の数値テレメトリ。標準・カスタム・EMF・OTel 経由の 4 取り込み口 | [Ch3](../part2/03-metrics.md) |

## 略語の組み立て方（補足）

CloudWatch まわりの略語は同じ単語が複数の意味で再利用されるため、初見のときに混乱しがちです。次の対応関係を覚えておくと迷いません。

- **APM = Application Performance Monitoring** → CloudWatch では **Application Signals** がこの役割
- **APM ≠ Application Insights** → Application Insights は古いリソース診断機能（本書スコープ外）
- **OAM ≠ OAuth** → OAM は Observability Access Manager
- **NHI ≠ Network Health Index** → NHI は Network **Health Indicator**（バイナリ判定）
- **Synthetic Monitoring ≠ Network Monitor** → 前者は HTTP / API レベル、後者は L3-4 ネットワークレイヤ

各章の本文で正式名称を最初に出してから略語を使う方針で書いていますが、検索しやすさのため本付録に集約しました。

## 参考資料

**関連章への内部リンク一覧**
- [Ch3 Metrics](../part2/03-metrics.md) — EMF / Dimension / Metrics Insights
- [Ch4 Logs](../part2/04-logs.md) — LogGroup / Live Tail / Logs Insights / Metric Filter
- [Ch5 Alarms](../part2/05-alarms.md) — Composite Alarm / Anomaly Detection
- [Ch7 Application Signals](../part3/07-application-signals.md) — RED / SLO / Burn Rate / Service Map
- [Ch11 Ingestion](../part4/11-ingestion.md) — Pipelines / Facets / OCSF
- [Ch12 OpenTelemetry](../part4/12-opentelemetry.md) — OTLP / PromQL / ADOT
- [Ch19 Setup](../part6/19-setup.md) — OAM / Sink / Link / Telemetry config

**AWS 公式ドキュメント**
- [Amazon CloudWatch glossary (FAQs)](https://aws.amazon.com/cloudwatch/faqs/) — 公式の用語整理（取り込み口・観測機能・課金軸）
- [AWS general glossary](https://docs.aws.amazon.com/general/latest/gr/glos-chap.html) — AWS 全体の用語（IAM / Account / Region など本書の前提語）

**OSS / 標準仕様**
- [OpenTelemetry glossary](https://opentelemetry.io/docs/specs/otel/glossary/) — Span / Metric / Resource など 3 シグナル基本語
- [SRE Glossary (Google SRE Book)](https://sre.google/sre-book/glossary/) — SLI / SLO / SLA / Error Budget の標準定義
