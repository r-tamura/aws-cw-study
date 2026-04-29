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

本書を読み終えると、CloudWatch コンソールの**左メニューに並ぶ全項目について、それが何で、何を解決するためのものか**を説明できるようになります。

| メニュー項目 | 対応 |
|---|---|
| 取り込み（Ingestion / Pipelines） | フェーズ2 |
| ダッシュボード | 第II部 |
| アラーム | 第II部 |
| AI オペレーション（Investigations） | フェーズ2 |
| 生成 AI オブザーバビリティ | フェーズ2 |
| Application Signals (APM) | 第III部 |
| インフラストラクチャモニタリング | フェーズ2 |
| ログ | 第II部 |
| メトリクス | 第II部 |
| ネットワークモニタリング | フェーズ2 |
| セットアップ（Cross-account / OAM 等） | フェーズ2 |

## 本書で扱う範囲（フェーズ1 = MVP）

最新の CloudWatch（2026年時点）における以下の領域を扱います。

- 中核機能: Metrics / Logs / Alarms / Dashboards
- アプリケーション・オブザーバビリティ: Application Signals / Transaction Search / RUM / Synthetics

## フェーズ2 で追加予定（メニュー網羅完成）

メニューにあるが MVP に含まれていない項目を、以下の構成で順次追加します。

- **取り込み（Ingestion / Pipelines）** — CloudWatch Pipelines、Facets、OCSF/OTel ノーマライゼーション
- **インフラストラクチャモニタリング** — Container Insights / Database Insights / Lambda Insights
- **ネットワークモニタリング** — Internet Monitor / Network Flow Monitor
- **AI オペレーション** — CloudWatch Investigations、5 Whys 分析
- **生成 AI オブザーバビリティ** — Bedrock AgentCore、LangChain 等の観測、MCP / GitHub Action 連携
- **セットアップ** — Cross-account / Cross-region observability、Observability Access Manager (OAM)、Log centralization
