# backend/models.py

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from db import Base   # すでにある Base をインポート（db.py にあるはず）

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)

    # ★ 追加：ユーザーが持つ測定記録
    measurements = relationship("Measurement", back_populates="user")


class Measurement(Base):
    __tablename__ = "measurements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    preset_id = Column(String, index=True)  # "goku" など
    height = Column(Float)
    weight = Column(Float)
    fat = Column(Float)
    level = Column(Float)

    created_at = Column(DateTime, default=datetime.utcnow)

    # ユーザーとの紐付け
    user = relationship("User", back_populates="measurements")
