# famFi 運用手順

## 本番利用開始の残作業

対象は `personal-apps` / `fpptihhtyhehpjvmtuqt` のみ。先に基盤リポジトリの最新状態を読むこと。

1. 本人にログイン用メールアドレスを確認する。管理画面のアカウントから推測しない。
2. 共有Authの既存ユーザーを確認し、同じ本人がいれば再利用する。いなければ公式の管理APIまたは管理画面で登録し、本人がメールを受け取れることを確認する。`auth.users` へSQLで直接ユーザーを作らない。
3. 確認したAuth UUIDを `famfi.memberships` に登録する。アプリ実行ロールには登録権限を与えない。`FAMFI_ALLOWED_EMAIL` をVercelのProductionに設定する。
4. 既存のメールテンプレート・配信設定を確認する。コード入力はメール内の `{{ .Token }}` が必要。既存リンクを壊さずコードを追記し、他アプリへの影響を基盤に記録する。共有の新規登録OFF・他アプリのredirect URLを維持する。
5. Supabase標準メールは配信先・送信回数に制約がある。実際の宛先に届くかを確認し、カスタムSMTPが必要なら既存設定と費用を確認してから設定する。メールやドメインを勝手に購入しない。
6. 本番へ再デプロイし、本人がメールコードでログインする。パスワードやコードをGit・ログへ残さない。
7. 本番で支出の登録・再表示・編集・削除・CSV・ログアウト・再ログインを確認する。別端末でも同じ記録が見えることを確認する。テスト入力は本人が分かる名前で作り、実記録と混ぜない。
8. 初回バックアップを取得し、ローカルの使い捨てDBで復旧する。確認後に基盤台帳のfamFiを `connected` へ更新する。

現状は最初のメールアドレス待ちで、Authユーザー・membership・本番支出は0件。画面を公開しただけでは利用開始完了としない。

## 設定とデプロイ

- `.env.example` が設定項目の一覧。DB URLや管理用トークンを `NEXT_PUBLIC_*` に置かない。
- 通常の接続は `famfi_app` のみ。Production用の資格情報をPreviewに登録しない。
- CAはSupabase管理画面のConnectから取得した公開証明書。`certs/supabase-ca.crt` を各APIの成果物に含める。`rejectUnauthorized: false` や `NODE_TLS_REJECT_UNAUTHORIZED=0` は禁止。
- プールのホストは `aws-1-ap-southeast-1.pooler.supabase.com:6543`、ユーザー名は `famfi_app.fpptihhtyhehpjvmtuqt`。管理者の接続情報で代用しない。
- `.private/`、すべてのローカルenv、秘密鍵はGitとVercelアップロードの両方から除外する。
- Nextのトレースでもローカルenvと `.private/` を除外する。ビルド後に `npm run check:artifact` で秘密設定の非同梱とCA同梱を確認する。
- 本番ドメインは `https://famfi-nu.vercel.app`。`APP_ORIGIN` はこのOriginに限定する。Preview URLでの書き込みは許可しない。
- VercelとGitHubの自動連携は未接続。現時点では、確認・コミット・push後に `npx vercel --prod --yes --scope day56s-projects` で公開する。デプロイがReadyになり、APIの未認証拒否も確認する。

資格情報の初回移送には `scripts/provision-transport.mjs` を使用した。DB内で生成したパスワードを公開鍵で暗号化して移送し、ローカルで復号する。鍵と復号結果は `.private/` のみ。`scripts/configure-production.mjs --vercel` はその資格情報をCLIのstdin経由でProductionに登録する。値を引数・出力に含めない。通常運用で再発行しない。

## バックアップ

アプリ単位の支出JSONをOpenPGPで暗号化して保存する。CSVは便利な持ち出し用で、UUID・更新情報を保つ復旧用バックアップの代替ではない。

```sh
npm run backup -- init
npm run backup -- create <確認済みの本人Auth-UUID>
npm run backup -- verify <出力された.json.pgpファイル>
```

- 保存先: `~/.local/share/famfi-backups/`。ディレクトリ700、鍵・バックアップ600。Git外。
- DB URLは `.private/database-url` から読む。別環境では `FAMFI_BACKUP_DATABASE_URL` を安全な秘密情報管理から注入する。シェル履歴へ直接書かない。
- 本人の有効なmembershipを要求し、読み取り専用の一貫したスナップショットで本人の支出とカテゴリを取得する。共有Auth、他アプリ、ロールパスワードは含めない。
- `keys/private.asc` は復号に必須。鍵も同じMacに置くだけではMac紛失に耐えない。鍵の別途暗号化保管先と、バックアップの別端末・別ストレージ保存先を本人と決める。現状は未設定。
- 当面は利用日の終わりとDB変更前に手動取得する。自動実行は未登録なので、設定完了までは自動バックアップがあると扱わない。
- 本人未登録のため、実データの初回バックアップは未実施。暗号化・復号・使い捨てDBへの復元はテスト済み。

## 復旧

1. 元DBを変更する前に最新データも退避し、復元対象の本人UUID・件数・日付範囲を確認する。内容をチャットに貼らない。
2. 管理リポジトリのマイグレーションを空のローカルDBへ適用する。ローカルに同じUUIDのAuth代替行とmembershipを準備する。共有本番DBをリセットしない。
3. `decryptBackup` でメモリ内復号し、保存された `id / userId / amount / date / categoryId / description / memo / version / createdAt / updatedAt` をパラメータ化INSERTで `famfi.expenses` へ復元する。SQL列名は `user_id / category_id / created_at / updated_at`。日付はdate、タイムスタンプはtimestamptzとして保存する。
4. 復元先の本人コンテキストで件数・月別合計・全項目を照合し、他ユーザーから見えないことも確認する。`npm run test:db` に暗号化バックアップからの復元例がある。
5. 本番への反映は差分と競合を確認してから、対象famFiの本人行だけを管理作業で反映する。Authユーザー全体の削除や共有プロジェクト全体の巻き戻しをしない。

## 検証範囲と残リスク

ローカル統合テストは実際のNext APIとPrismaを通すが、Authは架空のローカルサーバー。メール配信・実Supabaseセッション・別端末確認は別途必要。実接続の `npm run check:runtime` は非認証コンテキストの非公開性、他スキーマ・DDL・管理ロールへの拒否を確認し、実ユーザーデータを書き込まない。

Next.jsを15.5.25に更新した。`npm audit` にはPrisma CLIの設定マージ依存 `deepmerge-ts` 由来のhighが3ノード残る。同じ1件の再帰入力によるスタック枯渇で、アプリは利用者入力をPrisma設定に渡さない。互換性を壊す強制ダウングレードは行わず、Prismaの互換修正を追跡する。旧レシピ試作画面にはimgのLint警告が残るが、本番ルーティングから除外している。
