// 執行：node --test test/swing.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { detectSwings } from '../src/swing.js';

// 為了好手算，測資讓最高價＝最低價（等於只有一個價位的 K 棒）
const flatBars = (vals) => ({ highs: vals, lows: vals });

test('簡單鋸齒：抓出 底→頭→底，最後一段未確認', () => {
  // 100 →110 →105 →120 →108 →130，門檻 5%
  const { highs, lows } = flatBars([100, 110, 105, 120, 108, 130]);
  const { pivots, tentative } = detectSwings(highs, lows, 5);
  assert.deepEqual(pivots, [
    { idx: 0, type: 'low', price: 100 },   // 起漲前的低點
    { idx: 3, type: 'high', price: 120 },  // 漲到 120 後跌 10% 確認為頭
    { idx: 4, type: 'low', price: 108 },   // 跌到 108 後漲 20% 確認為底
  ]);
  assert.deepEqual(tentative, { idx: 5, type: 'high', price: 130 });
});

test('門檻拉大 → 小波動被忽略，轉折變少', () => {
  const { highs, lows } = flatBars([100, 110, 105, 120, 108, 130]);
  const loose = detectSwings(highs, lows, 15);
  // 5% 抓到 3 個轉折，15% 只剩 1 個
  assert.equal(detectSwings(highs, lows, 5).pivots.length, 3);
  assert.equal(loose.pivots.length, 1);
  assert.deepEqual(loose.pivots[0], { idx: 0, type: 'low', price: 100 });
});

test('一路上漲：起漲點被標成底，最後高點未確認', () => {
  const { highs, lows } = flatBars([10, 11, 12, 13, 14, 15]);
  const r = detectSwings(highs, lows, 5);
  // 資料第一根是視窗邊界，會被當成這段漲勢的起點（底）——ZigZag 的已知邊界效應
  assert.deepEqual(r.pivots, [{ idx: 0, type: 'low', price: 10 }]);
  assert.deepEqual(r.tentative, { idx: 5, type: 'high', price: 15 });
});

test('一路下跌：未確認的是低點', () => {
  const { highs, lows } = flatBars([15, 14, 13, 12, 11, 10]);
  const r = detectSwings(highs, lows, 5);
  assert.equal(r.tentative.type, 'low');
  assert.equal(r.tentative.price, 10);
});

test('高低點分開時：頭取最高價、底取最低價', () => {
  const highs = [100, 100, 130, 120, 118];
  const lows = [100, 96, 120, 110, 100];
  const r = detectSwings(highs, lows, 8);
  const hi = r.pivots.find((p) => p.type === 'high');
  assert.equal(hi.price, 130);   // 用 highs 不是收盤
  assert.equal(hi.idx, 2);
});

test('轉折點的 idx 依序遞增、高低交替', () => {
  const vals = [100, 120, 100, 125, 98, 140, 110, 150];
  const { highs, lows } = flatBars(vals);
  const { pivots } = detectSwings(highs, lows, 8);
  for (let i = 1; i < pivots.length; i++) {
    assert.ok(pivots[i].idx > pivots[i - 1].idx, '索引必須遞增');
    assert.notEqual(pivots[i].type, pivots[i - 1].type, '高低必須交替');
  }
});

test('資料太少或門檻為 0 → 回空結果', () => {
  assert.deepEqual(detectSwings([1, 2], [1, 2], 5), { pivots: [], tentative: null });
  assert.deepEqual(detectSwings([1, 2, 3], [1, 2, 3], 0), { pivots: [], tentative: null });
});
