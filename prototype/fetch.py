"""
M0 原型 - 抓資料
從 FinMind 免費 API 抓一檔股票的每日收盤價，存成 JSON 檔。

用法：
    python fetch.py 2330
    python fetch.py 2330 2024-01-01     # 指定起始日
"""
import io
import sys
import json
import datetime
import pathlib
import requests

try:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
except Exception:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

FINMIND_URL = "https://api.finmindtrade.com/api/v4/data"
OUT_DIR = pathlib.Path(__file__).parent / "data"


def fetch_daily_price(stock_id: str, start_date: str) -> list[dict]:
    """向 FinMind 抓某股票從 start_date 至今的每日行情。

    回傳 list，每筆是 {date, open, max, min, close, ...}，日期由舊到新。
    """
    params = {
        "dataset": "TaiwanStockPrice",   # 免費、免金鑰、未還原權值
        "data_id": stock_id,
        "start_date": start_date,
    }
    resp = requests.get(FINMIND_URL, params=params, timeout=15)
    resp.raise_for_status()
    body = resp.json()
    if body.get("status") != 200:
        raise RuntimeError(f"FinMind 回應非 200：{body.get('msg')}")
    data = body.get("data", [])
    # FinMind 已按日期排序，保險起見再排一次
    data.sort(key=lambda row: row["date"])
    return data


def main() -> None:
    if len(sys.argv) < 2:
        print("用法：python fetch.py <股號> [起始日 YYYY-MM-DD]")
        sys.exit(1)

    stock_id = sys.argv[1]
    if len(sys.argv) >= 3:
        start_date = sys.argv[2]
    else:
        # 預設抓「約一年半」，確保 MA60 有足夠交易日
        start_date = (datetime.date.today() - datetime.timedelta(days=550)).isoformat()

    print(f"抓取 {stock_id} 自 {start_date} 起的每日收盤價 ...")
    rows = fetch_daily_price(stock_id, start_date)
    print(f"共 {len(rows)} 個交易日，"
          f"{rows[0]['date']} ~ {rows[-1]['date']}")

    OUT_DIR.mkdir(exist_ok=True)
    out_path = OUT_DIR / f"{stock_id}.json"
    out_path.write_text(
        json.dumps(rows, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"已存檔：{out_path}")


if __name__ == "__main__":
    main()
