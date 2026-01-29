from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, date

# --------------------
# Auth / User
# --------------------
class UserBase(BaseModel):
    email: EmailStr
    username: str

class UserCreate(UserBase):
    password: str

class UserRead(UserBase):
    id: int
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    email: str
    username: str

class TokenData(BaseModel):
    user_id: Optional[int] = None


# --------------------
# Records（Measurement）
# --------------------
class RecordIn(BaseModel):
    preset_id: str
    height: float
    weight: float
    fat: float
    level: float
    performed_at: date

class RecordOut(BaseModel):
    id: int
    preset_id: str
    height: float
    weight: float
    fat: float
    level: float
    created_at: datetime
    performed_at: date

    class Config:
        from_attributes = True


# --------------------
# Friends（★main.py が import してるやつを戻す）
# --------------------
class FriendRequestCreate(BaseModel):
    to_user_id: int

class FriendRequestOut(BaseModel):
    id: int
    from_user_id: int
    to_user_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class FriendOut(BaseModel):
    user_id: int
    friend_user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# --------------------
# Teams
# --------------------
class TeamCreate(BaseModel):
    name: str

class TeamOut(BaseModel):
    id: int
    name: str
    owner_user_id: int
    created_at: datetime
    invite_code: str

    class Config:
        from_attributes = True

class TeamJoinByCode(BaseModel):
    invite_code: str

class TeamJoinResult(BaseModel):
    team_id: int


# --------------------
# Workouts（もし main.py が参照してたら困るので最低限）
# --------------------
class WorkoutSetCreate(BaseModel):
    exercise_id: int
    set_no: int
    weight_kg: float
    reps: int

class WorkoutSessionCreate(BaseModel):
    performed_at: datetime
    note: str = ""
    sets: List[WorkoutSetCreate]

from typing import List
from datetime import datetime
from pydantic import BaseModel

class WorkoutSetOut(BaseModel):
    exercise_id: int
    set_no: int
    weight_kg: float
    reps: int

    class Config:
        from_attributes = True

class WorkoutSessionOut(BaseModel):
    id: int
    performed_at: datetime
    note: str
    sets: List[WorkoutSetOut]

    class Config:
        from_attributes = True

from pydantic import BaseModel
from datetime import date
from typing import List

# --- Exercise ---
class ExerciseCreate(BaseModel):
    name: str

class ExerciseOut(BaseModel):
    id: int
    name: str
    created_by: int

    class Config:
        from_attributes = True

# --- Lift log ---
class LiftCreate(BaseModel):
    exercise_id: int
    performed_at: date
    weight_kg: float
    reps: int

class LiftOut(BaseModel):
    id: int
    exercise_id: int
    performed_at: date
    weight_kg: float
    reps: int

    class Config:
        from_attributes = True

# --- Series (for chart) ---
class SeriesPoint(BaseModel):
    t: date
    v: float  # 例: 1RM

class LiftSeriesOut(BaseModel):
    exercise_id: int
    exercise_name: str
    series: List[SeriesPoint]
