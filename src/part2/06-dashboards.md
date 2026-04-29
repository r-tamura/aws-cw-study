# Dashboards

> TODO: 執筆予定

## この章で扱う内容

- Automatic dashboards（サービス別の自動ダッシュボード）
- カスタムダッシュボードのウィジェット種類
- 変数（Dashboard variables）と動的ダッシュボード
- ダッシュボードの IaC 化（CloudFormation / Terraform）

## ハンズオン

[handson/chapter-06/](https://github.com/r-tamura/aws-cw-study/tree/main/handson/chapter-06) に CDK プロジェクトを置いた。要点は次の通り。

1. **EMF を emit する Lambda** を 1 分ごとに EventBridge で起動し、`AwsCwStudy/Ch06` 名前空間の `OrderCount` / `OrderLatency` を継続的に流し込む
2. CDK の `Dashboard` で **4 種類のウィジェット**を一度に定義する:
   - **GraphWidget** … 2 メトリクス + `MathExpression`（`m2/m1` で「1 注文あたりレイテンシ」を派生）
   - **SingleValueWidget** … 直近 `OrderLatency` を sparkline 付きで KPI 表示
   - **LogQueryWidget** … Lambda のロググループに対する Logs Insights クエリ結果（直近 20 件）
   - **AlarmWidget** … `OrderLatency > 1000ms` のアラーム状態としきい値帯
3. **`SearchExpression`** を使った GraphWidget も追加し、新しいディメンション値が増えると**ダッシュボードを書き換えずに**系列が増える挙動を確認する
4. **Dashboard 変数**（`Environment`）でウィジェット全体の表示環境を切り替える

デプロイ後、約 5 分でダッシュボードに値が乗る。直接 URL は `https://<region>.console.aws.amazon.com/cloudwatch/home?region=<region>#dashboards:name=AwsCwStudy-Ch06`。

コンソール側で **Actions → View/edit source** を開くと CDK が生成したダッシュボード JSON が見られる。`lib/stack.ts` のウィジェット定義と JSON フィールドを 1:1 で見比べることで、IaC 化のメリット（再現性・差分管理・コードレビュー可能性）が体感できる。詳しくは同ディレクトリの `README.md` を参照。

## 片付け

```bash
cd handson/chapter-06
npx cdk destroy
```

`cdk destroy` で Lambda / EventBridge Rule / OrderLatency Alarm / Dashboard / LogGroup がまとめて削除される。
