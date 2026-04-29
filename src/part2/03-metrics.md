# Metrics

> TODO: 執筆予定

## この章で扱う内容

- 標準メトリクスとカスタムメトリクス
- 名前空間 / ディメンション / 解像度
- Embedded Metric Format (EMF)
- OpenTelemetry メトリクスと PromQL
- Metrics Insights

## ハンズオン

CDK プロジェクトを [`handson/chapter-03/`](https://github.com/r-tamura/aws-cw-study/tree/main/handson/chapter-03) に置いた。詳細な手順は同ディレクトリの `README.md` を参照。

要点は次の 3 つ。

1. Lambda 関数（TypeScript / Python）から **Embedded Metric Format (EMF)** で構造化ログを出力すると、CloudWatch がパースして自動的にカスタムメトリクスを作る。EMF イベントは `_aws.CloudWatchMetrics` キーで Namespace / Dimensions / Metric 定義を、ルートのプロパティで実値を持つ JSON ドキュメントである。
2. ディメンション（`ServiceName` / `Operation`）を 1 つの EMF イベントに含めるだけで、`AwsCwStudy/Ch03` 名前空間のカスタムメトリクスとして発火する。SDK や `PutMetricData` API を呼ぶ必要はなく、`console.log` / `print` だけで完結するのが EMF の利点。
3. **Metrics Insights** で SQL ライクに集計する。`SELECT AVG(OrderValue) FROM SCHEMA("AwsCwStudy/Ch03", ServiceName, Operation) GROUP BY ServiceName` のように、ディメンションスキーマを `SCHEMA()` 関数で指定して、最大数千メトリクスを横断検索できる。

API Gateway HTTP API で `POST /order`（TS Lambda）と `GET /inventory`（Python Lambda）を公開し、curl ループでトラフィックを投げ込んだ後、コンソールでメトリクスとクエリ結果を確認する流れ。

## 片付け

```bash
cd handson/chapter-03
npx cdk destroy
```

スタックを削除すると、Lambda・API Gateway・関連 IAM ロールがまとめて消える。CloudWatch Logs のロググループは Lambda 削除後も残るため、必要に応じて `aws logs delete-log-group --log-group-name /aws/lambda/AwsCwStudyCh03Metrics-...` で個別に削除する。カスタムメトリクスは保持期間（最大 15 ヶ月）を過ぎれば自動失効する。
