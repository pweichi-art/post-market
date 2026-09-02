// 本機快取層（IndexedDB）
// 用 idb-keyval 這個很小的套件包裝 IndexedDB。
// 策略：先給畫面看快取，背景再補抓缺的交易日。

import { get, set, del, keys } from 'https://cdn.jsdelivr.net/npm/idb-keyval@6.2.1/+esm';
import { fetchStockList, fetchDailyPrice } from './api.js';

const STOCKLIST_KEY = 'stocklist';
const PRICE_PREFIX = 'price:';
const HISTORY_DAYS = 550; // 首次回補天數（約 1.5 年，確保 MA60 夠用）

/** 台北時區的今天，'YYYY-MM-DD' */
export function taipeiToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
}

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// ---------- 股票清單 ----------

/** 取得股票清單，一天只向 API 抓一次。 */
export async function getStockList() {
  const cached = await get(STOCKLIST_KEY);
  const today = taipeiToday();
  if (cached && cached.date === today && Array.isArray(cached.list)) {
    return cached.list;
  }
  try {
    const raw = await fetchStockList();
    // 去重（同一股號可能有多筆），只留上市 + 上櫃
    const seen = new Set();
    const list = [];
    for (const r of raw) {
      if (r.type !== 'twse' && r.type !== 'tpex') continue;
      if (seen.has(r.stock_id)) continue;
      seen.add(r.stock_id);
      list.push({ id: r.stock_id, name: r.stock_name, type: r.type });
    }
    list.sort((a, b) => a.id.localeCompare(b.id));
    await set(STOCKLIST_KEY, { date: today, list });
    return list;
  } catch (err) {
    if (cached && Array.isArray(cached.list)) return cached.list; // 抓失敗就用舊的
    throw err;
  }
}

// ---------- 個股日 K ----------

/**
 * 取得某股票的日 K（由舊到新）。
 * 回傳 { rows, dataDate, fromCache, stale }
 *   rows     : [{ date, close, open, max, min, ... }]
 *   dataDate : 最後一個交易日日期
 *   stale    : true 表示這次沒抓到新資料、顯示的是舊快取
 */
export async function getPriceSeries(stockId) {
  const key = PRICE_PREFIX + stockId;
  const cached = await get(key);
  const today = taipeiToday();

  // 快取是今天更新的 → 直接用
  if (cached && cached.updated === today && cached.rows?.length) {
    return pack(cached.rows, false, false);
  }

  try {
    let rows;
    if (cached && cached.rows?.length) {
      // 增量：從最後一個交易日往後補
      const lastDate = cached.rows[cached.rows.length - 1].date;
      const fresh = await fetchDailyPrice(stockId, lastDate);
      rows = mergeRows(cached.rows, fresh);
    } else {
      // 首次：抓一段歷史
      rows = normalize(await fetchDailyPrice(stockId, daysAgoISO(HISTORY_DAYS)));
    }
    if (!rows.length) {
      if (cached?.rows?.length) return pack(cached.rows, true, true);
      throw new Error('查無資料');
    }
    await set(key, { updated: today, rows });
    return pack(rows, false, false);
  } catch (err) {
    if (cached && cached.rows?.length) return pack(cached.rows, true, true); // 用舊快取撐住
    throw err;
  }
}

function normalize(raw) {
  return raw
    .map((r) => ({
      date: r.date,
      open: +r.open,
      max: +r.max,
      min: +r.min,
      close: +r.close,
      volume: +r.Trading_Volume,
    }))
    .filter((r) => Number.isFinite(r.close))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function mergeRows(oldRows, freshRaw) {
  const map = new Map(oldRows.map((r) => [r.date, r]));
  for (const r of normalize(freshRaw)) map.set(r.date, r);
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function pack(rows, fromCache, stale) {
  return { rows, dataDate: rows[rows.length - 1].date, fromCache, stale };
}

// ---------- 設定 / 維護 ----------

export async function clearAllCache() {
  for (const k of await keys()) await del(k);
}

export async function getWatchlist() {
  return (await get('watchlist')) || [];
}
export async function setWatchlist(list) {
  await set('watchlist', list);
}
