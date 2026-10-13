# GA4の計測

2026-10-13。本人の依頼により、famFiの利用状況をGA4へ送る。家計の中身を分析サービスへ転送しない。

## 対象

- GA4: `famfi-nu`、property `558646862`、web stream `16117723997`、測定ID `G-D4LJPG83ZY`。既存の本人アカウント画面で照合した。
- VercelのProductionだけに公開設定値 `NEXT_PUBLIC_GA_MEASUREMENT_ID` を登録する。秘密鍵やMeasurement ProtocolのAPI secretは不要。
- `VERCEL_ENV=production`、本番用schema、正規Origin `https://famfi-nu.vercel.app`、`/expenses` の条件を満たし、既存の認証付き支出APIが正常にデータを返してから読み込む。ログイン・開発・Preview・固有deployment URLではタグを読み込まない。
- ブラウザのDo Not TrackまたはGlobal Privacy Controlが有効なら読み込まない。計測スクリプトがブロックされても家計簿の読み書きは独立して動作する。

## 送るものと送らないもの

- 支出一覧/カレンダー、入出金、家計サマリー、立替・精算、予定・定期、共有メモ、家計共有、履歴の閲覧を `page_view` で送る。ページURLとタイトルは固定の許可リストから生成する。GA4上の `/expenses/summary` 等は画面集計用の仮想URLであり、アプリの追加ルートではない。
- 金額、日付/月の選択、カテゴリ、支払元、人物、ニックネーム、家計名、メール、メモ、検索語、レコードID、Auth情報をイベントへ渡さない。URLのquery/hashと流入元URLも送らない。入力/保存/CSVのカスタムイベントは追加しない。
- 再取得や同じ画面の再描画ではページビューを重複させない。別画面を経由して戻った場合は新しい閲覧として数える。
- Google Signalsと広告パーソナライズを無効にし、広告用途のstorage/user data/personalizationをdeniedとする。アプリのAuth UUIDをGA4のUser-IDへ接続しない。
- GA4の通常のブラウザ識別Cookie・端末情報・セッション/エンゲージメント等の計測は残る。「完全匿名」「一切の情報を送らない」という意味ではない。Cookieは正規ホストに限定する。

## GA4側の設定

2026-10-13に対象streamの拡張計測をOFFへ変更し、画面で保存を確認した。フォーム・サイト内検索・ダウンロード・外部リンク・履歴による自動イベントを有効にしない。`send_page_view: false` だけでは履歴イベントを止められないため、管理画面の設定も必要。

広告連携、ユーザー提供データの収集、追加タグや任意イベントの作成は今回の範囲外。他のGA4プロパティを変更しない。

公式仕様: [手動ページビュー](https://developers.google.com/analytics/devguides/collection/ga4/views)、[GA4設定項目](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)、[拡張計測](https://support.google.com/analytics/answer/9216061?hl=ja)。

## 検証・公開

計測設定・画面名の許可リスト・重複排除・本番ホスト限定・ログイン除外・広告無効を回帰テストする。検証用のURLや架空データをGA4へ送らず、送信先を捕捉するテストと、本番の既存本人セッションによる最小限の確認を区別する。

ローカル検証: 型検査、Lint（既存の試作img警告4件のみ）、単体64件、Production用Prisma生成とbuild・成果物検査が成功。`npm run test:analytics-browser` はChromium/WebKitで145項目成功。Googleの実タグを読み込み、送信を全件遮断・捕捉し、3画面の閲覧、再描画の重複なし、検索語/query/hash/家計名の非送信、ログイン・認証拒否・別ホスト・DNT/GPCの除外、タグ遮断時の登録画面を確認した。テストはローカルProduction buildをport 3113で起動し、APIを架空応答へ置き換える。実DBや本番の家計データへ接続しない。

公開後にdeployment、HTTP検査、実送信/GA4画面の確認結果を追記する。DB構造・Auth・家計データ・backup・他アプリは変更しない。
