# Keiba Public App V10

## V10追加
- 騎手詳細を「直近1ヶ月 / 本年度 / 通算」に分割
- 各期間ごとに「総合 / 距離別 / コース別 / 開催場別」を表示
- 戦績表記を `1着-2着-3着-4着-5着以下` 形式に変更
- JRA-VAN接続後は、騎手成績データを同じ形式でDBに保存して表示可能

## 起動
```bash
npm install
npm start
```

Render Build Command:
```bash
npm install && npm rebuild better-sqlite3
```

Render Start Command:
```bash
node server/index.js
```
