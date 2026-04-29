# Logs

> TODO: 執筆予定

## この章で扱う内容

- ロググループ / ログストリーム / 保持期間
- Logs Insights クエリ
- Live Tail
- Pattern analysis（機械学習によるパターン検出）
- Anomaly detector
- メトリクスフィルタとサブスクリプションフィルタ

## ハンズオン

[handson/chapter-04/](https://github.com/r-tamura/aws-cw-study/tree/main/handson/chapter-04) に CDK プロジェクトを置いた。要点は次の 4 つ。

1. TypeScript / Python の Lambda が **1 行 1 JSON** で構造化ログを出すと、CloudWatch Logs はそのまま JSON フィールドとして取り込み、Logs Insights から `fields level, requestId, durationMs` のように参照できる
2. ロググループは **CDK 側で明示的に作って 1 週間の保持期間**を付けると、`cdk destroy` で一緒に消える（Lambda 自動生成の LogGroup は残る点に注意）
3. **Logs Insights** で `pattern @message` / `stats count(*) by bin(1m), level` / ERROR 率時系列など 4〜5 個のクエリを試す
4. **メトリクスフィルタ** で `{ $.level = "ERROR" }` をネームスペース `AwsCwStudy/Ch04` のメトリクス `Ch04ErrorCount` に変換し、Ch 5 アラーム演習の素材にする

詳細手順とクエリ例、Live Tail コマンドは同ディレクトリの `README.md` を参照。

## 片付け

`npx cdk destroy` でスタックを削除すると、Lambda・API Gateway・関連 IAM ロール、そしてこのスタックで明示的に作ったロググループ（`removalPolicy=DESTROY` を指定）もまとめて消える。メトリクスフィルタはロググループに紐付くため、ロググループ削除と同時に消滅する。残ったログがあれば `aws logs delete-log-group --log-group-name /aws/lambda/aws-cw-study-ch04-...` で手動削除する。
