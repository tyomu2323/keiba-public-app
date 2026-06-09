# 競馬予想ツール DB設計 v6

この版は、ユーザーが話していた理想形に合わせてDBの受け皿を作った版です。

## 保存対象

### 永久保存系
- 馬情報
- 騎手情報
- 調教師情報
- レース情報
- レース結果
- 全馬の過去走
- コース別/距離別/枠別傾向
- 同レース過去10年傾向
- 騎手成績

### 週ごとに更新する系
- 今週の出馬表
- 追い切り
- オッズ
- 馬体重
- 取消/除外
- 土曜結果からの日曜補正用データ

### 管理者が入力する系
- 馬場バイアス
- 内外バイアス
- 脚質バイアス
- 時計バイアス
- おすすめ馬
- 買い方メモ
- 独自理論の加点/減点ルール

## 主要テーブル

| テーブル | 役割 |
|---|---|
| horses | 馬情報 |
| jockeys | 騎手情報 |
| trainers | 調教師情報 |
| races | レース基本情報 |
| entries | 出馬表 |
| race_results | レース結果 |
| horse_past_runs | 馬ごとの過去走 |
| workouts | 追い切り |
| jockey_stats | 騎手成績。直近1ヶ月/年間/通算/開催場/距離別を格納 |
| course_trends | 開催場・距離・枠ごとの好走傾向 |
| race_trends_10y | 同レース過去10年傾向 |
| saturday_bias_results | 土曜結果から日曜補正に使う集計元 |
| biases | 管理者手入力の馬場バイアス |
| scoring_rules | 独自理論の加点/減点ルール |
| horse_scores | 馬ごとの加点理由 |
| odds_snapshots | オッズ履歴。5分ごと更新向け |
| recommendations | 管理者おすすめ馬 |
| watch_horses | 注目馬/追いかけたい馬 |
| fetch_logs | データ取得ログ |

## 追い切り評価

`workouts` に以下を保存します。

- コース
- ラップ
- 6F〜1F
- 終い1F
- 全体時計
- 馬なり/強め/一杯
- レース内順位
- percentile
- top15_flag
- top25_flag

評価例：

```text
上位15%: A評価
上位25%: B評価
それ以外: C以下
```

## 騎手成績

`jockey_stats` は同じテーブルに以下を入れます。

- 直近1ヶ月: period_type = recent_1m
- 年間: period_type = year
- 通算: period_type = lifetime
- 開催場別: venueに値を入れる
- 距離別: distanceに値を入れる
- 芝/ダート別: surfaceに値を入れる

## バイアス

土曜結果は `saturday_bias_results` に保存。

そのデータを見たうえで、管理者が `biases` に手入力します。

例：

```text
東京 芝
内 +5
外 -2
逃げ +6
先行 +4
差し -2
時計 高速 +3
```

## 理論オッズ

馬ごとの点数は `horse_scores` に理由付きで保存します。

最終的に `entries` に以下を保存します。

- expected_win_rate
- theoretical_odds
- actual_odds
- score

例：

```text
推定勝率 18%
理論オッズ 5.6倍
実オッズ 12.4倍
期待値あり
```

## JRA-VAN連携時の流れ

```text
JRA-VAN / JV-Link
↓
Windows PC取得プログラム
↓
SQLite DBへ保存
↓
集計/スコア計算
↓
Render公開アプリが表示
```

## 初回インポート

最初だけ過去10年分をまとめて取得してDBに保存します。

2回目以降は今週分だけ追加します。

```text
初回: 過去10年
毎週: 今週分 + オッズ/馬体重/結果
```
