# famFi

最初の目標は「本人が日々の支出管理を始めること」です。予定・家事・レシピなどは後続の開発に分けています。

- 本番: https://famfi-nu.vercel.app
- 技術構成: Next.js 15 / React 18 / TypeScript / Prisma 6 / Supabase Auth・Postgres
- 実装済み: メールコード認証、支出の追加・編集・削除、月のみの記録、月別集計、色付きカテゴリ選択・絞り込み、CSV出力。
- 本番確認済み: 本人のメールコードログイン、支出の保存・再表示・編集・削除、月別集計・絞り込み、CSV出力、支出を含む暗号化バックアップとローカル復元。テスト支出は本人の承認後に削除し、0件・0円を確認済み。
- 残作業: 本番画面からのログアウト後の再ログイン、実機スマホ・別端末での確認、バックアップの別保存先・自動実行。詳細は [最初のゴールと残作業](docs/expense-mvp.md)。

## DB・認証を変更する前に

日付と親子カテゴリの設計・本番MVPとの差分は [日付・カテゴリ仕様](docs/expense-input-and-categories.md) を参照してください。

**Supabase は、他の個人アプリと共有する `personal-apps` です。**
famFi がプロジェクト全体を所有している前提で初期化しないでください。

- [共有 DB の注意事項](docs/shared-database.md)
- [エージェント向けルール](AGENTS.md)
- [共通基盤の管理リポジトリ](https://github.com/dai240/personal-apps-infra)
- [最初のゴールと残作業](docs/expense-mvp.md)
- [未実装機能・支払元・立替精算・使いやすさの方針](docs/expense-roadmap.md)
- [本番利用開始・バックアップの手順](docs/operations.md)

業務APIは `famfi_app` 専用接続と RLS で保護しています。共有Authに登録されているだけでは、famFiの利用権限はありません。

## ローカル開発

```sh
npm ci
npx prisma generate
npm test
npm run typecheck
npm run lint
npm run build
```

実データを使わない開発・検証では、隣に `personal-apps-infra` をチェックアウトし、以下を実行します。

```sh
npm run test:db
npm run test:stack
# 別ターミナルで実行
npm run test:api
```

検証画面は `http://127.0.0.1:3101`。架空の認証と使い捨てのローカルPostgresを使い、実メールやSupabaseには接続しません。ログインは `fixture0@example.invalid` / `111111`。終了は Ctrl+C、検証データは破棄されます。別パスの基盤リポジトリは `INFRA_PATH` で指定できます。

通常の開発サーバーは `npm run dev`。接続設定は `.env.example` と運用手順を参照してください。本番DBをPreviewやテストに使い回さないでください。
