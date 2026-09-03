// K 線圖 + 均線疊圖（TradingView Lightweight Charts v4，CDN 延遲載入）
//
// 決策（記於 AGENTS.md）：
//   K 棒沿用台股慣例「紅漲綠跌」——這是圖表通用語意、非買賣訊號，不違反 R3。
//   均線用藍/紫/琥珀/灰四色，刻意避開紅綠。

const LWC_URL =
  'https://cdn.jsdelivr.net/npm/lightweight-charts@4.2.3/dist/lightweight-charts.standalone.production.js';

let libPromise = null;
let active = null; // { chart, ro }

function loadLib() {
  if (window.LightweightCharts) return Promise.resolve(window.LightweightCharts);
  if (libPromise) return libPromise;
  libPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = LWC_URL;
    s.async = true;
    s.onload = () => resolve(window.LightweightCharts);
    s.onerror = () => { libPromise = null; reject(new Error('圖表元件載入失敗')); };
    document.head.appendChild(s);
  });
  return libPromise;
}

function isDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function palette() {
  return isDark()
    ? { bg: '#2A2622', text: '#B7AEA3', grid: '#3A342E', border: '#4A423B',
        up: '#E45B5B', down: '#3AAF7A' }
    : { bg: '#FFFFFF', text: '#7A736B', grid: '#F1E9DD', border: '#E7DCCB',
        up: '#D64545', down: '#2E9E63' };
}

const MA_COLORS = { 5: '#5B8DEF', 10: '#B57EDC', 20: '#E0A93C', 60: '#8A8F98' };

function movingAverage(rows, period) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < rows.length; i++) {
    sum += rows[i].close;
    if (i >= period) sum -= rows[i - period].close;
    if (i >= period - 1) out.push({ time: rows[i].date, value: +(sum / period).toFixed(4) });
  }
  return out;
}

/** 銷毀目前的圖表（換股 / 離開頁面時呼叫）。 */
export function destroyChart() {
  if (!active) return;
  try { active.ro?.disconnect(); } catch {}
  try { active.chart?.remove(); } catch {}
  active = null;
}

/**
 * 在 container 內畫 K 線 + 均線。
 * @param {HTMLElement} container 已在 DOM 上、有寬度的容器
 * @param {Array} rows [{date, open, max, min, close}]（由舊到新）
 * @param {number[]} periods 要疊哪幾條均線
 */
export async function renderChart(container, rows, periods = [5, 10, 20, 60]) {
  const LWC = await loadLib();
  destroyChart();
  container.innerHTML = '';

  const c = palette();
  const chart = LWC.createChart(container, {
    width: container.clientWidth,
    height: container.clientHeight || 300,
    layout: { background: { color: c.bg }, textColor: c.text, fontFamily: 'inherit' },
    grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
    rightPriceScale: { borderColor: c.border },
    timeScale: { borderColor: c.border, rightOffset: 3, fixLeftEdge: true },
    crosshair: { mode: LWC.CrosshairMode.Normal },
    localization: { locale: 'zh-TW' },
    handleScale: { axisPressedMouseMove: false },
  });

  const candle = chart.addCandlestickSeries({
    upColor: c.up, downColor: c.down,
    borderUpColor: c.up, borderDownColor: c.down,
    wickUpColor: c.up, wickDownColor: c.down,
  });
  candle.setData(rows.map((r) => ({
    time: r.date, open: r.open, high: r.max, low: r.min, close: r.close,
  })));

  for (const p of periods) {
    if (rows.length < p) continue;
    const line = chart.addLineSeries({
      color: MA_COLORS[p] || '#999',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    line.setData(movingAverage(rows, p));
  }

  // 預設顯示最近 ~120 根
  const n = rows.length;
  chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 120), to: n + 3 });

  // 隨容器寬度縮放
  const ro = new ResizeObserver(() => {
    chart.applyOptions({ width: container.clientWidth });
  });
  ro.observe(container);

  active = { chart, ro };
  return chart;
}
