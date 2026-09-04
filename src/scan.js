// M5 掃描：在「精選池 + 觀察清單」裡找「明日均線可能上彎」的股票。
//
// 為什麼是精選池而非全市場？
//   官方「一次抓全市場」的端點沒開 CORS，網頁不能直接抓；FinMind 只能逐檔抓且有
//   流量限制。對一人使用，精選池已涵蓋絕大多數會關注的標的；冷門股加進觀察清單即可。
//
// 候選定義：
//   明日 MA(N) 上彎 ⟺ 明日收盤 > 明日扣抵值(= close[t-N+1])
//   我們不知道明日收盤，用「今日收盤 > 明日扣抵值」當代理：價格若持平，MA 明天就翻上。
//   再加「今日 MA 尚未上彎」→ 才算「轉折」而非「已經在漲」。

import { getPriceSeries } from './cache.js';
import { calcMA } from './deduction.js';
import { ApiError } from './api.js';

// 精選池（權值股 + 各族群熱門股）。代號是固定識別碼，就算某檔已下市，掃描時略過即可。
export const SCAN_POOL = [
  // 半導體 / IC 設計
  '2330', '2454', '2303', '2379', '3034', '2337', '2344', '3711', '3443', '3529',
  '3661', '5269', '6415', '4966', '3006', '8069', '3105', '2408', '3035', '3227',
  '8016', '6533', '5274', '3583', '3131', '6438', '2401', '2436', '3552',
  // 台達電 / 電源 / 重電 / 綠能 / 自動化
  '2308', '1519', '1513', '1503', '1504', '2371', '1560', '2049', '1590', '4551',
  // PCB / 載板 / 被動元件
  '3037', '2316', '4958', '2368', '3044', '8046', '2313', '6213', '2383', '2327',
  '2492', '6449',
  // 散熱 / 機殼 / 連接器 / 機構件
  '3017', '3324', '3653', '2059', '8210', '3013', '2421', '6206',
  // 代工 / 組裝 / 伺服器 / 品牌
  '2317', '2382', '3231', '2356', '2357', '4938', '6669', '3005', '2376', '2377',
  '3706',
  // 面板 / 光學 / 鏡頭
  '3481', '2409', '3008', '3406', '6456', '4919',
  // 光通訊 / 網通
  '2345', '4977', '4979', '3450', '2455', '3363', '4906', '6143',
  // 傳產龍頭（塑化 / 鋼鐵 / 水泥 / 食品 / 車 / 紡織 / 自行車 / 通路）
  '1301', '1303', '1326', '6505', '2002', '1101', '1102', '1216', '1210', '2912',
  '2207', '9910', '9921', '9914', '1476', '1477', '2903', '2915',
  // 航運（貨櫃 / 散裝 / 航空）
  '2603', '2609', '2615', '2606', '2637', '5608', '2618', '2610', '2634',
  // 金融
  '2881', '2882', '2891', '2886', '2884', '2885', '2887', '2890', '2892', '2880',
  '2883', '2888', '2889', '5880', '5876', '5871', '2801', '2809', '2834', '2812',
  // 生技醫療
  '6446', '4746', '1795', '6472', '4174', '6547', '4736', '1707',
  // 電信 / 其他權值
  '2412', '3045', '4904',
  // 記憶體模組 / 工控電腦 / 其他熱門
  '2451', '5289', '3260', '2352', '2360', '6285', '3596',
];

/** 併發上限的 map，邊做邊回報進度。 */
async function mapLimit(items, limit, fn, onProgress) {
  const results = new Array(items.length);
  let cursor = 0;
  let done = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      try {
        results[idx] = { ok: true, value: await fn(items[idx]) };
      } catch (err) {
        results[idx] = { ok: false, err };
      }
      done += 1;
      onProgress?.(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * 執行掃描。
 * @param {string[]} extraCodes 觀察清單等額外要掃的代號
 * @param {number}   period     均線週期（5 / 10 / 20 / 60）
 * @param {(done:number,total:number)=>void} onProgress
 * @returns {Promise<{candidates:Array, scanned:number, failed:number, rateLimited:boolean}>}
 */
export async function runScan(extraCodes, period, onProgress) {
  const universe = [...new Set([...SCAN_POOL, ...extraCodes])];
  let rateLimitHits = 0;

  const rows = await mapLimit(universe, 4, async (code) => {
    const { rows: prices } = await getPriceSeries(code);
    if (!prices || prices.length < period + 1) return null;
    const dates = prices.map((r) => r.date);
    const closes = prices.map((r) => r.close);
    const r = calcMA(dates, closes, period, 3);
    if (!r.enoughData) return null;
    const lastClose = closes[closes.length - 1];
    const nextDeduction = r.future[0].deduction;
    const gap = +(lastClose - nextDeduction).toFixed(2);
    return {
      code,
      close: lastClose,
      date: dates[dates.length - 1],
      trend: r.trend,
      maToday: r.maToday,
      nextDeduction,
      gap,                       // 今日收盤 − 明日扣抵值
      holdUpDays: r.holdUpDays,
      // 候選：今日還沒上彎，但今日收盤已站上明日扣抵值 → 明天守住價就翻上
      isCandidate: r.trend !== 'up' && gap > 0,
    };
  }, onProgress);

  const candidates = [];
  let failed = 0;
  for (const item of rows) {
    if (item.ok) {
      if (item.value?.isCandidate) candidates.push(item.value);
    } else {
      failed += 1;
      const e = item.err;
      if (e instanceof ApiError && (e.kind === 'server' || e.kind === 'timeout')) rateLimitHits += 1;
    }
  }
  candidates.sort((a, b) => b.gap - a.gap);

  return {
    candidates,
    scanned: universe.length - failed,
    failed,
    rateLimited: rateLimitHits >= 5,
  };
}
