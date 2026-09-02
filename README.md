# 盤後小幫手

台股**盤後**個股分析 PWA。輸入代號 / 名稱 → 看扣抵值分析（未來 N 天，股價要站上多少，MA5/10/20/60 才會上彎）。

> 本工具僅供個人研究參考，非投資建議。資料為未還原權值收盤價。

## 現況：M1（MVP）

- 股票搜尋（代號 / 名稱）
- 個股扣抵值分析表（MA5 / MA10 / MA20 / MA60）
- 觀察清單
- 本機快取（IndexedDB），離線可看上次資料
- 資料來源：[FinMind](https://finmindtrade.com/) 免費 API

規劃見 [SPEC.md](SPEC.md) / [ROADMAP.md](ROADMAP.md) / [TODO.md](TODO.md)。

## 本機開發

```bash
# 靜態伺服器（擇一）
python -m http.server 8777 --bind 127.0.0.1
# 開 http://127.0.0.1:8777/

# 跑算法測試
npm test        # 或 node --test test/deduction.test.js
```

無建置步驟，純 HTML / CSS / 原生 JS（ES Modules）。

## 目錄

```
index.html          進入點
manifest.json       PWA 設定
src/
  app.js            路由 + 畫面
  api.js            FinMind API
  cache.js          IndexedDB 快取
  deduction.js      扣抵值算法（對照 prototype/）
  style.css
prototype/          M0 Python 原型（驗證算法用）
test/               算法單元測試
```

## 佈署

GitHub Pages（`main` 分支根目錄）。push 後約 1–2 分鐘更新。
