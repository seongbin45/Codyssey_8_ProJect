"""
Yahoo Finance Chart API에서 삼성전자(005930.KS) 일별 종가 6년치를 받아
data/samsung_2020_2026.csv로 저장한다. 외부 라이브러리(yfinance) 없이
표준 라이브러리(urllib)만으로 동작한다.
"""
import csv
import json
import os
import urllib.request
from datetime import datetime, timezone

TICKER = "005930.KS"
RANGE = "6y"
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "samsung_2020_2026.csv")

URL = f"https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}?range={RANGE}&interval=1d"


def fetch():
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.loads(resp.read())

    result = payload["chart"]["result"][0]
    timestamps = result["timestamp"]
    closes = result["indicators"]["quote"][0]["close"]

    rows = []
    for ts, close in zip(timestamps, closes):
        if close is None:
            continue  # 휴장/결측 캔들 스킵
        date = datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()
        rows.append({"date": date, "value": round(close)})
    return rows


def save_csv(rows):
    with open(OUT_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["date", "value"])
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    rows = fetch()
    save_csv(rows)
    print(f"fetched {len(rows)} rows: {rows[0]['date']} ~ {rows[-1]['date']}")
    print(f"saved to {OUT_PATH}")
