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

// ---------- 波：波浪方向 ----------

/**
 * 用轉折點判斷波浪方向（書上第1篇第3章、十字訣第一步「波」）：
 *   上升波＝頭頭高 且 底底高　下跌波＝頭頭低 且 底底低　其餘＝盤整波
 *
 * 只用「已確認」的轉折點下判斷，未確認的那一段另外回報——因為它還會動，
 * 拿還沒定案的極值下結論會讓方向一天到晚翻來覆去。
 *
 * @param {Array} pivots    detectSwings 回傳的已確認轉折點
 * @param {object|null} tentative 未確認的那一個
 * @returns {{enough:boolean, dir?:'up'|'down'|'range',
 *            higherHigh?:boolean, higherLow?:boolean,
 *            highs?:Array, lows?:Array, breaking?:'newHigh'|'newLow'|null}}
 */
export function waveDirection(pivots, tentative = null) {
  const highs = pivots.filter((p) => p.type === 'high');
  const lows = pivots.filter((p) => p.type === 'low');
  if (highs.length < 2 || lows.length < 2) return { enough: false };

  const [prevH, lastH] = highs.slice(-2);
  const [prevL, lastL] = lows.slice(-2);
  const higherHigh = lastH.price > prevH.price;
  const higherLow = lastL.price > prevL.price;
  const lowerHigh = lastH.price < prevH.price;
  const lowerLow = lastL.price < prevL.price;

  const dir = higherHigh && higherLow ? 'up'
    : lowerHigh && lowerLow ? 'down'
    : 'range';

  // 還在走的那一段有沒有正在突破前高 / 跌破前低（預告方向可能改變）
  let breaking = null;
  if (tentative) {
    if (tentative.type === 'high' && tentative.price > lastH.price) breaking = 'newHigh';
    if (tentative.type === 'low' && tentative.price < lastL.price) breaking = 'newLow';
  }

  return { enough: true, dir, higherHigh, higherLow,
           highs: [prevH, lastH], lows: [prevL, lastL], breaking };
}

// ---------- 支 / 阻：最近的前波高低點 ----------

/**
 * 從轉折點找出離現價最近的支撐與壓力。
 * 書上第8、9步：前底、前頭都可能是支撐或壓力（跌到它是撐、漲到它是壓），
 * 所以這裡不分頭底，只看價位相對現價的上下。
 *
 * @returns {{support: null|{price,type,idx,distPct}, resistance: null|{...}}}
 *   distPct 支撐＝現價往下幾 %；壓力＝現價往上幾 %
 */
export function nearestLevels(pivots, tentative, close) {
  const all = [...pivots];
  if (tentative) all.push(tentative);
  if (!all.length || !(close > 0)) return { support: null, resistance: null };

  const below = all.filter((p) => p.price < close).sort((a, b) => b.price - a.price)[0];
  const above = all.filter((p) => p.price > close).sort((a, b) => a.price - b.price)[0];

  const pack = (p, isSupport) => p && {
    price: p.price,
    type: p.type,
    idx: p.idx,
    distPct: Math.round(Math.abs(isSupport ? close - p.price : p.price - close) / close * 1000) / 10,
  };
  return { support: pack(below, true) || null, resistance: pack(above, false) || null };
}

// ---------- 切：切線（趨勢線）----------

/**
 * 由轉折點畫切線，並延伸到今天（書上第5篇十字訣第七步「切」）：
 *   上升切線＝最後兩個「底」的連線（上漲時的支撐）
 *   下降切線＝最後兩個「頭」的連線（下跌時的壓力）
 *   盤整時兩條都在，就是上下頸線
 *
 * 只有方向對的線才算數：兩個底愈墊愈高（slope > 0）才是上升切線，
 * 兩個頭愈壓愈低（slope < 0）才是下降切線——否則那條線畫得出來但不是切線。
 * 用已確認的轉折點，理由同 waveDirection。
 *
 * @param {Array} pivots 已確認轉折點
 * @param {number[]} closes 收盤價（只用長度與最後一筆）
 * @returns {{up: null|object, down: null|object}} 每條線含
 *   from/to（兩個轉折點）、slope（每根 K 棒漲跌多少）、valueNow（延伸到今天的價位）、
 *   above（現價是否在線上方）、distPct（現價距離切線幾 %）、valid（方向對不對）
 */
export function trendLines(pivots, closes) {
  const n = closes.length;
  if (!n) return { up: null, down: null };
  const close = closes[n - 1];

  const build = (a, b) => {
    if (b.idx === a.idx) return null;
    const slope = (b.price - a.price) / (b.idx - a.idx);
    const valueNow = a.price + slope * (n - 1 - a.idx);
    return {
      from: a,
      to: b,
      slope,
      valueNow: Math.round(valueNow * 100) / 100,
      above: close > valueNow,
      distPct: Math.round(Math.abs(close - valueNow) / close * 1000) / 10,
    };
  };

  const highs = pivots.filter((p) => p.type === 'high');
  const lows = pivots.filter((p) => p.type === 'low');
  const up = lows.length >= 2 ? build(lows[lows.length - 2], lows[lows.length - 1]) : null;
  const down = highs.length >= 2 ? build(highs[highs.length - 2], highs[highs.length - 1]) : null;

  return {
    up: up ? { ...up, valid: up.slope > 0 } : null,
    down: down ? { ...down, valid: down.slope < 0 } : null,
  };
}
