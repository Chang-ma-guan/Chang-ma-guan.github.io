# 張麻館

家人共用的麻將輸贏帳本。每場輸入四位成員的金額、胡牌、自摸與放槍數，網站會自動整理賽季排行、勝率、平均輸贏與參與占比。

## 功能

- 家庭成員新增、改名、代表色與停用管理
- 對局新增、編輯與刪除
- 金額自動平帳檢查
- 依賽季或成員篩選統計
- 淨輸贏、勝率、平均、最佳單場、胡牌／自摸／放槍統計
- CSV 匯出，可直接用 Excel 開啟
- 家庭通關碼，不必註冊帳號
- 獨立 Firebase Firestore 共用資料庫（台灣區域）
- 手機與桌機響應式介面

## 本機開發

```bash
npm install
npm run dev
```

網站以 Vite、React、TypeScript 與 Firebase 建置，推送到 `main` 後由 GitHub Pages 自動發布。

## Firebase

- 專案：`chang-ma-guan`
- 驗證：匿名登入，家人以至少 8 個字元的通關碼進入
- 資料：`rooms/{通關碼雜湊}` 下的成員、對局與結果
- 規則：`firestore.rules`
