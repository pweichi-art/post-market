"""
M0 原型 - 扣抵值 / 均線上彎 計算核心

這支檔案是整個專案的心臟。之後網頁版 deduction.js 會逐行照這個翻譯。
所以這裡的每個數字都要能用 Excel 手動對到一模一樣。

名詞（詳見 SPEC.md 第 3 節）：
- 收盤價序列 close[]，今天是第 t 天（最後一筆），均線週期 N
- 今日 MA(N) = 最近 N 天收盤價平均 = mean(close[t-N+1 .. t])
- 「未來第 k 個交易日的扣抵值」= close[t-N+k]
    白話：再過 k 個交易日，計算 MA(N) 時會被「踢出視窗」的那筆舊收盤價
- 上彎條件：未來第 k 日的收盤價 > 該日扣抵值  → 當天 MA(N) 往上
- 走平價（= 基準價 = 上彎所需價位）：就等於當日扣抵值
"""
from __future__ import annotations
import io
import sys
import json
import pathlib
from dataclasses import dataclass

# Windows 終端機預設不是 UTF-8，強制切成 UTF-8 避免中文變亂碼
try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


# ---------- 資料讀取 ----------

def load_closes(stock_id: str) -> tuple[list[str], list[float]]:
    """讀 fetch.py 存的 JSON，回傳 (日期list, 收盤價list)，皆由舊到新。"""
    path = pathlib.Path(__file__).parent / "data" / f"{stock_id}.json"
    rows = json.loads(path.read_text(encoding="utf-8"))
    rows.sort(key=lambda r: r["date"])
    dates = [r["date"] for r in rows]
    closes = [float(r["close"]) for r in rows]
    return dates, closes


# ---------- 核心計算 ----------

def mean(xs: list[float]) -> float:
    return sum(xs) / len(xs)


@dataclass
class FutureDay:
    k: int            # 未來第幾個交易日（1 = 明天）
    deduction: float  # 該日扣抵值 = 該日收盤要站上多少，MA 才會上彎


@dataclass
class MaResult:
    period: int
    enough_data: bool
    ma_today: float | None = None
    ma_yesterday: float | None = None
    trend: str | None = None            # "上彎" / "下彎" / "走平"（今日 vs 昨日）
    last_close: float | None = None
    hold_up_days: int | None = None     # 假設股價維持在現價，均線可連續上彎幾天
    future: list[FutureDay] | None = None


def calc(dates: list[str], closes: list[float], period: int,
         future_n: int = 10) -> MaResult:
    """計算單一週期的扣抵值分析。

    參數
      dates, closes : 由舊到新的日期與收盤價
      period        : 均線天數 N（5 / 10 / 20 / 60）
      future_n      : 往後看幾個交易日（預設 10）
    """
    n = period
    t = len(closes) - 1  # 今天的 index

    # 至少要 N+1 筆才能算「今日 MA」和「昨日 MA」
    if len(closes) < n + 1:
        return MaResult(period=n, enough_data=False)

    ma_today = mean(closes[t - n + 1: t + 1])      # 最近 N 天
    ma_yesterday = mean(closes[t - n: t])          # 往前挪一天的 N 天
    if ma_today > ma_yesterday:
        trend = "上彎"
    elif ma_today < ma_yesterday:
        trend = "下彎"
    else:
        trend = "走平"

    last_close = closes[t]

    # 未來第 k 日扣抵值 = close[t - n + k]，需 t-n+k <= t，即 k <= n
    future: list[FutureDay] = []
    for k in range(1, future_n + 1):
        idx = t - n + k
        if idx < 0 or k > n:
            break
        future.append(FutureDay(k=k, deduction=closes[idx]))

    # 假設股價「維持在今日收盤價」，均線可以連續上彎幾天：
    # 條件是 last_close > 未來第 k 日扣抵值，一路連續成立
    hold_up_days = 0
    for fd in future:
        if last_close > fd.deduction:
            hold_up_days += 1
        else:
            break

    return MaResult(
        period=n,
        enough_data=True,
        ma_today=round(ma_today, 4),
        ma_yesterday=round(ma_yesterday, 4),
        trend=trend,
        last_close=last_close,
        hold_up_days=hold_up_days,
        future=future,
    )


# ---------- 顯示 ----------

def print_report(stock_id: str, dates: list[str], closes: list[float],
                 periods=(5, 10, 20, 60)) -> None:
    t = len(closes) - 1
    print("=" * 60)
    print(f" {stock_id}  盤後扣抵值分析")
    print(f" 資料日期：{dates[t]}   今日收盤：{closes[t]}")
    print(f" 總交易日數：{len(closes)}（{dates[0]} ~ {dates[t]}）")
    print("=" * 60)

    for p in periods:
        r = calc(dates, closes, p)
        print()
        if not r.enough_data:
            print(f"[MA{p}] 資料不足（需 {p + 1} 筆，只有 {len(closes)} 筆）")
            continue
        print(f"[MA{p}]  目前均價 {r.ma_today}   方向 {r.trend}"
              f"（昨日均價 {r.ma_yesterday}）")
        print(f"       假設股價維持 {r.last_close}，均線可連續上彎 "
              f"{r.hold_up_days} 個交易日")
        print(f"       {'未來':<4}{'扣抵值(需站上)':>14}{'與現價差':>12}")
        for fd in r.future:
            diff = round(r.last_close - fd.deduction, 2)
            flag = "現價已站上 ↗" if diff > 0 else ("持平" if diff == 0 else "尚未站上 ↘")
            print(f"       D+{fd.k:<3}{fd.deduction:>14.2f}{diff:>12.2f}   {flag}")

    print()
    print("-" * 60)
    print("本輸出僅供邏輯驗證使用，非投資建議。")


# ---------- 驗證輔助 ----------

def dump_tail_for_excel(stock_id: str, dates, closes, n: int = 65) -> None:
    """印出最後 n 筆日期與收盤價，方便貼到 Excel 手動對算。"""
    print()
    print(f"# 最後 {n} 筆（貼 Excel 用）")
    print("date,close")
    for d, c in zip(dates[-n:], closes[-n:]):
        print(f"{d},{c}")


if __name__ == "__main__":
    import sys
    sid = sys.argv[1] if len(sys.argv) > 1 else "2330"
    dts, cls = load_closes(sid)
    print_report(sid, dts, cls)
    if "--excel" in sys.argv:
        dump_tail_for_excel(sid, dts, cls)
