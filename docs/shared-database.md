# famFi の DB は他の個人アプリと共用です

2026-09-09 に、famFi 専用として用意されていた Supabase を、個人開発用の共通基盤 `personal-apps` として再利用する方針になりました。

| 項目 | 値 |
| --- | --- |
| Supabase project | `personal-apps`（旧 `famFi`） |
| Project ref | `fpptihhtyhehpjvmtuqt` |
| famFi の専用スキーマ | `famfi` |
| 管理リポジトリ | https://github.com/dai240/personal-apps-infra |
| ローカル管理場所 | `/Users/dai/study/app/personal-apps-infra` |
| 別管理のテニス用 DB | `sateni`。このアプリの作業対象ではありません |

## 先に読むもの

共有基盤の最新状態は、管理リポジトリの `docs/status.md` を確認してください。
設計・変更履歴・新しいアプリの追加方法は、管理リポジトリを正本とします。
このリポジトリだけを見て Supabase を初期化・リセットしないでください。

## famFi の現状と接続条件

2026-09-09 に支出MVPと本人のメールコードログインを確認しました。Prismaコンパイラの同梱漏れを修正後、本番でテスト支出の保存・再表示・編集・削除・CSV出力、支出を含む暗号化バックアップとローカル復元が成功しています。テスト支出1件は本人の承認後に削除し、再読み込みと専用runtimeの読み取りで支出0件・0円、カテゴリ10件、本人の有効なmembership1件を確認しました。本番への復元はしていません。実機スマホ・別端末確認は未完了です。最新状態は管理リポジトリの `docs/status.md` と `docs/famfi-onboarding-2026-09-09.md` を確認してください。

- 適用済みSQL: 管理リポジトリの `20260909095423_famfi_expense_mvp.sql` と `20260909122110_famfi_expense_date_precision.sql`。後者は支出に月のみ/日付指定の区別を追加し、既存データを維持する。
- 実テーブル: `famfi.memberships`、`famfi.categories`、`famfi.expenses`。RLSを有効化・強制。
- 接続: 非所有者の `famfi_app` LOGIN が `famfi_runtime` の限定権限を継承。接続数上限10、アプリ側プール最大2。
- `prisma/schema.prisma` はこの3モデルだけを対象とする。旧モデルは `docs/drafts/future-models.prisma.txt` に退避し、適用しない。
- Authはサーバーの `getUser()` で検証し、同一トランザクションで `app.user_id` と有効なmembershipを確認する。クライアントの `userId` は受け付けない。
- Auth公開キーは認証用のみ。`famfi` はData APIに公開せず、ブラウザからテーブルを直接取得しない。
- Supavisor transaction poolerを使用し、Prismaのpg adapterでCA・ホスト名を検証する。TLS検証を無効にしない。

DB全体への `db push` やリセットは禁止です。共有DBの変更履歴は管理リポジトリに集約します。
他ユーザー・無認証・他スキーマへの拒否は検証済みですが、ローカルの架空AuthでのCRUD検証を本人の本番ログイン検証と混同しないでください。

本人アカウント、バックアップ、デプロイ手順は [運用手順](operations.md) を参照してください。

## 共用時の注意点

- `famfi` 以外のアプリのスキーマ、共有の認証台帳を勝手に変更しない。
- 共通 Auth のユーザー削除・キー変更・設定変更は他アプリにも影響する。
- 家族に famFi を許可しても、他の個人ツールの利用権限は付けない。
- スキーマ分割だけで隔離は完成しない。DBロール、権限、RLSを合わせて確認する。
- 容量・負荷・プロジェクト停止の影響は共有する。
- 秘密情報をこのドキュメントや Git に書かない。

## 別アプリを追加したくなったら

このチャットでは、次のように依頼できます。

> 「アプリ名」を personal-apps の共有 DB に接続したいです。
> 場所は「ローカルパスまたは GitHub URL」です。
> 保存したいデータは「内容」です。利用者は「自分だけ／家族など」です。
> 基盤管理リポジトリの最新手順を確認して、別アプリのエージェントに渡す作業指示を作ってください。

具体的な追加手順と、エージェントへ直接渡せる依頼文は、管理リポジトリの `docs/adding-an-app.md` にあります。
