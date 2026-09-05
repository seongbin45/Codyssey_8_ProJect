"""
data/sample_data.json의 샘플 시계열 데이터를 Firestore `data` 컬렉션에 일괄 업로드한다.

사용법 (backend/ 디렉토리에서):
    ./venv/Scripts/python.exe seed_data.py
"""
import json
import os
from datetime import datetime

from dotenv import load_dotenv

load_dotenv()

from services.firebase_service import db

DATA_COLLECTION = "data"
SAMPLE_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "sample_data.json")


def seed():
    with open(SAMPLE_DATA_PATH, encoding="utf-8") as f:
        records = json.load(f)

    now = datetime.now()
    batch = db.batch()
    collection = db.collection(DATA_COLLECTION)

    for i, record in enumerate(records, start=1):
        doc_ref = collection.document()
        batch.set(doc_ref, {
            "date": record["date"],
            "value": record["value"],
            "memo": record.get("memo") or None,
            "created_at": now,
        })
        # Firestore 배치는 최대 500건 제한 — 넘으면 커밋 후 새 배치 시작
        if i % 500 == 0:
            batch.commit()
            batch = db.batch()

    batch.commit()
    print(f"Seeded {len(records)} records into '{DATA_COLLECTION}' collection.")


if __name__ == "__main__":
    seed()
