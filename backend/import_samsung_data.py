"""
data/samsung_2023_2024.csv (실제 삼성전자 주가) 를 Firestore `data` 컬렉션으로 교체 시딩한다.
기존 data 컬렉션 문서를 전부 삭제하고, CSV의 date/close를 date/value로 매핑해 새로 넣는다.
local과 production이 같은 Firestore(FIRESTORE_DATABASE_ID)를 쓰므로 한 번만 실행하면 둘 다 반영된다.
"""
import csv
import os
from datetime import datetime

from dotenv import load_dotenv

load_dotenv()

from services.firebase_service import db

DATA_COLLECTION = "data"
CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "samsung_2023_2024.csv")


def load_rows():
    with open(CSV_PATH, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = []
        for r in reader:
            rows.append({
                "date": r["date"],
                "value": round(float(r["close"])),
                "memo": None,
            })
    return rows


def clear_collection():
    docs = list(db.collection(DATA_COLLECTION).stream())
    print(f"deleting {len(docs)} existing documents...")
    batch = db.batch()
    for i, doc in enumerate(docs, start=1):
        batch.delete(doc.reference)
        if i % 500 == 0:
            batch.commit()
            batch = db.batch()
    batch.commit()


def seed(rows):
    now = datetime.now()
    batch = db.batch()
    collection = db.collection(DATA_COLLECTION)
    for i, record in enumerate(rows, start=1):
        doc_ref = collection.document()
        batch.set(doc_ref, {**record, "created_at": now})
        if i % 500 == 0:
            batch.commit()
            batch = db.batch()
    batch.commit()


if __name__ == "__main__":
    rows = load_rows()
    print(f"loaded {len(rows)} rows from CSV, e.g. {rows[0]} ... {rows[-1]}")
    clear_collection()
    seed(rows)
    print(f"seeded {len(rows)} records into '{DATA_COLLECTION}' collection.")
