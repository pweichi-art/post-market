# AGENTS.md — 給 AI 助手（Claude Code 等）的專案守則

這份檔案是給「未來接手這個專案的 AI 助手」看的。人類請看 `SPEC.md` / `ROADMAP.md`。

---

## 專案一句話

台股**盤後**個股分析 PWA，核心是「扣抵值 / 均線上彎」分析。單一使用者、純前端、無後端、部署在 GitHub Pages。

## 目前狀態（2026-09-03）

- **M0 完成**：`prototype/` Python 原型，扣抵值算法已驗證（見 `prototype/verify.md`）
- **M1（MVP）完成**：搜尋 → 扣抵值表 + 觀察清單 + IndexedDB 快取
- **M2 完成**：個股頁 K 線圖 + MA5/10/20/60 疊圖（`src/chart.js`，lightweight-charts v4 CDN 延遲載入）
- **M3 完成**：三大法人買賣超 + 融資融券（`src/chips.js` 整理、`src/cache.js` getInstitutional/getMargin、chart.js 兩個新圖表）
- 已上線：https://pweichi-art.github.io/post-market/（GitHub Pages，main 根目錄）
- GitHub：`pweichi-art/post-market`（公開）
- 待辦：手機實測；下一階段 **M4 = 觀察清單強化 / M5 全市場掃描**
- 需求凍結見 `SPEC.md`

### 籌碼面資料單位
- 三大法人 FinMind buy/sell 是「股」，`chips.js` 除以 1000 轉「張」後取整。
- 分群：外資 = Foreign_Investor + Foreign_Dealer_Self；投信 = Investment_Trust；
  自營 = Dealer_self + Dealer_Hedging。
- 融資融券 balance 已是「張」。融資融券資料常比三大法人晚一天釋出（卡片各自標日期）。
- chart.js 現在可同時掛多張圖，`destroyChart()` 一次清光；router 換頁時呼叫。

### K 線顏色決策
K 棒用台股慣例「紅漲綠跌」——這是圖表通用語意、非買賣訊號，不違反 R3。
均線用藍(MA5)/紫(MA10)/琥珀(MA20)/灰(MA60)，刻意避開紅綠。

### 快取新鮮度
`getPriceSeries` 只在「快取最後一根 K 棒日期 >= 台北今日」時才略過 API；
否則每次開啟都做增量補抓（從最後日期起，成本低），失敗才退回舊快取。

### 與 SPEC 檔案結構的差異（MVP 取捨）
- `src/views/` 尚未拆分，首頁/個股/設定的渲染函式全放在 `src/app.js`。
  M2 之後 app.js 變大時再拆。
- Service Worker（離線）延到 M6，目前離線僅靠 IndexedDB 快取（重開分頁可讀舊資料，
  但完全離線首載會失敗）。
- 觀察清單（原 M4）已先做基本版，因為它幫助日常試用。

---

## 硬性規則（不要違反）

1. **不做買賣訊號**：全站禁止出現「買 / 賣 / 進場 / 出場 / 建議」字樣、紅綠燈號、箭頭以外的方向暗示。只呈現數字、方向詞（上彎/下彎/走平）、圖表。
2. **不加後端**：不要引入伺服器、資料庫、雲端函式。唯一例外：若 API 有 CORS 問題，可加一個 Cloudflare Workers 免費 proxy，且需先問使用者。
3. **不加登入 / 帳號 / 雲端同步**：所有資料存在使用者裝置（IndexedDB）。
4. **免費資料來源**：只用 FinMind、證交所 / 櫃買 OpenAPI 等免費且免付費金鑰的來源。
5. **每頁必須有免責聲明**：「本工具僅供個人研究參考，非投資建議，據此操作損益自負。」
6. **算法先驗證再實作**：JS 版扣抵值算法必須對照 M0 Python 原型的測資通過測試，才能接進畫面。
7. **無建置步驟優先**：能用原生 HTML/CSS/JS + CDN 就不要引入打包工具，除非使用者同意。
8. **改動前先讀 `TODO.md`**，做完更新勾選狀態與「隨時記錄」區。

---

## 技術棧

