// 執行：node --test test/chips.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateInstitutional, institutionalSum, summarizeMargin } from '../src/chips.js';

test('三大法人：分群 + 股轉張 + 淨額', () => {
  const rows = [
    // d1
    { date: 'd1', name: 'Foreign_Investor', buy: 3_000_000, sell: 1_000_000 },   // +2000 張
    { date: 'd1', name: 'Foreign_Dealer_Self', buy: 0, sell: 500_000 },          // -500 張 → 外資合計 +1500
    { date: 'd1', name: 'Investment_Trust', buy: 1_000_000, sell: 0 },           // 投信 +1000
    { date: 'd1', name: 'Dealer_self', buy: 200_000, sell: 100_000 },            // +100
    { date: 'd1', name: 'Dealer_Hedging', buy: 0, sell: 300_000 },               // -300 → 自營 -200
    // d2
    { date: 'd2', name: 'Foreign_Investor', buy: 0, sell: 1_000_000 },           // 外資 -1000
    { date: 'd2', name: 'Investment_Trust', buy: 500_000, sell: 0 },             // 投信 +500
  ];
  const agg = aggregateInstitutional(rows);
  assert.equal(agg.length, 2);
  assert.deepEqual(agg[0], { date: 'd1', foreign: 1500, trust: 1000, dealer: -200, total: 2300 });
  assert.deepEqual(agg[1], { date: 'd2', foreign: -1000, trust: 500, dealer: 0, total: -500 });

  const s2 = institutionalSum(agg, 2);
  assert.deepEqual(s2, { foreign: 500, trust: 1500, dealer: -200, total: 1800 });
  const s1 = institutionalSum(agg, 1);
  assert.equal(s1.total, -500); // 只取最後一天
});

test('三大法人：忽略未知類別、日期排序', () => {
  const rows = [
    { date: 'd2', name: 'Foreign_Investor', buy: 1000, sell: 0 },
    { date: 'd1', name: 'Foreign_Investor', buy: 2000, sell: 0 },
    { date: 'd1', name: '???', buy: 999999, sell: 0 },
  ];
  const agg = aggregateInstitutional(rows);
  assert.deepEqual(agg.map((d) => d.date), ['d1', 'd2']);
  assert.equal(agg[0].foreign, 2); // 未知類別不算
});

test('融資融券：餘額與增減', () => {
  const rows = [
    { date: 'd1', MarginPurchaseTodayBalance: 1000, MarginPurchaseYesterdayBalance: 900,
      ShortSaleTodayBalance: 50, ShortSaleYesterdayBalance: 60 },
    { date: 'd2', MarginPurchaseTodayBalance: 1200, MarginPurchaseYesterdayBalance: 1000,
      ShortSaleTodayBalance: 45, ShortSaleYesterdayBalance: 50 },
  ];
  const m = summarizeMargin(rows);
  assert.deepEqual(m[0], { date: 'd1', marginBal: 1000, marginChg: 100, shortBal: 50, shortChg: -10 });
  assert.deepEqual(m[1], { date: 'd2', marginBal: 1200, marginChg: 200, shortBal: 45, shortChg: -5 });
});
