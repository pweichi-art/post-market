// 使用者偏好：均線週期。存 localStorage（同步讀取、只在這台裝置）。

const KEY = 'ma_periods';
export const DEFAULT_PERIODS = [5, 10, 20, 60];

const MIN = 2;    // 至少要 N+1 筆資料才算得出「今日 vs 昨日」均線
const MAX = 240;  // 約一年交易日；回補天數 550 日夠用
const MAX_COUNT = 6; // 再多線圖會變義大利麵

/** 清理：去重、限制範圍、排序、限數量。空的就回預設。 */
function sanitize(arr) {
  const clean = [...new Set((arr || []).map(Number))]
    .filter((n) => Number.isInteger(n) && n >= MIN && n <= MAX)
    .sort((a, b) => a - b)
    .slice(0, MAX_COUNT);
  return clean.length ? clean : [...DEFAULT_PERIODS];
}

export function getMaPeriods() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitize(JSON.parse(raw)) : [...DEFAULT_PERIODS];
  } catch {
    return [...DEFAULT_PERIODS];
  }
}

export function setMaPeriods(arr) {
  const clean = sanitize(arr);
  try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch { /* 私密瀏覽等情況略過 */ }
  return clean;
}

/** 「主要均線」——觀察清單、掃描頁預設值用它。取中間那條：
 *  預設 [5,10,20,60] → 20（維持原本行為）；[10,20,60,120] → 60。 */
export function primaryPeriod(periods = getMaPeriods()) {
  return periods[Math.floor(periods.length / 2)];
}

export { MIN as MA_MIN, MAX as MA_MAX, MAX_COUNT as MA_MAX_COUNT };
