# はじめに

本書は Amazon CloudWatch を体系的に学ぶための学習帳です。

## 本書の進め方

各章は次の構成で書かれています。

1. **概念の整理** — その機能が解決する課題と全体像
2. **主要な仕様** — 構成要素・制限・料金の押さえどころ
3. **ハンズオン** — 実際に手を動かして確認する手順
4. **片付け** — 課金を止めるためのリソース削除手順

## 前提

- AWSアカウント（ハンズオン用に新規アカウントを推奨）
- AWS CLI v2 がインストール済み
- 任意のAWSリージョン（本書では `ap-northeast-1` を例として使用）

> ⚠️ **コスト注意**: ハンズオンで作成するリソースの一部は課金対象です。各章末の「片付け」を必ず実施してください。

## 本書のゴール

本書を読み終えると、CloudWatch コンソールの**左メニューに並ぶ全項目について、それが何で、何を解決するためのものか**を説明できるようになります。本書はメニュー全 11 項目を網羅しています。

| メニュー項目 | 対応する章 |
|---|---|
| 取り込み（Ingestion / Pipelines） | [第IV部 Ch11](./part4/11-ingestion.md) |
| ダッシュボード | [第II部 Ch6](./part2/06-dashboards.md) |
| アラーム | [第II部 Ch5](./part2/05-alarms.md) |
| AI オペレーション（Investigations） | [第V部 Ch17](./part5/17-investigations.md) |
| 生成 AI オブザーバビリティ | [第V部 Ch18](./part5/18-genai-observability.md) |
| Application Signals (APM) | [第III部 Ch7-10](./part3/07-application-signals.md) |
| インフラストラクチャモニタリング | [第IV部 Ch13-15](./part4/13-container-insights.md) |
| ログ | [第II部 Ch4](./part2/04-logs.md) |
| メトリクス | [第II部 Ch3](./part2/03-metrics.md) |
| ネットワークモニタリング | [第V部 Ch16](./part5/16-network-monitoring.md) |
| セットアップ（Cross-account / OAM 等） | [第VI部 Ch19](./part6/19-setup.md) |

加えて、メニュー横断で必要となる以下のトピックを独立章として扱っています。

- **CloudWatch 全体像と環境準備** — [第I部 Ch1-2](./part1/01-overview.md)
- **OpenTelemetry** — [第IV部 Ch12](./part4/12-opentelemetry.md)（CloudWatch の OTLP エンドポイント、ADOT、PromQL 連携）

## 章構成のサマリ

```
第I部 基礎
  Ch1 CloudWatch 全体像
  Ch2 環境準備

第II部 中核機能
  Ch3 Metrics / Ch4 Logs / Ch5 Alarms / Ch6 Dashboards

第III部 アプリケーション・オブザーバビリティ
  Ch7 Application Signals & SLO
  Ch8 Transaction Search
  Ch9 RUM
  Ch10 Synthetics

第IV部 取り込みとインフラ監視
  Ch11 取り込み (Ingestion / Pipelines)
  Ch12 OpenTelemetry
  Ch13 Container Insights
  Ch14 Database Insights
  Ch15 Lambda Insights

第V部 ネットワーク監視と AI 機能
  Ch16 ネットワークモニタリング
  Ch17 CloudWatch Investigations
  Ch18 生成 AI オブザーバビリティ

第VI部 横断・セットアップ
  Ch19 Cross-account / OAM / Log Centralization
```

各章の **ハンズオン** 節は本書フェーズ2 段階では TODO となっています。AWS CDK + Serverless（Lambda TypeScript / Python）構成での統一されたハンズオン群はフェーズ3で順次追加予定です。
