# 公開方法（管理者ログイン付き）

この版は管理画面だけログイン必須です。公開画面は誰でも閲覧できます。検索エンジン避けとして `noindex,nofollow` を入れています。

## ローカル起動

```bash
npm install
cp .env.example .env
npm run seed
npm start
```

公開画面: http://localhost:3000
管理画面: http://localhost:3000/admin.html

## 管理者ログイン

`.env` の以下を変更してください。

```env
ADMIN_USER=admin
ADMIN_PASSWORD=change-me
JWT_SECRET=change-this-long-random-string
```

本番公開では必ず `ADMIN_PASSWORD` と `JWT_SECRET` を変更してください。

## Renderで公開する場合

- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variables:
  - `ADMIN_USER`
  - `ADMIN_PASSWORD`
  - `JWT_SECRET`
  - `NODE_ENV=production`

## Netlifyについて

Netlifyだけで公開すると静的HTMLは出せますが、この版の管理者ログイン/API/DBはExpressサーバーが必要です。
管理者ログイン付きでそのまま動かすならRender/RailwayなどのNodeサーバー公開が向いています。

将来的にNetlifyを使う場合は、公開画面をNetlify、APIサーバーをRenderに分ける構成にしてください。
