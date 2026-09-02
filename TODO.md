# TODO — 盤後小幫手

> 勾選規則：一個 `[ ]` 大約是 30–60 分鐘能收尾的事。做完打 `[x]`。
> 目前進度：**M0 完成（程式面）— 待使用者做 Excel 手動對照**

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

## ⚪ 接著做（M1：網頁 MVP）

### 骨架
- [ ] `index.html`（單頁）、`src/app.js`、`src/style.css`
- [ ] `manifest.json`（名稱、icon 佔位、`display: standalone`）
- [ ] hash 路由：`#/` 與 `#/stock/:code`
- [ ] `git init`、第一次 commit、建 GitHub repo、開 GitHub Pages（見 GUIDE.md）

### 資料層
- [ ] `src/api.js`：`getStockList()` / `getDailyK(code, fromDate)`（FinMind）
- [ ] `src/cache.js`：用 `idb-keyval` 存取 IndexedDB
- [ ] 「先讀快取、缺的再補抓」邏輯
- [ ] API 逾時（8 秒）與失敗處理，回傳結構化錯誤

### 算法層
- [ ] `src/deduction.js`：從 `prototype/deduction.py` 逐行翻譯
- [ ] `test/deduction.test.js`：用 M0 的測資斷言（可用瀏覽器內簡單 assert，或 Vitest）

### 畫面層
- [ ] 首頁：搜尋框 + 結果下拉（代號/名稱模糊比對）
- [ ] 個股頁：標題列（代號/名稱/收盤/漲跌/資料日期）
- [ ] 扣抵值分析表元件：一張卡片 = 一條均線，含未來 10 日
- [ ] 上彎/下彎用形狀 + 色（見 UIUX）
- [ ] 頁尾免責聲明（每頁）
- [ ] 載入中 / 查無此股 / API 失敗 / 離線 四種狀態畫面

### 驗收
- [ ] 手機 Chrome 打開 GitHub Pages 網址、加到主畫面、全螢幕開啟
- [ ] `2330`、`台積電` 都能進台積電頁
- [ ] 表格數字 = M0 Python 輸出
- [ ] 關網路重開 → 顯示快取 + 離線標籤
- [ ] API 網址打錯 → 友善錯誤，不白屏

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
