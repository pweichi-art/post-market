// FinMind 免費 API 存取層
// 文件：https://finmindtrade.com/analysis/#/data/api
// 免登入約 300 次/小時，單人使用足夠。回應格式：{ status, msg, data: [...] }

const FINMIND_URL = 'https://api.finmindtrade.com/api/v4/data';
const TOKEN_KEY = 'finmind_token';

/** 呼叫 API 失敗時丟這個，view 層據此顯示友善訊息。 */
export class ApiError extends Error {
  constructor(message, kind = 'unknown') {
    super(message);
    this.name = 'ApiError';
    this.kind = kind; // 'timeout' | 'network' | 'server' | 'unknown'
  }
}

// FinMind 免登入約 300 次/小時；免費註冊拿 token 可拉高到 600 次/小時。
// Token 只是流量額度、非機密憑證，存 localStorage 即可（見 AGENTS.md）。
export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* 私密瀏覽模式等情況下略過 */ }
}

async function fetchData(params, { timeoutMs = 9000 } = {}) {
  const url = new URL(FINMIND_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const token = getToken();
  if (token) url.searchParams.set('token', token);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`, 'server');
    const body = await res.json();
    if (body.status !== 200) throw new ApiError(body.msg || 'FinMind 錯誤', 'server');
    return body.data || [];
  } catch (err) {
    if (err.name === 'AbortError') throw new ApiError('連線逾時', 'timeout');
    if (err instanceof ApiError) throw err;
    // fetch 對「真的斷網」和「伺服器擋掉但沒給 CORS 標頭（例如 FinMind 流量
    // 額度用完時回 402、沒有 Access-Control-Allow-Origin）」丟出一樣的
    // TypeError，前端分不出來。navigator.onLine 還是 true 時，多半是後者。
    if (navigator.onLine) {
      throw new ApiError('資料來源暫時連不上（可能是 FinMind 免費額度用完），請稍後再試', 'blocked');
    }
    throw new ApiError('網路連線失敗，請檢查網路', 'network');
  } finally {
    clearTimeout(timer);
  }
}

/** 全上市 / 上櫃 / 興櫃股票清單。欄位：stock_id, stock_name, type, industry_category */
export function fetchStockList() {
  return fetchData({ dataset: 'TaiwanStockInfo' });
}

/**
 * 某股票每日行情（未還原權值）。
 * @param {string} stockId 例 '2330'
 * @param {string} startDate 'YYYY-MM-DD'
 * 回傳：[{ date, open, max, min, close, Trading_Volume, ... }]（由舊到新）
 */
export function fetchDailyPrice(stockId, startDate) {
  return fetchData({
    dataset: 'TaiwanStockPrice',
    data_id: stockId,
    start_date: startDate,
  });
}

/**
 * 三大法人買賣超（單位：股）。每個交易日每個法人類別一筆。
 * name: Foreign_Investor / Foreign_Dealer_Self / Investment_Trust / Dealer_self / Dealer_Hedging
 */
export function fetchInstitutional(stockId, startDate) {
  return fetchData({
    dataset: 'TaiwanStockInstitutionalInvestorsBuySell',
    data_id: stockId,
    start_date: startDate,
  });
}

/** 融資融券（單位：張）。每個交易日一筆。 */
export function fetchMargin(stockId, startDate) {
  return fetchData({
    dataset: 'TaiwanStockMarginPurchaseShortSale',
    data_id: stockId,
    start_date: startDate,
  });
}
