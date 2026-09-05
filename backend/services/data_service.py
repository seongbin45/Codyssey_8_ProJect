from typing import List, Dict, Any
from datetime import datetime
from firebase_admin import firestore
from schemas.data import DataCreate, DataResponse
from services.firebase_service import db

DATA_COLLECTION = "data"

class DataService:
    @staticmethod
    def add_data(data: DataCreate) -> DataResponse:
        doc_ref = db.collection(DATA_COLLECTION).document()
        
        now = datetime.now()
        data_dict = data.model_dump()
        data_dict["created_at"] = now
        
        doc_ref.set(data_dict)
        
        return DataResponse(
            id=doc_ref.id,
            date=data.date,
            value=data.value,
            memo=data.memo,
            created_at=now
        )

    @staticmethod
    def get_all_data() -> List[DataResponse]:
        docs = db.collection(DATA_COLLECTION).order_by("date").stream()
        
        result = []
        for doc in docs:
            data = doc.to_dict()
            result.append(DataResponse(
                id=doc.id,
                date=data.get("date", ""),
                value=data.get("value", 0.0),
                memo=data.get("memo"),
                created_at=data.get("created_at")
            ))
        return result

    @staticmethod
    def update_data(doc_id: str, data: DataCreate) -> DataResponse:
        doc_ref = db.collection(DATA_COLLECTION).document(doc_id)
        
        doc = doc_ref.get()
        if not doc.exists:
            raise ValueError(f"Document with ID {doc_id} not found")
            
        update_data = data.model_dump()
        doc_ref.update(update_data)
        
        updated_doc = doc_ref.get().to_dict()
        return DataResponse(
            id=doc_id,
            date=updated_doc.get("date", data.date),
            value=updated_doc.get("value", data.value),
            memo=updated_doc.get("memo", data.memo),
            created_at=updated_doc.get("created_at")
        )

    @staticmethod
    def delete_data(doc_id: str) -> bool:
        doc_ref = db.collection(DATA_COLLECTION).document(doc_id)
        if not doc_ref.get().exists:
            raise ValueError(f"Document with ID {doc_id} not found")
            
        doc_ref.delete()
        return True

    @staticmethod
    def get_summary() -> Dict[str, Any]:
        all_data = DataService.get_all_data()
        
        if not all_data:
            return {
                "period": "No data",
                "count": 0,
                "metrics": {
                    "total": 0,
                    "average": 0,
                    "max": 0,
                    "min": 0
                },
                "trend": "No trend available"
            }
            
        values = [d.value for d in all_data]
        dates = [d.date for d in all_data]
        
        total = sum(values)
        count = len(values)
        avg = total / count if count > 0 else 0
        max_val = max(values)
        min_val = min(values)
        
        # Determine trend based on last 5 items compared to previous
        trend = "안정적 (유지)"
        if count >= 10:
            recent_avg = sum(values[-5:]) / 5
            past_avg = sum(values[-10:-5]) / 5
            
            if recent_avg > past_avg * 1.05:
                trend = f"상승세 (+{((recent_avg/past_avg) - 1) * 100:.1f}%)"
            elif recent_avg < past_avg * 0.95:
                trend = f"하락세 ({((recent_avg/past_avg) - 1) * 100:.1f}%)"
                
        return {
            "period": f"{min(dates)} ~ {max(dates)}",
            "count": count,
            "metrics": {
                "total": round(total, 2),
                "average": round(avg, 2),
                "max": round(max_val, 2),
                "min": round(min_val, 2)
            },
            "trend": trend
        }