| 項目 | 選擇 |
|---|---|
| 前端 | 原生 HTML + CSS + JS（ES Modules），hash 路由 |
| 圖表 | lightweight-charts（CDN，pin 版本） |
| 本機儲存 | IndexedDB（idb-keyval） |
| 資料 API | FinMind 主 / 證交所 OpenAPI 備援 |
| 部署 | GitHub Pages（`main` 分支 `/` 或 `/docs`） |
| 語言/註解 | 繁體中文優先 |

---

## 檔案結構（規劃，實作時建立）

```
PostMarket/
├── SPEC.md / ROADMAP.md / UIUX.md / TODO.md / AGENTS.md / GUIDE.md
├── prototype/            # M0：Python 原型，驗證算法用，不部署
│   ├── fetch.py
│   ├── deduction.py
│   └── verify.png
├── index.html
├── manifest.json
├── sw.js                 # M6 才加
├── src/
│   ├── app.js            # 路由 + 進入點
│   ├── api.js            # 資料來源
│   ├── cache.js          # IndexedDB
│   ├── deduction.js      # 核心算法（對照 prototype）
│   ├── views/            # 首頁 / 個股 / 設定
│   └── style.css
├── test/
│   └── deduction.test.js
└── assets/               # icon、插圖
```

---

## 已驗證邏輯（M0 完成後填寫，實作 JS 版時當測資）

### 扣抵值定義
收盤價序列 `close[]`，今天 index = `t`，均線週期 `N`：

- `MA(N)_today = mean(close[t-N+1 .. t])`
- **未來第 k 個交易日扣抵值 = `close[t-N+k]`**（k = 1..N）
- 未來第 k 日「均線上彎所需價位」= 該日扣抵值
- 上彎條件：該日收盤 > 該日扣抵值
- 每日均線變化量（價格固定 P）≈ `(P - 當日扣抵值) / N`

### 測資（M0 已驗證，2026-09-03，見 prototype/verify.md）
```
股票：2330   資料截止日：2026-09-02   今日收盤 close[t] = 2385.0
資料來源：FinMind TaiwanStockPrice（未還原權值），370 個交易日

period = 20：
  MA20 today      = 2396.0
  MA20 yesterday  = 2397.0
  trend           = 下彎（2396.0 < 2397.0）
  D+1 扣抵值       = 2365.0  （= close[t-20+1]，日期 2026-08-06）
  D+2 扣抵值       = 2370.0  （日期 2026-08-07）
  D+3 扣抵值       = 2380.0  （日期 2026-08-10）
  上彎條件驗證：明日收盤 = 扣抵值 → MA 走平；> 扣抵值 → MA 上彎（已用增量公式驗證）

JS 版 deduction.js 完成後，用這組數字寫斷言測試。
```

### 已知限制
- FinMind 免費版僅「未還原權值」收盤（TaiwanStockPriceAdj 需付費）。除權息跳空會使
  除息日附近的均線/扣抵值失真 → 個股頁需標註「未還原權值」。
- 「未來第 k 日扣抵值」僅在 k ≤ N 時存在（MA5 只能看未來 5 天），程式須自行截斷。
- Windows 終端機需強制 stdout UTF-8，否則中文亂碼（fetch.py / deduction.py 已加）。

---

## 常見雷區

- **FinMind 限流**：免登入約 300 次/小時。批次掃描（M5）務必分批 + 延遲 + 快取當日結果。
- **交易日 ≠ 日曆日**：扣抵值一律用「交易日」計算，別用日期加減。
- **除權息**：FinMind 收盤價是否還原權值要確認；分析均線建議用「還原股價」，實作前查清楚並記在此。
- **停牌 / 新股**：資料不足 N 筆時，扣抵值表要顯示「資料不足」而非算出錯誤數字。
- **時區**：台股收盤 13:30 (UTC+8)。判斷「今天資料出了沒」要用台北時間。

---

## 與使用者協作

- 使用者是 **AI coding 初學者**，請：解釋術語、一步一步、改動前說明原因、不要一次丟大量程式碼。
- 使用者偏好：繁體中文、PWA、免費方案、每天約 1 小時開發節奏。
- 這個資料夾由「這個視窗」全權負責；若偵測到其他視窗同時改動，先提醒使用者。
