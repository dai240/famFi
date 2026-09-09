# famFi

家計・予定・家事・レシピをまとめる個人開発中のアプリです。

- 本番: https://famfi-nu.vercel.app
- 技術構成: Next.js / React / TypeScript / Prisma
- 現在の画面はサンプルデータで動作し、登録内容の DB 保存は未接続です。

## DB・認証を変更する前に

**予定している Supabase は、他の個人アプリと共有する `personal-apps` です。**
famFi がプロジェクト全体を所有している前提で初期化しないでください。

- [共有 DB の注意事項](docs/shared-database.md)
- [エージェント向けルール](AGENTS.md)
- [共通基盤の管理リポジトリ](https://github.com/dai240/personal-apps-infra)

DB 接続・ログイン・アクセス制御は今後の実装工程です。
共有基盤の整備と、famFi の業務機能の完成は別の作業として管理します。

## ローカル開発

```sh
npm ci
npm run dev
```

型チェックは `npx tsc --noEmit`、Lint は `npm run lint`、ビルドは `npm run build` です。
DB を利用する作業では先に共有基盤の最新状態・手順を確認してください。
