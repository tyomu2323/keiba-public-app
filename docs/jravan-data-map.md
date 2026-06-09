# JRA-VAN データ取り込みマップ

JRA-VAN契約後、取得データを以下のテーブルに流し込みます。

| 欲しい情報 | 保存先 |
|---|---|
| 今週の全レース | races |
| 出馬表 | entries / horses / jockeys / trainers |
| 全馬の過去レース | horse_past_runs / race_results |
| 追い切りタイム・ラップ・コース・馬なり/強め/一杯 | workouts |
| 直近1ヶ月の騎手成績 | jockey_stats period_type=recent_1m |
| 年間騎手成績 | jockey_stats period_type=year |
| 通算騎手成績 | jockey_stats period_type=lifetime |
| 開催場所ごとの騎手成績 | jockey_stats venueあり |
| 距離ごとの騎手成績 | jockey_stats distanceあり |
| 距離ごとの好走枠 | course_trends |
| そのレースの過去10年結果 | race_trends_10y |
| 土曜結果の日曜補正 | saturday_bias_results |
| オッズ5分更新 | odds_snapshots / entries.actual_odds |
| おすすめ馬 | recommendations |
| バイアス手入力 | biases |

## 金土日の取得設計

### 金曜夜
- 今週の全出馬表
- 追い切り
- 過去走不足分
- 騎手成績更新
- 過去10年傾向の不足分

### 土曜朝〜レース中
- オッズ
- 馬体重
- 取消/除外
- 結果

### 土曜夜
- 土曜結果集計
- 枠/脚質/時計傾向の素材作成

### 日曜朝〜レース中
- 土曜結果を見た手入力バイアス反映
- オッズ/馬体重/取消/結果の更新
