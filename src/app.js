// 進入點 + hash 路由 + 畫面渲染
import { getStockList, getPriceSeries, clearAllCache, taipeiToday,
         getWatchlist, setWatchlist, getInstitutional, getMargin } from './cache.js';
import { analyze } from './deduction.js';
import { renderChart, renderInstitutionalChart, renderMarginChart,
         destroyChart } from './chart.js';
import { aggregateInstitutional, institutionalSum, summarizeMargin } from './chips.js';
import { runScan } from './scan.js';
import { getToken, setToken } from './api.js';

const app = document.getElementById('app');

// ---------- 路由 ----------

const routes = [
  { re: /^#\/stock\/([0-9A-Za-z]+)$/, view: (m) => stockView(m[1]) },
  { re: /^#\/scan$/, view: scanView },
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

// 從 fromISO 往後推 n 個「工作日」（只跳週末，未計國定假日 → 顯示時標「約」）
function projectTradingDate(fromISO, n) {
  const d = new Date(fromISO + 'T00:00:00');
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) added += 1;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

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

  const scanCard = el(`
    <div class="card scan-entry">
      <div>
        <h2>🔭 上彎候選股掃描</h2>
        <p class="hint">在精選池＋觀察清單裡，找明天均線可能上彎的股票</p>
      </div>
      <a class="btn" href="#/scan">開始掃描</a>
    </div>`);
  wrap.append(scanCard);

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
    wrap.append(maCard(r, last.close, dataDate));
  }

  const instCard = el(`
    <div class="card">
      <h2>三大法人買賣超（張）</h2>
      <div id="inst-body"><p class="empty">載入中…</p></div>
    </div>`);
  const marginCard = el(`
    <div class="card">
      <h2>融資融券餘額（張）</h2>
      <div id="margin-body"><p class="empty">載入中…</p></div>
    </div>`);
  wrap.append(instCard, marginCard);

  setView(wrap);

  // 圖表在畫面掛上、有寬度後再畫；失敗不影響其他內容
  const chartEl = chartCard.querySelector('#chart');
  renderChart(chartEl, rows).catch((err) => {
    console.error(err);
    chartEl.innerHTML = `<p class="empty">圖表載入失敗（${err.message}），扣抵值分析不受影響</p>`;
  });

  renderInstitutional(instCard.querySelector('#inst-body'), code);
  renderMargin(marginCard.querySelector('#margin-body'), code);
}

// 千分位 + 正負號
const kfmt = (n) => (n > 0 ? '+' : '') + Math.round(n).toLocaleString('en-US');
const kcls = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat');

async function renderInstitutional(node, code) {
  let data;
  try {
    data = await getInstitutional(code);
  } catch (err) {
    node.innerHTML = `<p class="empty">三大法人資料載入失敗（${err.message}）</p>`;
    return;
  }
  const agg = aggregateInstitutional(data.rows);
  if (!agg.length) {
    node.innerHTML = '<p class="empty">查無三大法人資料</p>';
    return;
  }
  const s5 = institutionalSum(agg, 5);
  const s20 = institutionalSum(agg, 20);
  const recent = agg.slice(-12).reverse();
  node.innerHTML = `
    ${data.stale ? '<p class="empty">⚠️ 今日資料尚未更新，顯示上次資料</p>' : ''}
    <p class="ma-sub">
      近 5 日合計　外資 <b class="${kcls(s5.foreign)}">${kfmt(s5.foreign)}</b> · 
      投信 <b class="${kcls(s5.trust)}">${kfmt(s5.trust)}</b> · 
      自營 <b class="${kcls(s5.dealer)}">${kfmt(s5.dealer)}</b><br/>
      近 20 日合計　外資 <b class="${kcls(s20.foreign)}">${kfmt(s20.foreign)}</b> · 
      投信 <b class="${kcls(s20.trust)}">${kfmt(s20.trust)}</b> · 
      自營 <b class="${kcls(s20.dealer)}">${kfmt(s20.dealer)}</b>
    </p>
    <div class="chart chart-sm" id="inst-chart"><p class="empty">載入圖表…</p></div>
    <table class="ded">
      <thead><tr><th>日期</th><th class="num">外資</th><th class="num">投信</th><th class="num">自營</th><th class="num">合計</th></tr></thead>
      <tbody>${recent.map((d) => `
        <tr>
          <td>${d.date.slice(5)}</td>
          <td class="num ${kcls(d.foreign)}">${kfmt(d.foreign)}</td>
          <td class="num ${kcls(d.trust)}">${kfmt(d.trust)}</td>
          <td class="num ${kcls(d.dealer)}">${kfmt(d.dealer)}</td>
          <td class="num ${kcls(d.total)}">${kfmt(d.total)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  renderInstitutionalChart(node.querySelector('#inst-chart'), agg.slice(-40))
    .catch(() => { node.querySelector('#inst-chart').innerHTML = '<p class="empty">圖表載入失敗</p>'; });
}

async function renderMargin(node, code) {
  let data;
  try {
    data = await getMargin(code);
  } catch (err) {
    node.innerHTML = `<p class="empty">融資融券資料載入失敗（${err.message}）</p>`;
    return;
  }
  const m = summarizeMargin(data.rows);
  if (!m.length) {
    node.innerHTML = '<p class="empty">查無融資融券資料</p>';
    return;
  }
  const latest = m[m.length - 1];
  const recent = m.slice(-12).reverse();
  node.innerHTML = `
    ${data.stale ? '<p class="empty">⚠️ 今日資料尚未更新，顯示上次資料</p>' : ''}
    <p class="ma-sub">
      ${latest.date}　融資餘額 <b>${latest.marginBal.toLocaleString('en-US')}</b>
      （<span class="${kcls(latest.marginChg)}">${kfmt(latest.marginChg)}</span>） · 
      融券餘額 <b>${latest.shortBal.toLocaleString('en-US')}</b>
      （<span class="${kcls(latest.shortChg)}">${kfmt(latest.shortChg)}</span>）
    </p>
    <div class="chart chart-sm" id="margin-chart"><p class="empty">載入圖表…</p></div>
    <p class="chart-legend"><span class="lg" style="--c:#5B8DEF">融資餘額</span><span class="lg" style="--c:#E0A93C">融券餘額</span></p>
    <table class="ded">
      <thead><tr><th>日期</th><th class="num">融資餘額</th><th class="num">融資增減</th><th class="num">融券餘額</th><th class="num">融券增減</th></tr></thead>
      <tbody>${recent.map((d) => `
        <tr>
          <td>${d.date.slice(5)}</td>
          <td class="num">${d.marginBal.toLocaleString('en-US')}</td>
          <td class="num ${kcls(d.marginChg)}">${kfmt(d.marginChg)}</td>
          <td class="num">${d.shortBal.toLocaleString('en-US')}</td>
          <td class="num ${kcls(d.shortChg)}">${kfmt(d.shortChg)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  renderMarginChart(node.querySelector('#margin-chart'), m.slice(-40))
    .catch(() => { node.querySelector('#margin-chart').innerHTML = '<p class="empty">圖表載入失敗</p>'; });
}

function maCard(r, lastClose, dataDate) {
  if (!r.enoughData) {
    return el(`<div class="card"><h2>MA${r.period}</h2><p class="empty">資料不足，無法計算</p></div>`);
  }
  const rowsHtml = r.future.map((fd) => {
    const diff = +(lastClose - fd.deduction).toFixed(2);
    const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
    const flag = diff > 0 ? '若持平即上彎' : diff < 0 ? '需再漲' : '打平';
    return `<tr>
      <td>第 ${fd.k} 日<br/><span class="sub">約 ${projectTradingDate(dataDate, fd.k)}</span></td>
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
        <b>看法</b>：未來某個交易日，當天收盤價站上該列「收盤需站上」的數字，
        MA${r.period} 當天就會往上彎；低於則往下。<br/>
        若股價一直維持在今日收盤 ${fmt(lastClose)}，MA${r.period} 可連續上彎
        <b>${r.holdUpDays}</b> 個交易日
      </p>
      <table class="ded">
        <thead><tr>
          <th>未來交易日</th>
          <th class="num">收盤<br/>需站上</th>
          <th class="num">今收<br/>差額</th>
          <th>判斷</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <p class="ma-sub sub">「未來交易日」只跳週末、未扣國定假日，故標「約」。${
        r.period <= r.future.length
          ? `第 ${r.period} 日的門檻＝今日收盤，因為那天剛好把今天這根 K 棒扣掉。`
          : ''}</p>
    </div>`);
}

// ---------- 掃描頁 ----------

let lastScanPeriod = 20;

async function scanView() {
  const wrap = el('<div class="page"></div>');
  wrap.append(header('上彎候選股掃描', true));

  const ctrlCard = el(`
    <div class="card">
      <p class="hint">選均線週期，掃「精選池（約 150 檔）＋ 你的觀察清單」，
        找出「今天還沒上彎、但明天守住價就會上彎」的股票。</p>
      <div class="period-picker" id="period-picker">
        ${[5, 10, 20, 60].map((p) => `<button class="chip${p === lastScanPeriod ? ' active' : ''}" data-p="${p}">MA${p}</button>`).join('')}
      </div>
      <button id="run" class="btn">開始掃描</button>
      <div id="progress"></div>
    </div>`);
  wrap.append(ctrlCard);

  const resultCard = el('<div class="card" id="scan-result" hidden></div>');
  wrap.append(resultCard);

  setView(wrap);

  const picker = ctrlCard.querySelector('#period-picker');
  picker.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-p]');
    if (!btn) return;
    lastScanPeriod = Number(btn.dataset.p);
    picker.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
  });

  ctrlCard.querySelector('#run').addEventListener('click', async () => {
    const runBtn = ctrlCard.querySelector('#run');
    const progress = ctrlCard.querySelector('#progress');
    runBtn.disabled = true;
    runBtn.textContent = '掃描中…';
    resultCard.hidden = true;

    const watchIds = (await getWatchlist()).map((w) => w.id);
    let stocks = [];
    try { stocks = await getStockList(); } catch { /* 沒名字也能顯示代號 */ }
    const nameOf = (code) => stocks.find((s) => s.id === code)?.name || code;

    const result = await runScan(watchIds, lastScanPeriod, (done, total) => {
      progress.textContent = `掃描中 ${done} / ${total}`;
    });

    runBtn.disabled = false;
    runBtn.textContent = '重新掃描';
    progress.textContent = `完成：掃了 ${result.scanned} 檔，失敗 ${result.failed} 檔`
      + (result.rateLimited ? '（可能碰到 FinMind 流量限制，稍後再試或到設定頁加 token）' : '');

    resultCard.hidden = false;
    if (!result.candidates.length) {
      resultCard.innerHTML = `<p class="empty">🐾 這次沒掃到候選股（池子裡的股票明天都不會上彎，或都已經在上彎中了）</p>`;
      return;
    }
    resultCard.innerHTML = `
      <h2>候選股（MA${lastScanPeriod}，共 ${result.candidates.length} 檔）</h2>
      <p class="hint">依「今收距明日扣抵值」的餘裕排序，餘裕越大代表明天越容易守住</p>
      <table class="ded">
        <thead><tr><th>股票</th><th class="num">收盤</th><th class="num">明日需站上</th><th class="num">餘裕</th></tr></thead>
        <tbody>${result.candidates.map((c) => `
          <tr>
            <td><a href="#/stock/${c.code}"><b>${c.code}</b> ${nameOf(c.code)}</a></td>
            <td class="num">${c.close}</td>
            <td class="num">${c.nextDeduction.toFixed(2)}</td>
            <td class="num up">+${c.gap}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  });
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
      <h2>FinMind Token（選填）</h2>
      <p class="ma-sub">免登入約 300 次/小時；到
        <a href="https://finmindtrade.com/analysis/#/data/api" target="_blank" rel="noopener">FinMind 免費註冊</a>
        拿一組 token 可拉高到 600 次/小時，掃描（M5）會更順。只存在你這台裝置。</p>
      <input id="token" class="search" type="text" placeholder="貼上 token（留空＝不使用）"
             value="${getToken()}" autocomplete="off" />
      <button id="saveToken" class="btn ghost">儲存</button>
      <p id="tokenmsg" class="empty"></p>
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

  wrap.querySelector('#saveToken').addEventListener('click', () => {
    setToken(wrap.querySelector('#token').value.trim());
    wrap.querySelector('#tokenmsg').textContent = '已儲存。';
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
