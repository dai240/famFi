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

最新の家計共有・支払元必須・定期支出は [夫婦の家計](household-workflow.md)。以下は初回MVPと支出拡張の記録。家計共有版では `households` / `household_members` / `recurring_rules` / `recurring_occurrences` / `audit_events` を追加し、業務行の `user_id` は家計IDとして維持する。本人のAuth UUIDを業務行の所有者へ直接流さず、家計参加を照合する。妻のmembership追加だけではアクセスできず、既存家計への明示的な参加設定が必要。新規家計を作る管理操作と、既存家計への参加は分ける。

2026-09-09 に支出MVPと本人のメールコードログイン、支出CRUD・CSV・暗号化バックアップ・ローカル復元を確認しました。初回のテスト支出は本人承認後に削除済みですが、その後に登録された実支出は削除対象ではありません。カテゴリ・人物・支払元・精算の拡張前には実支出1件を退避しました。本番への復元はしていません。実機スマホ・別端末確認は未完了です。最新の適用状態は管理リポジトリの `docs/status.md` を確認してください。

- 適用済みSQL: 管理リポジトリの `20260909095423_famfi_expense_mvp.sql` と `20260909122110_famfi_expense_date_precision.sql`。後者は支出に月のみ/日付指定の区別を追加し、既存データを維持する。
- 追加SQL: 管理リポジトリの適用済み `20260909133732_famfi_expense_management.sql`。利用者別カテゴリ・人物・支払元・精算を追加した。仕様は [追加仕様](expense-management.md)、適用状態は基盤の記録が正本。
- 拡張後のテーブル: `famfi.memberships`、`famfi.categories`（固定の初期テンプレート）、`famfi.category_entries`、`famfi.parties`、`famfi.payment_sources`、`famfi.expenses`、`famfi.settlements`。RLSを有効化・強制。
- 接続: 非所有者の `famfi_app` LOGIN が `famfi_runtime` の限定権限を継承。接続数上限10、アプリ側プール最大2。
- `prisma/schema.prisma` は固定テンプレート以外の6モデルだけを対象とする。旧モデルは `docs/drafts/future-models.prisma.txt` に退避し、適用しない。複合FK・DB制約・権限・triggerは基盤のSQLが正本。
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
