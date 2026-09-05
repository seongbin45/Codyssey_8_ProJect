"""
Firebase Firestore 연결 및 초기화 서비스
- 서비스 계정 키는 환경변수(FIREBASE_SERVICE_ACCOUNT_JSON)로 관리
- 코드에 하드코딩하지 않음
- 기본 데이터베이스("(default)")가 아닌 이름 있는 Firestore 데이터베이스를 쓸 경우
  FIRESTORE_DATABASE_ID 환경변수로 지정 (firebase_admin.firestore.client()는
  기본 데이터베이스만 지원하므로 google.cloud.firestore.Client를 직접 사용한다)
"""
import os
import json
import firebase_admin
from firebase_admin import credentials
from google.cloud import firestore


def _initialize_firebase():
    """Firebase Admin SDK 초기화 (중복 초기화 방지) 후 Firestore 클라이언트 반환"""
    if firebase_admin._apps:
        app = firebase_admin.get_app()
    else:
        service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")

        if not service_account_json:
            raise ValueError(
                "FIREBASE_SERVICE_ACCOUNT_JSON 환경 변수가 설정되지 않았습니다. "
                ".env 파일 또는 배포 환경에서 설정해주세요."
            )

        service_account_info = json.loads(service_account_json)
        cred = credentials.Certificate(service_account_info)
        app = firebase_admin.initialize_app(cred)

    database_id = os.getenv("FIRESTORE_DATABASE_ID", "(default)")

    return firestore.Client(
        project=app.project_id,
        credentials=app.credential.get_credential(),
        database=database_id,
    )


# Firestore 클라이언트 (싱글턴)
db = _initialize_firebase()
