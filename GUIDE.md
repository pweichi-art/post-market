# GUIDE — 新手工具箱（GitHub / Claude / Plugin / 佈署）

寫給 AI coding 初學者。看不懂的地方直接問 Claude「這段是什麼意思」。

---

## 一、GitHub 新手流程圖

### 先搞懂三個名詞
| 名詞 | 白話 |
|---|---|
| **Git** | 你電腦上的「存檔器」，幫程式碼記錄每一次修改，可回到任一版本 |
| **GitHub** | 網路上的倉庫，把你電腦的存檔備份上去，也能公開分享 / 部署網站 |
| **Repository（repo）** | 一個專案 = 一個倉庫 |
| **commit** | 一次存檔（含說明文字） |
| **push** | 把本機存檔上傳到 GitHub |
| **pull** | 把 GitHub 上的更新抓回本機 |
| **branch** | 分身。在分身上實驗，不會弄壞主線（main） |

### 一次性設定（每台電腦做一次）
```bash
git config --global user.name "你的名字"
git config --global user.email "pweichi@gmail.com"
# 到 github.com 註冊帳號
# 安裝 GitHub CLI: https://cli.github.com  然後：
gh auth login          # 跟著問答做，選 HTTPS、用瀏覽器登入
```

### 這個專案的流程圖

```
┌────────────────────────────────────────────────────┐
│ 1. 第一次：把資料夾變成 git 倉庫                       │
│    cd "g:/wc agent/PostMarket"                       │
│    git init                                          │
│    git add .                                         │
│    git commit -m "初始版本：規劃文件"                  │
│    gh repo create post-market --private --source=. --push │
│         （--private = 私人倉庫，含選股邏輯不公開）      │
└────────────────────────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────┐
│ 2. 每天開發循環（重複做）                              │
│                                                     │
│   寫程式 / 改檔案                                     │
│      │                                              │
│      ▼                                              │
│   git status          ← 看改了哪些檔                  │
│   git add .           ← 把改動加入這次存檔             │
│   git commit -m "做了什麼"   ← 存檔 + 寫說明           │
│   git push            ← 上傳 GitHub                   │
└────────────────────────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────┐
│ 3. 想做有風險的大改動時：開分身                        │
│    git checkout -b try-scan     ← 建立並切到新分支     │
│    ...改一改，commit...                               │
│    成功 → git checkout main                          │
│           git merge try-scan    ← 合併回主線          │
│    失敗 → git checkout main      ← 直接丟掉分身        │
│           git branch -D try-scan                     │
└────────────────────────────────────────────────────┘
```

### 出事了怎麼辦
| 情況 | 指令 |
|---|---|
| 還沒 commit，想丟掉某檔改動 | `git checkout -- 檔名` |
| 剛 commit 想反悔（還沒 push） | `git reset --soft HEAD~1` |
| 想看歷史 | `git log --oneline` |
| 想回到某個版本看看 | `git checkout <前7碼hash>`，看完 `git checkout main` |

> 在 Claude Code 裡：你可以直接說「幫我 commit 並 push」，它會幫你做。但**指令自己也要會**，才知道它在做什麼。

---

## 二、Claude Code 各項功能解釋

### 你會用到的核心
| 功能 | 白話 | 怎麼用 |
|---|---|---|
| **一般對話** | 直接叫它寫 / 改 / 解釋程式 | 打字就好 |
| **Plan Mode（規劃模式）** | 讓它「先想好步驟給你看」再動手，不會亂改 | 按 `Shift+Tab` 切換，或說「進入 plan mode」 |
| **Skill（技能）** | 針對特定任務的內建 SOP（如寫規格、做 code review） | 打 `/skill名稱`，或它自己判斷該用 |
| **Subagent（子代理）** | 另開一個 AI 分身去做獨立大任務，做完回報 | 說「用 subagent 幫我…」 |
| **Memory（記憶）** | 跨對話記住你的偏好與專案狀態 | 說「記住這件事」；它存在 `~/.claude/.../memory/` |
| **CLAUDE.md / AGENTS.md** | 專案規則檔，每次對話自動載入 | 放專案根目錄，寫下「不准做什麼、慣例是什麼」 |
| **`/init`** | 掃描專案、自動生成 CLAUDE.md | 專案有一定規模後跑一次 |
| **`/code-review`** | 審查你的改動找 bug | commit 前跑 |
| **`/config`** | 改設定（模型、主題等） | |
| **權限模式** | 控制它能不能不問你就執行指令 / 改檔 | 啟動時選，或 `/permissions` |

### 建議的工作習慣（新手版）
1. 每個新功能：先請它**進 Plan Mode 給計畫**，你看懂了再讓它做
2. 一次只做一小塊（對應 `TODO.md` 一個勾）
3. 每做完一塊：自己看 `git diff` → 問它「這段在幹嘛」→ commit
4. 卡住就貼錯誤訊息，別自己硬改
5. 重要決定（技術選型、砍功能）請它記進 memory 或對應的 `.md`

