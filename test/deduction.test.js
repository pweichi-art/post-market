// 執行：node --test test/
// 驗證 src/deduction.js 的數字，和 prototype/deduction.py + verify.md 一致。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcMA, mean } from '../src/deduction.js';

test('mean 基本', () => {
  assert.equal(mean([1, 2, 3]), 2);
  assert.equal(mean([10, 11, 12, 13, 14, 15]), 12.5);
});

test('合成資料：可手算的小案例（period=3）', () => {
  const dates = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'];
  const closes = [10, 11, 12, 13, 14, 15];
  const r = calcMA(dates, closes, 3, 10);

  assert.equal(r.enoughData, true);
  assert.equal(r.maToday, 14);        // mean(13,14,15)
  assert.equal(r.maYesterday, 13);    // mean(12,13,14)
  assert.equal(r.trend, 'up');
  assert.equal(r.lastClose, 15);
  // 未來扣抵值 = closes[t-3+k]，t=5 → k=1:closes[3]=13, k=2:closes[4]=14, k=3:closes[5]=15
  assert.deepEqual(r.future.map((f) => f.deduction), [13, 14, 15]);
  // 只到 k<=n=3
  assert.equal(r.future.length, 3);
  // 現價 15 > 13、> 14，但不 > 15 → 連 2 天
  assert.equal(r.holdUpDays, 2);
});

test('資料不足時 enoughData=false', () => {
  const r = calcMA(['a', 'b', 'c'], [1, 2, 3], 5);
  assert.equal(r.enoughData, false);
});

test('真實資料：2330 截至 2026-09-02（對照 prototype/verify.md）', () => {
  const rows = JSON.parse(
    readFileSync(new URL('./fixture_2330_20260902.json', import.meta.url)));
  const dates = rows.map((r) => r.date);
  const closes = rows.map((r) => r.close);

  const ma20 = calcMA(dates, closes, 20, 10);
  assert.equal(ma20.maToday, 2396.0, 'MA20 今日均價');
  assert.equal(ma20.maYesterday, 2397.0, 'MA20 昨日均價');
  assert.equal(ma20.trend, 'down', 'MA20 方向');
  assert.equal(ma20.lastClose, 2385.0);
  assert.equal(ma20.future[0].deduction, 2365.0, 'D+1 扣抵值');
  assert.equal(ma20.future[0].date, '2026-08-06');
  assert.equal(ma20.future[1].deduction, 2370.0, 'D+2 扣抵值');
  assert.equal(ma20.future[2].deduction, 2380.0, 'D+3 扣抵值');

  // 上彎條件：明日收在扣抵值 → 走平；高於 → 上彎（用增量公式）
  const t = closes.length - 1;
  const ded = closes[t - 20 + 1];
  const maNextFlat = ma20.maToday + (ded - ded) / 20;
  assert.equal(maNextFlat, ma20.maToday);
  const maNextUp = ma20.maToday + ((ded + 10) - ded) / 20;
  assert.ok(maNextUp > ma20.maToday);
});
