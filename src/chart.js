// K 線圖 + 均線疊圖（TradingView Lightweight Charts v4，CDN 延遲載入）
//
// 決策（記於 AGENTS.md）：
//   K 棒沿用台股慣例「紅漲綠跌」——這是圖表通用語意、非買賣訊號，不違反 R3。
//   均線用藍/紫/琥珀/灰四色，刻意避開紅綠。

const LWC_URL =
  'https://cdn.jsdelivr.net/npm/lightweight-charts@4.2.3/dist/lightweight-charts.standalone.production.js';

let libPromise = null;
const actives = []; // [{ chart, ro }]

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

// 建一張圖 + 綁 ResizeObserver + 登記到 actives，回傳 { LWC, chart, palette }
function makeChart(container, extraOpts = {}) {
  const c = palette();
  const chart = window.LightweightCharts.createChart(container, {
    width: container.clientWidth,
    height: container.clientHeight || 220,
    layout: { background: { color: c.bg }, textColor: c.text, fontFamily: 'inherit' },
    grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
    rightPriceScale: { borderColor: c.border },
    timeScale: { borderColor: c.border, rightOffset: 2, fixLeftEdge: true },
    localization: { locale: 'zh-TW' },
    ...extraOpts,
  });
  const ro = new ResizeObserver(() => chart.applyOptions({ width: container.clientWidth }));
  ro.observe(container);
  actives.push({ chart, ro });
  return { LWC: window.LightweightCharts, chart, c };
}

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

/** 銷毀頁面上所有圖表（換股 / 離開頁面時呼叫）。 */
export function destroyChart() {
  while (actives.length) {
    const a = actives.pop();
    try { a.ro?.disconnect(); } catch {}
    try { a.chart?.remove(); } catch {}
  }
}

/**
 * 在 container 內畫 K 線 + 均線。
 * @param {HTMLElement} container 已在 DOM 上、有寬度的容器
 * @param {Array} rows [{date, open, max, min, close}]（由舊到新）
 * @param {number[]} periods 要疊哪幾條均線
 */
export async function renderChart(container, rows, periods = [5, 10, 20, 60]) {
  await loadLib();
  container.innerHTML = '';
  const { chart, c } = makeChart(container, {
    height: container.clientHeight || 300,
    crosshair: { mode: LWC_CrosshairNormal() },
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

  const n = rows.length;
  chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 120), to: n + 3 });
  return chart;
}

function LWC_CrosshairNormal() {
  return window.LightweightCharts.CrosshairMode.Normal;
}

/**
 * 三大法人每日買賣超「合計」直方圖（單位：張，正買超 / 負賣超）。
 * @param {HTMLElement} container
 * @param {Array} agg 來自 chips.aggregateInstitutional，[{date, total, ...}]
 */
export async function renderInstitutionalChart(container, agg) {
  await loadLib();
  container.innerHTML = '';
  const { chart, c } = makeChart(container, { height: container.clientHeight || 200 });
  const hist = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceLineVisible: false });
  hist.setData(agg.map((d) => ({
    time: d.date,
    value: d.total,
    color: d.total >= 0 ? c.up : c.down,
  })));
  const base = chart.addLineSeries({ color: c.border, lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
  base.setData(agg.map((d) => ({ time: d.date, value: 0 })));
  chart.timeScale().fitContent();
  return chart;
}

/**
 * 融資餘額 / 融券餘額折線（單位：張，各自左右軸）。
 * @param {Array} m 來自 chips.summarizeMargin，[{date, marginBal, shortBal, ...}]
 */
export async function renderMarginChart(container, m) {
  await loadLib();
  container.innerHTML = '';
  const { chart } = makeChart(container, {
    height: container.clientHeight || 200,
    leftPriceScale: { visible: true },
  });
  const margin = chart.addLineSeries({
    color: '#5B8DEF', lineWidth: 2, priceScaleId: 'right', title: '融資',
  });
  margin.setData(m.map((d) => ({ time: d.date, value: d.marginBal })));
  const short = chart.addLineSeries({
    color: '#E0A93C', lineWidth: 2, priceScaleId: 'left', title: '融券',
  });
  short.setData(m.map((d) => ({ time: d.date, value: d.shortBal })));
  chart.timeScale().fitContent();
  return chart;
}
