// 進入點 + hash 路由 + 畫面渲染
import { getStockList, getPriceSeries, clearAllCache, taipeiToday,
         getWatchlist, setWatchlist } from './cache.js';
import { analyze } from './deduction.js';
import { renderChart, destroyChart } from './chart.js';

const app = document.getElementById('app');

// ---------- 路由 ----------

const routes = [
  { re: /^#\/stock\/([0-9A-Za-z]+)$/, view: (m) => stockView(m[1]) },
  { re: /^#\/settings$/, view: settingsView },
  { re: /^#?\/?$/, view: homeView },
];

async function router() {
  const hash = location.hash || '#/';
  destroyChart(); // 換頁先清掉舊圖表，避免殘留
  for (const r of routes) {
    const m = hash.match(r.re);
    if (m) {
      app.scrollTo?.(0, 0);
      window.scrollTo(0, 0);
      try {
        await r.view(m);
      } catch (err) {
        console.error(err);
        renderError(err);
      }
      return;
    }
  }
  location.hash = '#/';
}

window.addEventListener('hashchange', router);
window.addEventListener('load', router);

// ---------- 共用元件 ----------

const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

function setView(node) {
  app.replaceChildren(node);
}

function loadingCard(text = '載入中…') {
  return el(`<div class="card center"><p class="emoji">🐕</p><p>${text}</p></div>`);
}

function renderError(err) {
  const msg = err?.kind === 'timeout' ? '連線逾時，請稍後再試'
    : err?.kind === 'network' ? '網路連線失敗，請檢查網路'
    : err?.message || '發生未知錯誤';
  setView(el(`
    <div class="card center">
      <p class="emoji">🤷</p>
      <p>${msg}</p>
      <a class="btn" href="#/">回首頁</a>
    </div>`));
}

function header(title, back = false) {
  return el(`
    <div class="topbar">
      ${back ? '<a class="back" href="#/">←</a>' : '<span class="logo">🐕</span>'}
      <h1>${title}</h1>
      <a class="gear" href="#/settings">⚙️</a>
    </div>`);
}

const trendLabel = { up: '↗ 上彎', down: '↘ 下彎', flat: '→ 走平' };

// 顯示用：最多 2 位小數，去掉多餘的 0（252.40 → 252.4）
const fmt = (x) => String(Number(x.toFixed(2)));

// ---------- 首頁 ----------

async function homeView() {
  const wrap = el('<div class="page"></div>');
  wrap.append(header('盤後小幫手'));

  const search = el(`
    <div class="card">
      <p class="hint">今天想看哪一檔？輸入代號或名稱</p>
      <input id="q" class="search" type="search" inputmode="search"
             placeholder="例：2330 或 台積電" autocomplete="off" />
      <ul id="results" class="results"></ul>
    </div>`);
  wrap.append(search);

  const watchCard = el('<div class="card"><h2>我的觀察清單</h2><div id="watch"></div></div>');
  wrap.append(watchCard);
  setView(wrap);

  // 載入股票清單（供搜尋）
  let stocks = [];
  try {
    stocks = await getStockList();
  } catch {
    search.querySelector('.hint').textContent = '股票清單載入失敗，仍可直接輸入代號後按 Enter';
  }

  const q = search.querySelector('#q');
  const results = search.querySelector('#results');

  const render = () => {
    const term = q.value.trim();
    results.innerHTML = '';
    if (!term) return;
    const lower = term.toLowerCase();
    const hits = stocks
      .filter((s) => s.id.includes(term) || s.name.toLowerCase().includes(lower))
      .slice(0, 12);
    for (const s of hits) {
      const li = el(`<li><a href="#/stock/${s.id}"><b>${s.id}</b> ${s.name}</a></li>`);
      results.append(li);
    }
    if (!hits.length && /^[0-9A-Za-z]+$/.test(term)) {
      results.append(el(`<li><a href="#/stock/${term}">直接查代號 <b>${term}</b></a></li>`));
    }
  };
  q.addEventListener('input', render);
  q.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = results.querySelector('a');
      if (first) location.hash = first.getAttribute('href').slice(1);
    }
  });

  // 觀察清單
  await renderWatchlist(watchCard.querySelector('#watch'));
}

