# JRA-VAN連携設計

## 前提
JRA-VAN Data Lab. を使う場合、Windows PCにJV-Linkを入れて利用キーを設定します。JRA-VAN公式サイトではData Lab.を「JRA公式データ」として提供しており、JV-Linkを使ったアプリ連携が前提です。

## 推奨構成

```text
Windows PC
  └─ JRA-VAN Data Lab. / JV-Link
  └─ 取得スクリプト
  └─ SQLiteへ保存
  └─ GitHubへJSON/DB更新 push
       ↓
Netlify / Render等で公開
```

## 実装方針

この雛形では `server/services/jravan-adapter.js` を差し替え口にしています。

本番では次のどちらかにします。

### A. C#ブリッジ推奨
- C#でJV-Link COMを呼ぶ
- 出馬表、成績、追い切り、騎手データをJSON出力
- Node側がJSONをSQLiteへ取り込む

### B. PowerShell / Python補助
- PowerShellでCOM呼び出し
- JSONファイル出力
- Node側がJSON取り込み

## 管理画面の任意取得
`/admin.html` の「任意タイミングでデータ取得」から以下を実行できます。

- 今週全レース
- 出馬表
- 追い切り
- 結果
- 騎手成績

現在は sample データ取得です。`.env` の `DATA_SOURCE=jravan` にするとJRA-VANアダプタを呼びます。

## 金土日自動取得
Windowsタスクスケジューラで以下を登録します。

```text
金曜 22:00 npm run fetch:weekend
土曜 07:00 npm run fetch:weekend
土曜 18:00 npm run fetch:weekend
日曜 07:00 npm run fetch:weekend
日曜 18:00 npm run fetch:weekend
```

## セキュリティ
- JRA-VAN利用キーはGitHubに入れない
- `.env` は公開しない
- 管理者パスワードは必ず変更
- 公開サーバーにJRA-VAN認証情報を置かない運用を推奨
