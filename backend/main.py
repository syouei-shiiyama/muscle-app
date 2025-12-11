from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import auth
from db import init_db
from fastapi import Depends
from sqlalchemy.orm import Session

from db import get_db
from models import Measurement, User
from auth import get_current_user  

from typing import List
from datetime import datetime 
from sqlalchemy.orm import Session




from presets import PRESET_TARGETS  # 同じ backend フォルダ内の presets.py から読み込み

app = FastAPI()

#DB 初期化
init_db()


# ====== モデル ======
class BodyData(BaseModel):
    height: float   # cm
    weight: float   # kg
    fat: float      # 体脂肪率 (%)
    preset_id: str  # "goku" など


# ====== レベル計算 API ======
@app.post("/calc_level")
def calc_level(body: BodyData):
    preset = PRESET_TARGETS.get(body.preset_id)
    if not preset:
        return {"level": None, "bmi": None, "error": "Invalid preset"}

    # 現在の BMI
    height_m = body.height / 100
    bmi = body.weight / (height_m ** 2)

    # 目標との差分（かなりざっくりなモデル）
    target_bmi = preset["target_bmi"]
    target_fat = preset["target_fat"]

    if target_bmi is None or target_fat is None:
        # カスタム目標など、基準が無い場合
        return {
            "level": None,
            "bmi": round(bmi, 1),
            "error": "No target for this preset",
        }

    bmi_progress = target_bmi - bmi        # BMI の差
    fat_progress = body.fat - target_fat   # 体脂肪率の差

    # 差が小さいほどレベルが高くなるように 0〜100 に正規化
    level = 100 - (abs(bmi_progress) * 10 + abs(fat_progress) * 2)
    level = max(0, min(100, level))

    return {
        "level": round(level, 1),
        "bmi": round(bmi, 1),
    }


# ====== プリセット一覧 API（フロント側から fetch で取る用） ======
@app.get("/presets")
def get_presets():
    # dict -> list にして返す
    return {
        "presets": list(PRESET_TARGETS.values())
    }


# ====== CORS ======
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RecordIn(BaseModel):
    preset_id: str
    height: float
    weight: float
    fat: float
    level: float

class RecordOut(BaseModel):
    id: int
    preset_id: str
    height: float
    weight: float
    fat: float
    level: float
    created_at: datetime

    class Config:
        from_attributes = True



# ====== フロント配信設定 ======
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

# /static で frontend フォルダを配信
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


# ルートにアクセスしたら index.html を返す
@app.get("/")
def read_root():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

app.include_router(auth.router)


@app.post("/records")
def create_record(
    record: RecordIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    m = Measurement(
        user_id=current_user.id,
        preset_id=record.preset_id,
        height=record.height,
        weight=record.weight,
        fat=record.fat,
        level=record.level,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return {
        "id": m.id,
        "created_at": m.created_at,
        "level": m.level,
    }


@app.get("/records", response_model=List[RecordOut])
def list_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    records = (
        db.query(Measurement)
        .filter(Measurement.user_id == current_user.id)
        .order_by(Measurement.created_at.asc())
        .all()
    )
    return records


