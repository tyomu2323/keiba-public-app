# Keiba Public Full

公開用の競馬分析ダッシュボード雛形です。

## 機能
- 一般公開画面
- 管理者ログイン
- 管理者おすすめ馬登録
- バイアス手入力
- 任意タイミングの手動データ取得ボタン
- 金土日スケジュール取得の雛形
- JRA-VAN / JV-Link 連携アダプタ差し替え口

## ローカル起動
```bash
npm install
cp .env.example .env
npm run seed
npm start
```

http://localhost:3000 を開きます。

管理画面: http://localhost:3000/admin.html
初期ログインは `.env` の ADMIN_USER / ADMIN_PASSWORD を使います。

## 注意
JRA-VANの実取得にはWindows PC、JRA-VAN Data Lab.契約、JV-Link、利用キー設定が必要です。
このプロジェクトには実キーや認証情報を含めないでください。


## v5: 管理者ログイン付き公開運用

- 公開画面: ログイン不要
- 管理画面: ログイン必須
- 検索避け: noindex,nofollow
- 推奨公開先: Render（Node/Expressサーバーとして起動）
- 詳細: docs/deploy-admin-login.md
