# 予定・まとめ記録とボトムナビの本番反映

2026-09-10。本人からの本番反映依頼。公開結果は検証後に追記する。

## 今回の範囲

- Previewで検証した確認待ちバッジ、確認開始日・延期、前回確定額・2か月周期、費用区分、単発予定、まとめ記録と明細の紐づけを本番へ移す。
- スマホは「支出 / 立替・精算 / 中央の+ / 予定・定期 / メニュー」。中央の+はどの画面からでも支出を登録でき、閉じる/保存後も元の画面へ戻る。支出の初期値は今日・家族カード・ログイン本人・家族を維持。
- 変更履歴・マスタ管理・表示名・ログアウトはメニューにまとめる。表示名はヘッダーからも変更可能。PCの上部タブは維持する。メニュー項目を利用者が自由に増減する機能ではない。
- 確認待ちの黄色い件数はスマホの予定・定期にも表示。確認日前、延期中、確定済み、スキップ、停止中は件数に含めない。実績を削除すると未確定へ戻るが、定期設定そのものがない場合は件数を出さない。
- 本番DBのみ正本の `famfi_planning` を適用。Previewのデータ/資格情報/ビルド成果物は本番へ移さず、famfi向けのPrismaを生成して別のProduction buildを作る。

## 運用

- `FAMFI_DB_SCHEMA=famfi node --import tsx scripts/planning-release-check.mjs before` で実runtimeによるv5バックアップとローカル復元を確認。
- 本番移行後は同じコマンドの `after <beforeの暗号化ファイル>` で全旧項目照合、v6暗号化バックアップ/復元、ROLLBACK付き権限・まとめ記録の制約検査、ROLLBACK後の全項目再照合。
- 通常のbackup createは対象スキーマの機能を検出し、移行前はv5、移行後はv6。Productionは `~/.local/share/famfi-backups/`、Previewは専用の保存先・鍵を引き続き使用する。v1〜v5のローカル復元も維持。
- 共有Auth、テニス、Compath、Previewのデータ・参加者設定は変更しない。妻のメール確認・招待は別工程。
- `FAMFI_TEST_SCHEMA=famfi` で使い捨てテストを本番スキーマに向けられる。これはローカルの架空Auth/DBだけを使い、実本番への接続設定は読まない。

## 残る作業

妻の招待・実機利用、日常バックアップの頻度と別保存先、共通口座への入金/残高/引落、一括精算・相殺、CSV取込/明細照合、比較グラフ。今回の公開をこれらまで完成した状態とは扱わない。

## DB更新の検証

- 正本 `20260910042033_famfi_planning.sql` を対象project `fpptihhtyhehpjvmtuqt` へ適用し、共有履歴11件を確認。旧全項目の照合は一致。
- 直前v5: `famfi-2026-09-10T04-19-53-115Z.json.pgp`。直後v6: `famfi-2026-09-10T04-20-50-690Z.json.pgp`。どちらもGit外に暗号化保存し、ローカル復元を確認した。
- 実runtimeでまとめ記録1万円/明細3千円/残額7千円、超過拒否、未認証・未参加者・他schemaの拒否を確認。検査の書込みはすべてROLLBACKし、全v6項目を再照合した。
- Compathのstate/参加者、Previewの支出、本番の家計参加者、共有アプリ台帳のハッシュは前後一致。共有Authの設定変更なし。
- Security Advisorは従来の[管理台帳RLS既定拒否INFO](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)と[共有Authの漏洩パスワード保護OFF WARN](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)のみ。性能は既存の[RLS initplan警告8件](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)と未使用index情報。共有設定や制約indexは変更しない。
