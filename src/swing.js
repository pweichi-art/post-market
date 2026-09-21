// 轉折點偵測（ZigZag）—— 十字訣「波」的地基
//
// 出處：朱家泓《抓住飆股輕鬆賺》第1篇第4章「認識轉折波與趨勢波劃法」、
//       第5篇第1章十字訣第一步「波」。
//
// 書上的「頭」「底」就是走勢圖上的轉折高低點：
//   上升波＝頭頭高、底底高　下跌波＝頭頭低、底底低　盤整波＝頭不過頭、底不破底
//
// ⚠️ 這類算法有一個無法迴避的主觀參數：「回檔或反彈多少 % 才算一個轉折」。
//    門檻設小 → 轉折很多、很雜；設大 → 只剩大波段。沒有標準答案，
//    所以一定要把結果畫在 K 線上讓人用眼睛檢查（見 chart.js 的 swings 參數）。
//
// ⚠️ 已知邊界效應：資料的第一根 K 棒會被當成第一段走勢的起點（頭或底），
//    那其實只是「我們的資料從這裡開始」而不是真的轉折。因為它離現在很遠
//    （我們抓 1.5 年資料），判斷「最近的波」時不會用到，影響可忽略。

/**
 * 用「百分比回撤」找轉折點。高點用最高價、低點用最低價（與書上看圖的定義一致）。
 *
 * @param {number[]} highs 由舊到新的最高價
 * @param {number[]} lows  由舊到新的最低價
 * @param {number} thresholdPct 轉折門檻（百分比，例如 6 代表 6%）
 * @returns {{pivots: Array<{idx:number,type:'high'|'low',price:number}>,
 *            tentative: null|{idx:number,type:'high'|'low',price:number}}}
 *   pivots    已確認的轉折點（已經被反向走勢確認過）
 *   tentative 最後一段還在進行中的極值——還沒被確認，畫圖時要標成「未確認」
 */
export function detectSwings(highs, lows, thresholdPct = 6) {
  const thr = thresholdPct / 100;
  const n = Math.min(highs.length, lows.length);
  if (n < 3 || !(thr > 0)) return { pivots: [], tentative: null };

  const pivots = [];
  let dir = null;            // 'up' = 正在找高點，'down' = 正在找低點
  let hiIdx = 0, hiVal = highs[0];
  let loIdx = 0, loVal = lows[0];

  for (let i = 1; i < n; i++) {
    if (dir === 'up') {
      if (highs[i] >= hiVal) { hiVal = highs[i]; hiIdx = i; }
      else if ((hiVal - lows[i]) / hiVal >= thr) {
        pivots.push({ idx: hiIdx, type: 'high', price: hiVal });
        dir = 'down'; loVal = lows[i]; loIdx = i;
      }
    } else if (dir === 'down') {
      if (lows[i] <= loVal) { loVal = lows[i]; loIdx = i; }
      else if ((highs[i] - loVal) / loVal >= thr) {
        pivots.push({ idx: loIdx, type: 'low', price: loVal });
        dir = 'up'; hiVal = highs[i]; hiIdx = i;
      }
    } else {
      // 還沒定方向：兩邊都盯著，誰先跑到門檻就以誰為準（同時達標取幅度大的）
      if (highs[i] > hiVal) { hiVal = highs[i]; hiIdx = i; }
      if (lows[i] < loVal) { loVal = lows[i]; loIdx = i; }
      const drop = (hiVal - lows[i]) / hiVal;
      const rise = (highs[i] - loVal) / loVal;
      if (drop >= thr || rise >= thr) {
        if (drop >= rise) {
          pivots.push({ idx: hiIdx, type: 'high', price: hiVal });
          dir = 'down'; loVal = lows[i]; loIdx = i;
        } else {
          pivots.push({ idx: loIdx, type: 'low', price: loVal });
          dir = 'up'; hiVal = highs[i]; hiIdx = i;
        }
      }
    }
  }

  const tentative =
    dir === 'up' ? { idx: hiIdx, type: 'high', price: hiVal }
    : dir === 'down' ? { idx: loIdx, type: 'low', price: loVal }
    : null;

  return { pivots, tentative };
}
