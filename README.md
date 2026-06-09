# keiba-public-app v13

公開用の競馬分析ダッシュボードです。

## V13 追加内容

- 騎手詳細の距離成績を「芝」「ダート」に分離表示
- 芝距離別、ダート距離別、開催場別をそれぞれ確認可能
- 馬詳細に「基本 / 追い切り / 過去走」ジャンプボタンを追加
- 過去走の上がりを順位付きで表示
  - 1位：🥇金
  - 2位：🥈銀
  - 3位：🥉銅
- 詳細モーダルを閉じたら画面トップへ戻る
- 詳細を開くたびにモーダル内スクロール位置を先頭にリセット

## Render設定

Build Command:

```bash
npm install && npm rebuild better-sqlite3
```

Start Command:

```bash
node server/index.js
```

Environment Variables:

```text
ADMIN_USER=admin
ADMIN_PASSWORD=任意の管理者パスワード
JWT_SECRET=長いランダム文字列
NODE_ENV=production
```
