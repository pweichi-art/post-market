// 執行：node --test test/prefs.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

// prefs.js 用 localStorage，Node 沒有 → 給一個最小替身
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { getMaPeriods, setMaPeriods, DEFAULT_PERIODS, primaryPeriod } =
  await import('../src/prefs.js');

test('沒設定時回預設', () => {
  store.clear();
  assert.deepEqual(getMaPeriods(), DEFAULT_PERIODS);
});

test('存取 round-trip + 排序去重', () => {
  store.clear();
  const saved = setMaPeriods([20, 5, 20, 60, 10]);
  assert.deepEqual(saved, [5, 10, 20, 60]);
  assert.deepEqual(getMaPeriods(), [5, 10, 20, 60]);
});

test('過濾非法值（範圍、非整數）', () => {
  store.clear();
  assert.deepEqual(setMaPeriods([1, 3, 5, 500, 2.5, -10, 240]), [3, 5, 240]);
});

test('全非法 → 回預設', () => {
  store.clear();
  assert.deepEqual(setMaPeriods([0, 1, 999]), DEFAULT_PERIODS);
});

test('最多 6 條', () => {
  store.clear();
  assert.equal(setMaPeriods([2, 3, 4, 5, 6, 7, 8, 9, 10]).length, 6);
});

test('壞掉的 JSON → 回預設', () => {
  store.clear();
  store.set('ma_periods', '{not json');
  assert.deepEqual(getMaPeriods(), DEFAULT_PERIODS);
});

test('primaryPeriod 取中間', () => {
  assert.equal(primaryPeriod([5, 10, 20, 60]), 20);
  assert.equal(primaryPeriod([10, 20]), 20);
  assert.equal(primaryPeriod([5, 10, 60, 120]), 60);
  assert.equal(primaryPeriod([30]), 30);
});
