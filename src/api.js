// FinMind 免費 API 存取層
// 文件：https://finmindtrade.com/analysis/#/data/api
// 免登入約 300 次/小時，單人使用足夠。回應格式：{ status, msg, data: [...] }

const FINMIND_URL = 'https://api.finmindtrade.com/api/v4/data';

/** 呼叫 API 失敗時丟這個，view 層據此顯示友善訊息。 */
export class ApiError extends Error {
  constructor(message, kind = 'unknown') {
    super(message);
    this.name = 'ApiError';
    this.kind = kind; // 'timeout' | 'network' | 'server' | 'unknown'
  }
}

async function fetchData(params, { timeoutMs = 9000 } = {}) {
  const url = new URL(FINMIND_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

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
    throw new ApiError('網路連線失敗', 'network');
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
