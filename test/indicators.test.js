// 執行：node --test test/indicators.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  maSeries, maAlignment, pricePosition, volumeSignal, alignByDate, relativeStrength,
} from '../src/indicators.js';

const seq = (from, to) => {
  const a = [];
  const step = from <= to ? 1 : -1;
  for (let v = from; step > 0 ? v <= to : v >= to; v += step) a.push(v);
  return a;
};

// ---------- maSeries ----------

test('maSeries：前面資料不足為 null，之後為滾動平均', () => {
  assert.deepEqual(maSeries([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
  assert.deepEqual(maSeries([1, 2], 5), [null, null]);
});

// ---------- 均：排列 ----------

test('maAlignment：一路上漲 → 多頭排列（短天期在上）', () => {
  const r = maAlignment(seq(1, 30), [5, 10, 20]);
  assert.equal(r.enough, true);
  assert.equal(r.alignment, 'bull');
  assert.deepEqual(r.mas.map((m) => m.value), [28, 25.5, 20.5]);
});

test('maAlignment：一路下跌 → 空頭排列', () => {
  const r = maAlignment(seq(30, 1), [5, 10, 20]);
  assert.equal(r.alignment, 'bear');
  assert.deepEqual(r.mas.map((m) => m.value), [3, 5.5, 10.5]);
});

test('maAlignment：資料不足回 enough:false', () => {
  assert.equal(maAlignment(seq(1, 10), [5, 10, 20]).enough, false);
  assert.equal(maAlignment(seq(1, 30), [20]).enough, false); // 只有一條不算排列
});

test('maAlignment：週期會自動去重排序', () => {
  const r = maAlignment(seq(1, 30), [20, 5, 10, 5]);
  assert.deepEqual(r.mas.map((m) => m.period), [5, 10, 20]);
});

// ---------- 均：糾結 ----------

test('maAlignment：股價完全不動 → 糾結度 0、連續糾結天數＝可計算的天數', () => {
  const flat = new Array(30).fill(100);
  const r = maAlignment(flat, [5, 10, 20]);
  assert.equal(r.spreadPct, 0);
  assert.equal(r.converged, true);
  // MA20 從 index 19 才算得出來，往回數到 19 共 11 天
  assert.equal(r.convergedDays, 11);
  assert.equal(r.alignment, 'mixed'); // 全部相等，不算多頭也不算空頭
});

test('maAlignment：大幅上漲 → 均線發散，不算糾結', () => {
  const r = maAlignment(seq(1, 30), [5, 10, 20]);
  // (28 − 20.5) / 30 = 25%
  assert.equal(r.spreadPct, 25);
  assert.equal(r.converged, false);
  assert.equal(r.convergedDays, 0);
});

// ---------- 位：股價位置 ----------

test('pricePosition：山谷 / 山腰 / 山頂', () => {
  const highs = new Array(25).fill(200);
  const lows = new Array(25).fill(100);
  const mk = (last) => [...new Array(24).fill(150), last];

  const waist = pricePosition(highs, lows, mk(150));
  assert.equal(waist.pct, 50);
  assert.equal(waist.zone, 'waist');

  assert.equal(pricePosition(highs, lows, mk(110)).zone, 'valley');
  assert.equal(pricePosition(highs, lows, mk(190)).zone, 'peak');
});

test('pricePosition：資料太短（<20根）回 enough:false', () => {
  const n = 10;
  assert.equal(
    pricePosition(new Array(n).fill(200), new Array(n).fill(100), new Array(n).fill(150)).enough,
    false,
  );
});

test('pricePosition：只看最近 lookback 根', () => {
  // 前 20 根有 500 的高點，但 lookback=20 只涵蓋後 20 根 → 高點應為 200
  const highs = [...new Array(20).fill(500), ...new Array(20).fill(200)];
  const lows = new Array(40).fill(100);
  const closes = new Array(40).fill(150);
  const r = pricePosition(highs, lows, closes, 20);
  assert.equal(r.high, 200);
  assert.equal(r.pct, 50);
  assert.equal(r.bars, 20);
});

// ---------- 量 ----------

test('volumeSignal：量比＝今日量 ÷ 前20日均量（不含今日）', () => {
  const volumes = [...new Array(20).fill(1000), 2500];
  const closes = [...new Array(20).fill(10), 11];
  const r = volumeSignal(closes, volumes, 20);
  assert.equal(r.enough, true);
  assert.equal(r.avg, 1000);
  assert.equal(r.ratio, 2.5);
  assert.equal(r.pv, 'up_vol_up'); // 價漲(10→11) 量增(1000→2500)
});

test('volumeSignal：四種價量配合', () => {
  const base = new Array(20).fill(1000);
  const mk = (prevClose, close, prevVol, vol) =>
    volumeSignal(
      [...new Array(19).fill(10), prevClose, close],
      [...base.slice(0, 19), prevVol, vol],
      20,
    ).pv;
  assert.equal(mk(10, 11, 1000, 2000), 'up_vol_up');     // 價漲量增
  assert.equal(mk(10, 11, 2000, 1000), 'up_vol_down');   // 價漲量縮
  assert.equal(mk(10, 9, 2000, 1000), 'down_vol_down');  // 價跌量縮
  assert.equal(mk(10, 9, 1000, 2000), 'down_vol_up');    // 價跌量增
  assert.equal(mk(10, 10, 1000, 2000), 'flat');          // 價平
});

// ---------- 強：相對大盤 ----------

test('alignByDate：只留兩邊都有的日期', () => {
  const rows = [{ date: 'a', close: 1 }, { date: 'b', close: 2 }, { date: 'c', close: 3 }];
  const bench = [{ date: 'a', close: 10 }, { date: 'c', close: 30 }];
  const r = alignByDate(rows, bench);
  assert.deepEqual(r.dates, ['a', 'c']);
  assert.deepEqual(r.stock, [1, 3]);
  assert.deepEqual(r.bench, [10, 30]);
});

test('relativeStrength：個股漲10%、大盤漲5% → RS +5', () => {
  const d = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'];
  const rows = d.map((date, i) => ({ date, close: 100 + i * 2 }));      // 100 → 110
  const bench = d.map((date, i) => ({ date, close: 100 + i }));          // 100 → 105
  const r = relativeStrength(rows, bench, [5]);
  assert.equal(r.enough, true);
  assert.deepEqual(r.items, [{ n: 5, stock: 10, bench: 5, rs: 5 }]);
});

test('relativeStrength：個股弱於大盤 → RS 為負', () => {
  const d = seq(0, 5).map((i) => `d${i}`);
  const rows = d.map((date) => ({ date, close: 100 }));                  // 0%
  const bench = d.map((date, i) => ({ date, close: 100 + i * 2 }));      // +10%
  assert.equal(relativeStrength(rows, bench, [5]).items[0].rs, -10);
});

test('relativeStrength：天期不足時跳過該天期', () => {
  const d = seq(0, 3).map((i) => `d${i}`);
  const rows = d.map((date, i) => ({ date, close: 100 + i }));
  const bench = d.map((date) => ({ date, close: 100 }));
  const r = relativeStrength(rows, bench, [3, 20]);
  assert.deepEqual(r.items.map((x) => x.n), [3]); // 20 日不夠，被略過
});
