// 籌碼面資料整理：把 FinMind 原始列轉成畫面用結構。

// 三大法人類別歸群（見 SPEC）：
//   外資 = Foreign_Investor + Foreign_Dealer_Self
//   投信 = Investment_Trust
//   自營 = Dealer_self + Dealer_Hedging
const GROUP = {
  Foreign_Investor: 'foreign',
  Foreign_Dealer_Self: 'foreign',
  Investment_Trust: 'trust',
  Dealer_self: 'dealer',
  Dealer_Hedging: 'dealer',
};

/**
 * @param {Array} rows FinMind TaiwanStockInstitutionalInvestorsBuySell（單位：股）
 * @returns {Array} [{ date, foreign, trust, dealer, total }]（單位：張，買賣超淨額，由舊到新）
 */
export function aggregateInstitutional(rows) {
  const byDate = new Map();
  for (const r of rows) {
    const g = GROUP[r.name];
    if (!g) continue;
    const d = byDate.get(r.date) || { date: r.date, foreign: 0, trust: 0, dealer: 0 };
    d[g] += (Number(r.buy) - Number(r.sell)) / 1000; // 股 → 張
    byDate.set(r.date, d);
  }
  return [...byDate.values()]
    .map((d) => ({
      date: d.date,
      foreign: Math.round(d.foreign),
      trust: Math.round(d.trust),
      dealer: Math.round(d.dealer),
      total: Math.round(d.foreign + d.trust + d.dealer),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 近 n 個交易日各群合計（張）。 */
export function institutionalSum(agg, n) {
  const slice = agg.slice(-n);
  return slice.reduce(
    (acc, d) => ({
      foreign: acc.foreign + d.foreign,
      trust: acc.trust + d.trust,
      dealer: acc.dealer + d.dealer,
      total: acc.total + d.total,
    }),
    { foreign: 0, trust: 0, dealer: 0, total: 0 },
  );
}

/**
 * @param {Array} rows FinMind TaiwanStockMarginPurchaseShortSale（單位：張）
 * @returns {Array} [{ date, marginBal, marginChg, shortBal, shortChg }]（由舊到新）
 */
export function summarizeMargin(rows) {
  return rows
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      date: r.date,
      marginBal: Number(r.MarginPurchaseTodayBalance),
      marginChg: Number(r.MarginPurchaseTodayBalance) - Number(r.MarginPurchaseYesterdayBalance),
      shortBal: Number(r.ShortSaleTodayBalance),
      shortChg: Number(r.ShortSaleTodayBalance) - Number(r.ShortSaleYesterdayBalance),
    }));
}
