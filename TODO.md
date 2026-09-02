# TODO — 盤後小幫手

> 勾選規則：一個 `[ ]` 大約是 30–60 分鐘能收尾的事。做完打 `[x]`。
> 目前進度：**M1（MVP）功能完成 — 待部署 GitHub Pages + 手機實測**

---

## 🟢 現在就做（M0：Python 邏輯驗證）

- [x] 建 `prototype/` 資料夾（requests 已安裝）
- [x] `prototype/fetch.py`：抓日收盤價（FinMind `TaiwanStockPrice`），存 `data/2330.json`
- [x] `prototype/deduction.py`：`load_closes` / `calc(dates, closes, period)` / `print_report`（MA5/10/20/60）
- [x] 程式內獨立重算驗證：MA20、扣抵值、上彎條件全對（見 `prototype/verify.md`）
- [x] 已輸出 `data/2330_tail.csv` 供 Excel 對照
- [x] 測資與限制寫進 `AGENTS.md`
- [ ] **← 換你做**：打開 `prototype/verify.md` 第 4 節，用 Excel 對 MA20 = 2396.0、D+1 扣抵值 = 2365.0
- [ ] 對得起來就回報，進 M1

---

## 🟡 M1：網頁 MVP（大部分完成）

### 骨架
- [x] `index.html`、`src/app.js`、`src/style.css`
- [x] `manifest.json`（名稱、SVG emoji icon、`display: standalone`）
- [x] hash 路由：`#/`、`#/stock/:code`、`#/settings`
- [x] `git init`、第一次 commit、建 GitHub repo（pweichi-art/post-market，公開）
- [x] 開 GitHub Pages → https://pweichi-art.github.io/post-market/（已上線實測 2317 OK）
- [ ] 手機實測「加到主畫面」← 換你做

### 資料層
- [x] `src/api.js`：`fetchStockList()` / `fetchDailyPrice()`（FinMind），9 秒逾時 + `ApiError`
- [x] `src/cache.js`：`idb-keyval` 存取 IndexedDB
- [x] 「先讀快取、缺的增量補抓」邏輯 + 抓失敗用舊快取撐住（stale 標記）

### 算法層
- [x] `src/deduction.js`：從 `prototype/deduction.py` 翻譯
- [x] `test/deduction.test.js`：4 個測試全過（合成資料 + 2330 真實 fixture）

### 畫面層
- [x] 首頁：搜尋框 + 結果下拉（代號/名稱模糊比對）+ 觀察清單
- [x] 個股頁：標題列（代號/名稱/收盤/漲跌/資料日期）
- [x] 扣抵值分析表：一張卡片 = 一條均線，未來 10 日
- [x] 上彎/下彎用箭頭 + 色 pill（修過一次 CSS 優先權 bug）
- [x] 頁尾免責聲明（固定）
- [x] 載入中 / 查無此股 / API 失敗 / 離線 狀態畫面
- [x] 觀察清單加入/移除（存 IndexedDB）※ 原列在 M4，先做了基本版

### 驗收（瀏覽器實測已過，手機待測）
- [x] `2330`、`台積電` 都能進台積電頁
- [x] 表格數字 = M0 Python 輸出（MA5=2412 / MA20=2396 / D+1扣抵=2365…）
- [x] 查無此股 → 「🤷 查無資料」不白屏
- [x] Console 無錯誤
- [ ] 手機 Chrome 打開 Pages 網址、加到主畫面、全螢幕開啟
- [ ] 關網路重開 → 顯示快取 + 離線標籤（需 Service Worker，排在 M6；目前僅 IndexedDB 快取）

---

## ⚪ M2：K 線圖
- [ ] CDN 引入 `lightweight-charts`
- [ ] 日 K series + MA5/10/20/60 line series
- [ ] 共用快取資料、手機可縮放

## ⚪ M3：籌碼面
- [ ] `getInstitutional(code)` 三大法人近 20 日
- [ ] `getMargin(code)` 融資融券
- [ ] 表格 + 長條圖 / 折線圖
- [ ] 區塊獨立失敗

## ⚪ M4：觀察清單
- [ ] 個股頁加入/移除觀察（存 IndexedDB）
- [ ] 首頁觀察股列表：距 MA20 上彎差額，可排序

## ⚪ M5：全市場掃描
- [ ] 批次抓（分批 + 限速 + 進度條）
- [ ] 篩「明日 MA20 由下彎轉上彎」
- [ ] 結果當日快取

## ⚪ M6：卡通風完稿 + PWA
- [ ] 配色/圓角/字體套用 UIUX.md
- [ ] 吉祥物插圖（各狀態）
- [ ] App icon 多尺寸、manifest 完整
- [ ] Service Worker 離線可開
- [ ] Lighthouse PWA 通過
- [ ] 寫 README

---

## 📌 隨時記錄（開發中發現的問題）
- （例）FinMind 某 API CORS 被擋 → 換 xxx / 加 proxy
-
