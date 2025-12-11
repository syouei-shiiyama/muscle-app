from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from db import Base   # db.py に定義している Base をインポート


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, nullable=False)      # ★ 表示用のユーザー名
    hashed_password = Column(String, nullable=False)

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
