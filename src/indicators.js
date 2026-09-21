// 技術面指標（十字訣的「均・量・強・位」四項）
//
// 出處：朱家泓《抓住飆股輕鬆賺》第5篇第1章「看圖十字訣」、第3篇第5章「4種均線交易法」。
// 研究筆記見 RESEARCH-朱家泓選股指標.md。
//
// 這個模組只做「算數字」，不做任何買賣判斷、也不輸出中文標籤——
// 標籤與顏色留給 view 層（app.js），這樣才好寫單元測試。

/** 移動平均序列。回傳與 closes 等長的陣列，前面資料不足處為 null。 */
export function maSeries(closes, period) {
  const out = new Array(closes.length).fill(null);
  if (period < 1 || closes.length < period) return out;
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= period) sum -= closes[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

// ---------- 均：排列與糾結 ----------

/**
 * 均線排列 + 糾結度。
 * 多頭排列＝短天期均線由上而下依序排列（MA5 > MA10 > MA20 > ...）。
 * 糾結度＝(最大均線 − 最小均線) ÷ 收盤價，數字愈小代表均線擠得愈密。
 *
 * @param {number[]} closes 由舊到新的收盤價
 * @param {number[]} periods 均線週期（不必先排序）
 * @param {number} convergePct 視為「糾結」的門檻（百分比，預設 3）
 * @returns {{enough:boolean, mas?:Array, alignment?:string, spreadPct?:number,
 *            converged?:boolean, convergedDays?:number}}
 *   alignment: 'bull'（多頭排列）| 'bear'（空頭排列）| 'mixed'（交叉中）
 */
export function maAlignment(closes, periods, convergePct = 3) {
  const ps = [...new Set(periods)].sort((a, b) => a - b);
  const t = closes.length - 1;
  if (ps.length < 2 || t < 0 || closes.length < ps[ps.length - 1]) {
    return { enough: false };
  }

  const series = ps.map((p) => maSeries(closes, p));
  const vals = series.map((s) => s[t]);
  if (vals.some((v) => v == null)) return { enough: false };

  // 短天期在上 → 多頭排列；短天期在下 → 空頭排列
  let bull = true;
  let bear = true;
  for (let i = 0; i < vals.length - 1; i++) {
    if (!(vals[i] > vals[i + 1])) bull = false;
    if (!(vals[i] < vals[i + 1])) bear = false;
  }
  const alignment = bull ? 'bull' : bear ? 'bear' : 'mixed';

  const spreadAt = (idx) => {
    const v = series.map((s) => s[idx]);
    if (v.some((x) => x == null) || !closes[idx]) return null;
    return ((Math.max(...v) - Math.min(...v)) / closes[idx]) * 100;
  };

  const spreadPct = spreadAt(t);
  // 已經連續糾結幾天（往回數，含今天）
  let convergedDays = 0;
  for (let i = t; i >= 0; i--) {
    const s = spreadAt(i);
    if (s == null || s > convergePct) break;
    convergedDays += 1;
  }

  return {
    enough: true,
    mas: ps.map((p, i) => ({ period: p, value: round(vals[i], 4) })),
    alignment,
    spreadPct: round(spreadPct, 2),
    converged: spreadPct <= convergePct,
    convergedDays,
  };
}

// ---------- 位：股價在區間的位置 ----------

/**
 * 股價位置百分位：收盤價落在近 lookback 個交易日高低區間的第幾 %。
 * 書上分三段：山谷（底部區）／山腰／山頂（高檔區）。
 * @returns {{enough:boolean, pct?:number, zone?:string, high?:number, low?:number, bars?:number}}
 *   zone: 'valley'(<33%) | 'waist'(33~67%) | 'peak'(>67%)
 */
export function pricePosition(highs, lows, closes, lookback = 120) {
  const t = closes.length - 1;
  if (t < 0) return { enough: false };
  const from = Math.max(0, closes.length - lookback);
  const bars = closes.length - from;
  if (bars < 20) return { enough: false }; // 太短沒有參考價值

  const high = Math.max(...highs.slice(from));
  const low = Math.min(...lows.slice(from));
  if (!(high > low)) return { enough: false };

  const pct = ((closes[t] - low) / (high - low)) * 100;
  const zone = pct < 33 ? 'valley' : pct <= 67 ? 'waist' : 'peak';
  return { enough: true, pct: round(pct, 1), zone, high, low, bars };
}

// ---------- 量：量能倍數與價量配合 ----------

/**
 * 量能。ratio＝今日成交量 ÷ 前 n 日平均量（不含今日）。
 * pv＝今日相對昨日的價量配合狀態。
 * @returns {{enough:boolean, ratio?:number, avg?:number, pv?:string}}
 *   pv: 'up_vol_up'(價漲量增) | 'up_vol_down'(價漲量縮)
 *     | 'down_vol_down'(價跌量縮) | 'down_vol_up'(價跌量增) | 'flat'(價平)
 */
export function volumeSignal(closes, volumes, n = 20) {
  const t = volumes.length - 1;
  if (t < 1 || closes.length !== volumes.length) return { enough: false };
  const from = t - n;
  if (from < 0) return { enough: false };

  const prev = volumes.slice(from, t);
  const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
  if (!(avg > 0)) return { enough: false };

  const dPrice = closes[t] - closes[t - 1];
  const dVol = volumes[t] - volumes[t - 1];
  let pv;
  if (dPrice > 0) pv = dVol >= 0 ? 'up_vol_up' : 'up_vol_down';
  else if (dPrice < 0) pv = dVol >= 0 ? 'down_vol_up' : 'down_vol_down';
  else pv = 'flat';

  return { enough: true, ratio: round(volumes[t] / avg, 2), avg: Math.round(avg), pv };
}

// ---------- 強：相對大盤強弱 ----------

/** 把個股與大盤依日期對齊，只留兩邊都有的交易日。 */
export function alignByDate(rows, benchRows) {
  const b = new Map(benchRows.map((r) => [r.date, r.close]));
  const dates = [];
  const a = [];
  const c = [];
  for (const r of rows) {
    if (b.has(r.date)) {
      dates.push(r.date);
      a.push(r.close);
      c.push(b.get(r.date));
    }
  }
  return { dates, stock: a, bench: c };
}

/**
 * 相對強弱：個股 n 日報酬率 − 大盤 n 日報酬率（百分點）。
 * 正值＝強於大盤。書上「強」的第 1 項：比大盤。
 * @param {Array} rows      個股 [{date, close}]
 * @param {Array} benchRows 大盤 [{date, close}]
 * @param {number[]} spans  要算哪幾個天期
 * @returns {{enough:boolean, items?:Array<{n:number, stock:number, bench:number, rs:number}>}}
 */
export function relativeStrength(rows, benchRows, spans = [5, 20]) {
  const { stock, bench } = alignByDate(rows, benchRows);
  const t = stock.length - 1;
  if (t < 1) return { enough: false };

  const items = [];
  for (const n of spans) {
    const from = t - n;
    if (from < 0 || !stock[from] || !bench[from]) continue;
    const sRet = (stock[t] / stock[from] - 1) * 100;
    const bRet = (bench[t] / bench[from] - 1) * 100;
    items.push({ n, stock: round(sRet, 2), bench: round(bRet, 2), rs: round(sRet - bRet, 2) });
  }
  return items.length ? { enough: true, items } : { enough: false };
}

// ---------- 小工具 ----------

function round(x, d) {
  if (x == null || !Number.isFinite(x)) return null;
  const p = 10 ** d;
  return Math.round(x * p) / p;
}
