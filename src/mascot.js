// 吉祥物：一隻圍著品牌藍領巾的柴犬，四種表情對應四種畫面狀態。
// 純 SVG 字串，大小由外層 CSS class 控制（不設 width/height，用 viewBox 縮放）。

const HEAD = `
  <ellipse cx="24" cy="38" rx="14" ry="20" fill="#B9834C" transform="rotate(-24 24 38)"/>
  <ellipse cx="76" cy="38" rx="14" ry="20" fill="#B9834C" transform="rotate(24 76 38)"/>
  <circle cx="50" cy="52" r="30" fill="#E3AE78"/>
  <ellipse cx="50" cy="67" rx="17" ry="13" fill="#FBEFDD"/>
  <path d="M32 84 L50 98 L68 84 Q50 90 32 84 Z" fill="#5B8DEF"/>
`;

const FACES = {
  // 一般（頁首 logo）：眼睛圓、微笑
  normal: `
    <circle cx="38" cy="48" r="4" fill="#2E2A26"/>
    <circle cx="62" cy="48" r="4" fill="#2E2A26"/>
    <ellipse cx="50" cy="63" rx="4.5" ry="3.5" fill="#2E2A26"/>
    <path d="M40 71 Q50 78 60 71" stroke="#2E2A26" stroke-width="3" fill="none" stroke-linecap="round"/>
  `,
  // 疑惑（空狀態 / 查無資料）：一邊眉毛挑高 + 問號
  confused: `
    <circle cx="38" cy="49" r="4" fill="#2E2A26"/>
    <circle cx="62" cy="47" r="4" fill="#2E2A26"/>
    <path d="M56 39 Q62 34 68 38" stroke="#2E2A26" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse cx="50" cy="63" rx="4.5" ry="3.5" fill="#2E2A26"/>
    <circle cx="50" cy="73" r="3" fill="none" stroke="#2E2A26" stroke-width="2.5"/>
    <text x="72" y="22" font-size="20" font-weight="700" fill="#5B8DEF">?</text>
  `,
  // 苦惱（連線失敗 / 逾時）：眉頭上揚內收（擔心臉）、嘴角下垂
  sad: `
    <circle cx="38" cy="50" r="4" fill="#2E2A26"/>
    <circle cx="62" cy="50" r="4" fill="#2E2A26"/>
    <path d="M31 46 L44 40" stroke="#2E2A26" stroke-width="3" stroke-linecap="round"/>
    <path d="M69 46 L56 40" stroke="#2E2A26" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="50" cy="63" rx="4.5" ry="3.5" fill="#2E2A26"/>
    <path d="M40 76 Q50 70 60 76" stroke="#2E2A26" stroke-width="3" fill="none" stroke-linecap="round"/>
  `,
  // 打盹（載入中）：閉眼 + Z
  sleepy: `
    <path d="M33 48 q5 -6 10 0" stroke="#2E2A26" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M57 48 q5 -6 10 0" stroke="#2E2A26" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse cx="50" cy="63" rx="4.5" ry="3.5" fill="#2E2A26"/>
    <ellipse cx="50" cy="72" rx="5" ry="3" fill="#2E2A26"/>
    <text x="70" y="24" font-size="16" font-weight="700" fill="#B9834C">Z</text>
    <text x="80" y="14" font-size="11" font-weight="700" fill="#B9834C" opacity="0.7">z</text>
  `,
};

/**
 * @param {'normal'|'confused'|'sad'|'sleepy'} mood
 * @param {string} extraClass 額外 CSS class（例如 'lg' 放大）
 */
export function mascotSvg(mood = 'normal', extraClass = '') {
  const face = FACES[mood] || FACES.normal;
  return `<svg class="mascot mascot-${mood} ${extraClass}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${HEAD}${face}</svg>`;
}
