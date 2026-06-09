# 公開方法

## 最初のおすすめ
Render / Railway などNodeサーバーを動かせる無料枠に置く。
Netlifyだけだと静的サイトなので、今回の管理者ログインAPIとSQLiteをそのまま動かせません。

## 無料寄り構成
- 公開アプリ: Render無料枠など
- DB: SQLite（小規模）または無料PostgreSQL
- 取得PC: 自宅Windows PC
- JRA-VAN: 別途月額

## 注意
管理者ログイン付きにしたので、前回の静的Netlify単体構成より本格寄りです。
Netlifyでやる場合は、Netlify Functionsや外部DBに置き換えます。