### `/loop`、`/schedule`（進階，暫時用不到）
- `/loop`：每隔幾分鐘重複跑一個指令（例如定時檢查）
- `/schedule`：排程雲端代理定時執行
- 這個專案「打開才抓資料」，用不到排程。先跳過。

---

## 三、目前這個專案用到的 Plugin & Skill

### MCP 伺服器（外掛工具，已安裝在你環境）
| 名稱 | 作用 | 這專案會用嗎 |
|---|---|---|
| **firecrawl** | 網頁抓取 / 搜尋 | 查 API 文件時可能用 |
| **chrome-devtools** | 用真實 Chrome 測網頁、看 console/network/效能 | ✅ M1 之後測 PWA 很有用 |
| **playwright** | 瀏覽器自動化操作 | 備用 |
| **wmux browser** | 右側可視瀏覽器面板（你環境特有） | ✅ 平常瀏覽都用這個 |

### Skill（任務 SOP）— 這專案建議用這幾個
| Skill | 何時用 |
|---|---|
| `/spec`（agent-skills:spec） | 已做完需求確認，可用它把 SPEC 再結構化 |
| `/plan`（agent-skills:plan） | 把某個里程碑拆成更細任務 |
| `/build`（agent-skills:build） | 按計畫逐步實作、測試、commit |
| `/test`（agent-skills:test） | 幫扣抵值算法寫測試（TDD） |
| `/code-review` | 每個里程碑結束前審查 |
| `dataviz` | 做 K 線圖 / 法人長條圖前讀，配色與圖表規範 |
| `artifact-design` | 若要做 HTML 原型 / 分享頁 |
| `frontend-ui-engineering`（agent-skills） | 做卡通風 UI、無障礙時參考 |
| `update-config` | 要設定自動化 hook / 權限時 |

### Subagent（子代理）— 需要時再叫
| Agent | 用途 |
|---|---|
| `agent-skills:code-reviewer` | 深度 code review |
| `agent-skills:test-engineer` | 設計測試策略 |
| `agent-skills:web-performance-auditor` | PWA 效能稽核（M6） |
| `claude-code-guide` | 問「Claude Code 怎麼用」 |

> 規則（來自你的全域設定）：**內建 skill 與 agent-skills 外掛重疊時，預設用內建**；你明確指定就照你說的。

### 這專案「不需要」的
- pptx / 各種文件 skill（沒有簡報需求）
- schedule / loop（不做排程）
- 資料庫 / 後端相關

---

## 四、佈署教學（GitHub Pages）

### 為什麼選 GitHub Pages
- 免費、無限流量（個人用途）
- 純靜態網頁（HTML/CSS/JS）直接放，不用伺服器
- 跟你的程式碼同一個 repo，push 就自動更新

### 一次性設定
```bash
# 1. 確定專案已經是 git repo 且推上 GitHub（見「一、GitHub 流程」）
# 2. 專案根目錄要有 index.html
```
然後到 GitHub 網站：
```
你的 repo → Settings → Pages
  Source: Deploy from a branch
  Branch: main   /(root)      → Save
```
等 1–2 分鐘，網址會出現在同一頁：
`https://<你的帳號>.github.io/post-market/`

### 之後每次更新
```bash
git add .
git commit -m "更新扣抵值表樣式"
git push
# 等 1–2 分鐘，重新整理網頁就是新版
```

### PWA 要注意
- `manifest.json` 裡的路徑要用相對路徑（因為網址有 `/post-market/` 這層子目錄）
- Service Worker（`sw.js`）註冊時 scope 也要注意子目錄
- 手機測試：Chrome 打開網址 → 選單「加到主畫面」→ 從桌面圖示開啟應會全螢幕

### 手機無法安裝 / 樣式沒更新？
| 問題 | 解法 |
|---|---|
| 改了沒變化 | Service Worker 快取住了 → DevTools → Application → Unregister，或改 `sw.js` 版本號 |
| 無法「加到主畫面」 | 檢查 manifest 是否有效、要有 icon、要 HTTPS（Pages 本來就是 HTTPS） |
| 圖片 / JS 404 | 路徑寫成絕對路徑 `/xxx` 了，改成 `./xxx` |

### 私人 repo 也能用 Pages 嗎
可以，但免費版私人 repo 的 Pages 網址仍是**公開可存取**的。這個 App 沒有機密（只顯示公開股市資料），設 public 或 private 都行；若擔心選股邏輯外流就設 private。

---

## 五、你的第一步（照這個順序）

1. 讀完 `SPEC.md`、`ROADMAP.md`（15 分鐘）
2. 跟 Claude 說：「幫我進 plan mode，規劃 M0 的 Python 原型」
3. 看懂計畫 → 讓它做 → 你跑跑看 → 用 Excel 對數字
4. `git init` + 推上 GitHub（跟 Claude 說「教我一步一步做」）
5. 開始 M1
