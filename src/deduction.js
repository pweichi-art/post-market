// 扣抵值 / 均線上彎 計算核心
//
// 這是從 prototype/deduction.py 逐段翻譯過來的。
// 數字必須和 Python 版一致 —— 測試見 test/deduction.test.js。
//
// 名詞（詳見 SPEC.md 第 3 節 / AGENTS.md 已驗證邏輯）：
//   收盤價序列 closes[]，今天是最後一筆 index = t，均線週期 N
//   今日 MA(N) = 最近 N 天收盤價平均
//   未來第 k 個交易日的扣抵值 = closes[t - N + k]
//   上彎條件：未來第 k 日收盤 > 該日扣抵值

export function mean(xs) {
  return xs.reduce((sum, x) => sum + x, 0) / xs.length;
}

function round(x, digits) {
  const p = 10 ** digits;
  return Math.round(x * p) / p;
}

/**
 * 計算單一週期的扣抵值分析。
 * @param {string[]} dates  由舊到新的日期字串
 * @param {number[]} closes 由舊到新的收盤價
 * @param {number}   period 均線天數 N（5 / 10 / 20 / 60）
 * @param {number}   futureN 往後看幾個交易日（預設 10）
 */
export function calcMA(dates, closes, period, futureN = 10) {
  const n = period;
  const t = closes.length - 1; // 今天

  // 至少要 N+1 筆才能同時算「今日 MA」與「昨日 MA」
  if (closes.length < n + 1) {
    return { period: n, enoughData: false };
  }

  const maToday = mean(closes.slice(t - n + 1, t + 1)); // 最近 N 天
  const maYesterday = mean(closes.slice(t - n, t));     // 往前挪一天

  let trend = 'flat';
  if (maToday > maYesterday) trend = 'up';
  else if (maToday < maYesterday) trend = 'down';

  const lastClose = closes[t];

  // 未來第 k 日扣抵值 = closes[t - n + k]，需 k <= n
  const future = [];
  for (let k = 1; k <= futureN; k++) {
    const idx = t - n + k;
    if (idx < 0 || k > n) break;
    future.push({ k, date: dates[idx], deduction: closes[idx] });
  }

  // 假設股價維持在今日收盤價，均線可連續上彎幾天
  let holdUpDays = 0;
  for (const fd of future) {
    if (lastClose > fd.deduction) holdUpDays += 1;
    else break;
  }

  return {
    period: n,
    enoughData: true,
    maToday: round(maToday, 4),
    maYesterday: round(maYesterday, 4),
    trend,           // 'up' | 'down' | 'flat'（今日 vs 昨日）
    lastClose,
    holdUpDays,
    future,          // [{ k, date, deduction }]
  };
}

/** 對多個週期一次算完。 */
export function analyze(dates, closes, periods = [5, 10, 20, 60], futureN = 10) {
  return periods.map((p) => calcMA(dates, closes, p, futureN));
}
