# Transaction Search

Transaction Search は Application Signals の **「全スパン取り込み層」** にあたる機能です。アプリケーションのトレース情報（スパン）を **100% で CloudWatch Logs に保存**し、Logs Insights や Visual Editor で自由に検索・集計できるようにします。

## 解決する問題

従来の AWS X-Ray は、コスト都合で **1〜5% のヘッドサンプリング**を行うのが一般的でした。これは「平均的にどう動いているか」を知るには十分ですが、次のような **「珍しい1リクエスト」を後から探す**ユースケースで限界があります。

- ユーザーから「3時頃に注文が失敗した」と問い合わせがあった → そのリクエストはサンプリングで捨てられている可能性が高い
- P99.9 レイテンシのテールに何が起きているか調べたい → サンプル外の可能性が高い
- 特定のテナント/顧客 ID に絞って調べたい → 母集団が削られていて統計的に十分でない

Transaction Search は **「全部取って、後でクエリで絞る」** という戦略でこれを解決します。

## 仕組み

### 1. 全スパンを構造化ログとして取り込む

Transaction Search を有効化すると、X-Ray のトレース送信先が CloudWatch Logs の **`aws/spans`** という特別なロググループに切り替わり、すべてのスパンが構造化ログとして保存されます。

```text
[アプリケーション]
   │ OTel / X-Ray SDK
   ▼
[X-Ray API]
   │
   ├─→ aws/spans ロググループ（100%、構造化ログ）  ◀── ここが新層
   │
   └─→ X-Ray インデックス（指定割合、デフォルト 1%）
        ↓
        [トレースサマリー（trace summary）]
```

### 2. トレースサマリーは別にインデックスする

X-Ray 本体の機能としての「トレースの可視化（タイムライン、サービスマップ）」は、`aws/spans` に入った全スパンのうち**指定割合（既定 1%）をインデックス**したサブセットで提供されます。これを **トレースサマリー（trace summary）** と呼びます。

- インデックス割合は `UpdateIndexingRule` API で変更可能
- 100% にすればすべてのトレースが X-Ray の Trace Map で見えるが、料金が増える
- 1% でも、Logs Insights を使えば残り 99% のスパンも検索できる

この「**全スパンは Logs、可視化のためのトレースは別途 1% サンプリング**」という二段構えがコストと網羅性のバランスを取っています。

## 3つのクエリ形式（Visual Editor）

CloudWatch コンソールの Application Signals → Transaction Search からアクセスできる **Visual Editor** は、`aws/spans` ロググループに対して 3 種類のクエリを発行できます。

### List（リスト形式）

スパン/イベントを生のリストで返す。**特定の1リクエストを掘る**のに使います。

- ユースケース: 「カスタマー ID `cust-12345` の昨日の注文リクエスト全件を見たい」
- ユースケース: 「`status_code = 500` のスパンを 100 件並べて、エラーメッセージのパターンを目視で把握」

### Timeseries（時系列）

スパンを時間軸で集計してグラフ化する。**スパイクや傾向**を探すのに使います。

- ユースケース: 「`db.query` スパンの平均 duration を 5分粒度で過去 24h 描画」
- ユースケース: 「`http.status_code = 4xx` の発生頻度を時間別に」

### Group Analysis（グループ分析）

属性ごとに集計して**統計テーブル**を返す。**Top N 分析**に使います。

- ユースケース: 「最も遅い DB クエリ Top 5」
- ユースケース: 「最もエラーが多い Availability Zone Top 3」
- ユースケース: 「サービス停止の影響を最も受けたお客様 Top 10」

## Logs Insights からも触れる

`aws/spans` は通常の CloudWatch Logs ロググループなので、**Logs Insights クエリ**で SQL ライクな探索も可能です。

```text
fields @timestamp, attributes.`db.statement`, durationNano
| filter `name` = "db.query"
| stats avg(durationNano), count(*) by attributes.`db.statement`
| sort avg(durationNano) desc
| limit 5
```

これは **Visual Editor では表現しきれない複雑な分析**（複数フィールドの結合、サブクエリ的処理）に使う逃げ道です。

## 取り込み元: OpenTelemetry / X-Ray のどちらでも

Transaction Search は **OTLP（[OpenTelemetry](../part4/12-opentelemetry.md) Protocol）と X-Ray** の両方からスパンを受け取れます。

- **Application Signals 経由**: ADOT で自動計装した Java/Python/Node.js/.NET アプリは、すでに OTLP でスパンを送っているので、Transaction Search を有効化すれば**追加実装ゼロ**で取り込みが始まる
- **X-Ray SDK 経由**: 既存の X-Ray 計装も同様に、サンプリングを 100% に上げれば Transaction Search の対象となる

## 設計判断のポイント

### Head sampling を 100% にすべきか

Transaction Search の真価を引き出すには、X-Ray / ADOT 側の **head sampling rate を 100%** に設定する必要があります（既定は 5%）。

- **Pro**: 全リクエストが `aws/spans` に入り、後追いの調査が確実にできる
- **Con**: ログ取り込み量が増えるため、CloudWatch Logs Ingestion 課金が増える

判断軸:
- **トラフィックが高く、コストが大きな関心事** → 100% は重い。一部サービスのみ有効化、ヘビーなトラフィックには tail sampling を組み合わせるなどを検討
- **トラフィックが中〜低、または高価値なサービス（決済等）** → 100% にするメリットが大きい

### インデックス割合（X-Ray 側）

`aws/spans` への取り込みとは別に、X-Ray のトレースサマリーとしてインデックスする割合を `UpdateIndexingRule` で決めます。

- 既定 1% は **無料枠**として提供される
- 100% にすると Trace Map ですべてのトレースが見えるが、X-Ray の Trace 課金が増える

## Lambda での Transaction Search

Lambda では、トレースコンテキスト伝播の `sampled` フラグに左右されず**すべての関数呼び出しのスパンを取得**する目的で Transaction Search が特に有用です。普段はサンプリングされて消えてしまう「ごく稀に発生する関数の遅延」を後追い調査できるようになります。

## 料金特性

Transaction Search は次の課金軸で構成されます。

| 軸 | 内容 |
|----|------|
| Logs Ingestion | `aws/spans` への取り込み量（GB） |
| Logs Storage | 保持期間に応じたストレージ |
| Trace summary indexing | 1% は無料、それを超える割合は X-Ray 課金 |
| Logs Insights クエリ | スキャンしたデータ量 |

つまり「**Logs の課金体系に乗った X-Ray**」と捉えると見通しが良いです。

## ハンズオン

> TODO: 第7章のハンズオンの上に Transaction Search を有効化し、Visual Editor / Logs Insights から実際にスパンを検索する手順を追加する。

## 片付け

> TODO: Transaction Search の無効化、`aws/spans` ロググループの削除手順を追記する。

## まとめ

- Transaction Search は **X-Ray のサンプリング限界を解決するための「全スパン保存層」**
- スパンは `aws/spans` ロググループに構造化ログとして 100% 入り、X-Ray 側で 1% を可視化用にインデックス
- Visual Editor の **List / Timeseries / Group Analysis** で UI から、Logs Insights で SQL ライクに分析
- Application Signals と組み合わせると「APMダッシュボードの裏で全スパンが検索可能」な状態になる