async function renderWatchlist(node) {
  const list = await getWatchlist();
  if (!list.length) {
    node.replaceChildren(el(`<p class="empty">🐾 還沒有觀察股，先搜尋一檔加進來吧</p>`));
    return;
  }
  node.replaceChildren(el('<p class="empty">載入觀察股…</p>'));
  const rows = [];
  for (const item of list) {
    try {
      const { rows: prices } = await getPriceSeries(item.id);
      const dates = prices.map((r) => r.date);
      const closes = prices.map((r) => r.close);
      const ma20 = analyze(dates, closes, [20])[0];
      const need = ma20.enoughData ? ma20.future[0].deduction : null;
      const diff = need == null ? null : +(closes[closes.length - 1] - need).toFixed(2);
      rows.push(el(`
        <a class="watch-row" href="#/stock/${item.id}">
          <span><b>${item.id}</b> ${item.name}</span>
          <span>收 ${closes[closes.length - 1]}</span>
          <span class="${diff >= 0 ? 'up' : 'down'}">
            ${need == null ? '—' : (diff >= 0
              ? `MA20已站上扣抵 +${diff}` : `距MA20扣抵 ${diff}`)}
          </span>
        </a>`));
    } catch {
      rows.push(el(`<a class="watch-row" href="#/stock/${item.id}">
        <span><b>${item.id}</b> ${item.name}</span><span>資料載入失敗</span><span></span></a>`));
    }
  }
  node.replaceChildren(...rows);
}

// ---------- 個股分析頁 ----------

async function stockView(code) {
  setView(loadingCard(`正在抓 ${code} 的資料…`));

  let stocks = [];
  try { stocks = await getStockList(); } catch { /* 可略 */ }
  const meta = stocks.find((s) => s.id === code);

  const { rows, dataDate, stale } = await getPriceSeries(code);
  const dates = rows.map((r) => r.date);
  const closes = rows.map((r) => r.close);
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const chg = prev ? +(last.close - prev.close).toFixed(2) : 0;
  const chgPct = prev ? ((chg / prev.close) * 100).toFixed(2) : '0.00';

  const results = analyze(dates, closes, [5, 10, 20, 60]);

  const wrap = el('<div class="page"></div>');
  wrap.append(header(`${code}${meta ? ' ' + meta.name : ''}`, true));

  wrap.append(el(`
    <div class="card">
      <div class="quote">
        <span class="price">${last.close}</span>
        <span class="chg ${chg >= 0 ? 'up' : 'down'}">
          ${chg >= 0 ? '▲' : '▼'} ${Math.abs(chg)} (${chgPct}%)
        </span>
      </div>
      <p class="datadate">資料日期：${dataDate}${stale ? '　⚠️ 今日資料尚未更新，顯示上次資料' : ''}</p>
    </div>`));

  const watched = (await getWatchlist()).some((w) => w.id === code);
  const watchBtn = el(`<button class="btn ghost">${watched ? '★ 已在觀察清單' : '☆ 加入觀察清單'}</button>`);
  watchBtn.addEventListener('click', async () => {
    const list = await getWatchlist();
    const idx = list.findIndex((w) => w.id === code);
    if (idx >= 0) list.splice(idx, 1);
    else list.push({ id: code, name: meta?.name || code });
    await setWatchlist(list);
    watchBtn.textContent = idx >= 0 ? '☆ 加入觀察清單' : '★ 已在觀察清單';
  });
  const btnCard = el('<div class="card"></div>');
  btnCard.append(watchBtn);
  wrap.append(btnCard);

  const chartCard = el(`
    <div class="card">
      <div class="chart-legend">
        <span class="lg-k">K 線</span>
        <span class="lg" style="--c:#5B8DEF">MA5</span>
        <span class="lg" style="--c:#B57EDC">MA10</span>
        <span class="lg" style="--c:#E0A93C">MA20</span>
        <span class="lg" style="--c:#8A8F98">MA60</span>
      </div>
      <div id="chart" class="chart"><p class="empty">載入圖表…</p></div>
    </div>`);
  wrap.append(chartCard);

  for (const r of results) {
    wrap.append(maCard(r, last.close));
  }

  setView(wrap);

  // 圖表在畫面掛上、有寬度後再畫；失敗不影響其他內容
  const chartEl = chartCard.querySelector('#chart');
  renderChart(chartEl, rows).catch((err) => {
    console.error(err);
    chartEl.innerHTML = `<p class="empty">圖表載入失敗（${err.message}），扣抵值分析不受影響</p>`;
  });
}

