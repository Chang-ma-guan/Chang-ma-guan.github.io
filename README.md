# 張麻館

家人共用的麻將輸贏帳本。每場輸入四位成員的金額、胡牌、自摸與放槍數，網站會自動整理賽季排行、勝率、平均輸贏與參與占比。

## 功能

- 家庭成員新增、改名、代表色與停用管理
- 對局新增、編輯與刪除
- 金額自動平帳檢查
- 依賽季或成員篩選統計
- 淨輸贏、勝率、平均、最佳單場、胡牌／自摸／放槍統計
- CSV 匯出，可直接用 Excel 開啟
- Cloudflare D1 共用資料庫
- 手機與桌機響應式介面

## 本機開發

```bash
npm install
npm run dev
```

網站以 Vinext、React、TypeScript 與 Cloudflare D1 建置，部署設定位於 `.openai/hosting.json`。
