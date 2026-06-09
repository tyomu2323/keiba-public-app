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


## V11
- 騎手詳細の距離別戦績をJRAで出る主要距離すべてに固定表示
- 開催場別戦績を札幌/函館/福島/新潟/東京/中山/中京/京都/阪神/小倉で固定表示
- 詳細モーダルの閉じるボタンをスクロール中も常時表示

## V12 更新
- 騎手詳細の「距離別」と「コース別」を統合し、「コース×距離別」として表示。
- 芝/ダート × 1000m〜3600mの主要距離を固定表示。