function maCard(r, lastClose) {
  if (!r.enoughData) {
    return el(`<div class="card"><h2>MA${r.period}</h2><p class="empty">資料不足，無法計算</p></div>`);
  }
  const rowsHtml = r.future.map((fd) => {
    const diff = +(lastClose - fd.deduction).toFixed(2);
    const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
    const flag = diff > 0 ? '現價已站上' : diff < 0 ? '尚未站上' : '持平';
    return `<tr>
      <td>D+${fd.k}</td>
      <td>${fd.date.slice(5)}</td>
      <td class="num">${fd.deduction.toFixed(2)}</td>
      <td class="num ${cls}">${diff > 0 ? '+' : ''}${diff}</td>
      <td class="${cls}">${flag}</td>
    </tr>`;
  }).join('');

  return el(`
    <div class="card">
      <div class="ma-head">
        <h2>MA${r.period}</h2>
        <span class="pill ${r.trend}">${trendLabel[r.trend]}</span>
      </div>
      <p class="ma-sub">
        目前均價 <b>${fmt(r.maToday)}</b>（昨日 ${fmt(r.maYesterday)}）<br/>
        若股價維持 ${fmt(lastClose)}，均線可連續上彎 <b>${r.holdUpDays}</b> 個交易日
      </p>
      <table class="ded">
        <thead><tr><th>未來</th><th>日期</th><th>扣抵值<br/>(需站上)</th><th>與現價差</th><th></th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`);
}

// ---------- 設定頁 ----------

async function settingsView() {
  const wrap = el('<div class="page"></div>');
  wrap.append(header('設定', true));
  wrap.append(el(`
    <div class="card">
      <h2>資料</h2>
      <p class="ma-sub">今天（台北）：${taipeiToday()}</p>
      <button id="clear" class="btn ghost">清除所有快取並重新抓取</button>
      <p id="clearmsg" class="empty"></p>
    </div>`));
  wrap.append(el(`
    <div class="card">
      <h2>關於</h2>
      <p class="ma-sub">
        盤後小幫手 v0.1（MVP）<br/>
        資料來源：FinMind（未還原權值）<br/>
        均線週期：MA5 / MA10 / MA20 / MA60（未來版本可自訂）
      </p>
      <p class="ma-sub"><a href="https://github.com/pweichi-art/post-market" target="_blank" rel="noopener">原始碼</a></p>
    </div>`));
  setView(wrap);

  wrap.querySelector('#clear').addEventListener('click', async () => {
    await clearAllCache();
    wrap.querySelector('#clearmsg').textContent = '已清除，下次查詢會重新抓取。';
  });
}

// ---------- 線上 / 離線提示 ----------

function onlineBanner() {
  let banner = document.querySelector('.offline-banner');
  if (!navigator.onLine) {
    if (!banner) {
      banner = el('<div class="offline-banner">離線中 · 顯示快取資料</div>');
      document.body.prepend(banner);
    }
  } else if (banner) {
    banner.remove();
  }
}
window.addEventListener('online', onlineBanner);
window.addEventListener('offline', onlineBanner);
onlineBanner();
