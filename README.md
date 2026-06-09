# Keiba Public Full v9

v9追加内容:
- 加点ルールの点数を管理画面から編集可能
- 追い切り欄に調教コース表示を強化
- 騎手名クリックで騎手詳細を表示
  - 直近1ヶ月 / 本年度 / 通算
  - 開催場別・距離別の成績表示に対応
- 馬名クリックで競走馬詳細を表示
  - 基本情報
  - 出走予定/出走歴
  - 過去走
  - 追い切り履歴
  - 登録馬メモ
- JRA-VAN接続前でもサンプルデータで表示確認可能

Render更新時:
1. ZIPを解凍
2. GitHub Desktop管理フォルダの中身をv9の中身で差し替え
3. Summaryに `upgrade to v9` と入力
4. Commit to main
5. Push origin
6. Renderで Manual Deploy → Clear build cache & deploy

Build Command:
`npm install && npm rebuild better-sqlite3`

Start Command:
`node server/index.js`
