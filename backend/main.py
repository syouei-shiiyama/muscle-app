from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from sqlalchemy.orm import Session

import auth
from auth import get_current_user
from db import init_db, get_db
from pydantic import BaseModel


from models import Measurement, User, FriendRequest, Friendship, Team, TeamMember
from schemas import (
    RecordIn, RecordOut,
    FriendRequestCreate, FriendRequestOut, FriendOut,
    TeamCreate, TeamOut
)

from presets import PRESET_TARGETS
from typing import List
from datetime import datetime
from datetime import date
from sqlalchemy import Date
from models import WorkoutSession, WorkoutSet, Friendship
from schemas import WorkoutSessionCreate, WorkoutSessionOut


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
    performed_at: date 

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
        performed_at=record.performed_at,
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
        .order_by(Measurement.performed_at.asc())
        .all()
    )
    return records



# --------------------
# Friend APIs（認証は get_current_user を使う）
# --------------------
@app.post("/friends/requests", response_model=FriendRequestOut)
def send_friend_request(
    body: FriendRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    me = current_user.id
    if body.to_user_id == me:
        raise HTTPException(status_code=400, detail="Cannot friend yourself")

    # 既に友達か（ペアを正規化）
    a, b = sorted([me, body.to_user_id])
    exist = db.query(Friendship).filter(
        Friendship.user_id == a,
        Friendship.friend_user_id == b
    ).first()
    if exist:
        raise HTTPException(status_code=400, detail="Already friends")

    # 既に pending があるか
    req = db.query(FriendRequest).filter(
        FriendRequest.from_user_id == me,
        FriendRequest.to_user_id == body.to_user_id,
        FriendRequest.status == "pending"
    ).first()
    if req:
        return req

    req = FriendRequest(from_user_id=me, to_user_id=body.to_user_id, status="pending")
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@app.get("/friends/requests/inbox", response_model=list[FriendRequestOut])
def inbox_friend_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    me = current_user.id
    return db.query(FriendRequest).filter(
        FriendRequest.to_user_id == me,
        FriendRequest.status == "pending"
    ).all()


@app.post("/friends/requests/{request_id}/accept")
def accept_friend_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    me = current_user.id
    req = db.query(FriendRequest).filter(FriendRequest.id == request_id).first()
    if not req or req.to_user_id != me:
        raise HTTPException(status_code=404, detail="Request not found")

    req.status = "accepted"

    # Friendship は a-b の片方向で1件だけ保存
    a, b = sorted([req.from_user_id, req.to_user_id])
    if not db.query(Friendship).filter(
        Friendship.user_id == a,
        Friendship.friend_user_id == b
    ).first():
        db.add(Friendship(user_id=a, friend_user_id=b))

    db.commit()
    return {"ok": True}


@app.get("/friends", response_model=list[FriendOut])
def list_friends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    me = current_user.id
    return db.query(Friendship).filter(
        (Friendship.user_id == me) | (Friendship.friend_user_id == me)
    ).all()


# --------------------
# Team APIs
# --------------------
@app.get("/teams/my", response_model=list[TeamOut])
def my_teams(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Team)
        .join(TeamMember, TeamMember.team_id == Team.id)
        .filter(TeamMember.user_id == current_user.id)
        .all()
    )

@app.post("/teams", response_model=TeamOut)
def create_team(
    body: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    me = current_user.id
    team = Team(name=body.name, owner_user_id=me)
    db.add(team)
    db.commit()
    db.refresh(team)

    # 作成者を owner としてメンバー追加
    db.add(TeamMember(team_id=team.id, user_id=me, role="owner"))
    db.commit()
    return team


from schemas import TeamJoinByCode

@app.post("/teams/join")
def join_team_by_code(
    body: TeamJoinByCode,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    code = body.invite_code.strip()
    if not code:
        raise HTTPException(status_code=400, detail="invite_code is required")

    team = db.query(Team).filter(Team.invite_code == code).first()
    if not team:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    exists = db.query(TeamMember).filter(
        TeamMember.team_id == team.id,
        TeamMember.user_id == current_user.id
    ).first()
    if exists:
        return {"ok": True, "team_id": team.id}

    db.add(TeamMember(team_id=team.id, user_id=current_user.id, role="member"))
    db.commit()
    return {"ok": True, "team_id": team.id}

import secrets

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
import models, schemas
from db import get_db
from auth import get_current_user  # あなたの実装に合わせて（JWTのユーザ取得）

@app.post("/teams/join_by_code", response_model=schemas.TeamJoinResult)
def join_team_by_code(
    body: schemas.TeamJoinByCode,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    team = db.query(models.Team).filter(models.Team.invite_code == body.invite_code).first()
    if not team:
        raise HTTPException(status_code=404, detail="招待コードが間違っています。")

    exists = db.query(models.TeamMember).filter(
        models.TeamMember.team_id == team.id,
        models.TeamMember.user_id == user.id
    ).first()
    if exists:
        return schemas.TeamJoinResult(team_id=team.id)

    tm = models.TeamMember(team_id=team.id, user_id=user.id, role="member")
    db.add(tm)
    db.commit()
    return schemas.TeamJoinResult(team_id=team.id)


@app.post("/teams/{team_id}/invite/rotate")
def rotate_invite_code(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if team.owner_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can rotate")

    team.invite_code = secrets.token_urlsafe(12)
    db.commit()
    db.refresh(team)
    return {"ok": True, "invite_code": team.invite_code}



from sqlalchemy import func

@app.get("/teams/{team_id}/series")
def team_series(
    team_id: int,
    metric: str = "level",     # level / weight / fat など
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # チーム存在チェック
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # 自分がそのチームのメンバーか確認（覗き見防止）
    me_member = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == current_user.id
    ).first()
    if not me_member:
        raise HTTPException(status_code=403, detail="Not a team member")

    # メンバー取得
    members = (
        db.query(User.id, User.username)
        .join(TeamMember, TeamMember.user_id == User.id)
        .filter(TeamMember.team_id == team_id)
        .all()
    )

    # metric の安全チェック（SQLインジェクション防止）
    allowed = {"level": Measurement.level, "weight": Measurement.weight, "fat": Measurement.fat}
    if metric not in allowed:
        raise HTTPException(status_code=400, detail="Invalid metric")
    col = allowed[metric]

    # メンバーごとの時系列を作る
    series = []
    for uid, uname in members:
        rows = (
            db.query(Measurement.created_at, col)
            .filter(Measurement.user_id == uid)
            .order_by(Measurement.created_at.asc())
            .all()
        )
        series.append({
            "user_id": uid,
            "username": uname,
            "points": [
                {"t": dt.isoformat(), "v": float(val) if val is not None else None}
                for dt, val in rows
            ]
        })

    return {
        "team_id": team_id,
        "metric": metric,
        "series": series
    }

from sqlalchemy import func

def team_series(
    team_id: int,
    metric: str = "level",  # level / weight / fat
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # チーム存在
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # 自分がメンバーか（覗き見防止）
    me_member = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == current_user.id
    ).first()
    if not me_member:
        raise HTTPException(status_code=403, detail="Not a team member")

    # metric の安全チェック
    allowed = {
        "level": Measurement.level,
        "weight": Measurement.weight,
        "fat": Measurement.fat,
    }
    if metric not in allowed:
        raise HTTPException(status_code=400, detail="Invalid metric")
    col = allowed[metric]

    # チームメンバー（ユーザー名含む）
    members = (
        db.query(User.id, User.username)
        .join(TeamMember, TeamMember.user_id == User.id)
        .filter(TeamMember.team_id == team_id)
        .all()
    )

    series = []
    for uid, uname in members:
        rows = (
            db.query(Measurement.created_at, col)
            .filter(Measurement.user_id == uid)
            .order_by(Measurement.created_at.asc())
            .all()
        )
        series.append({
            "user_id": uid,
            "username": uname,
            "points": [{"t": dt.isoformat(), "v": float(val) if val is not None else None} for dt, val in rows]
        })

    return {"team_id": team_id, "metric": metric, "series": series}



from fastapi import HTTPException
from datetime import date
from sqlalchemy import and_

from models import Exercise, LiftLog
from schemas import ExerciseCreate, ExerciseOut, LiftCreate, LiftOut, LiftSeriesOut, SeriesPoint

def epley_1rm(weight: float, reps: int) -> float:
    reps = max(1, reps)
    return weight * (1 + reps / 30.0)

# --------------------
# Exercise APIs
# --------------------
@app.get("/exercises", response_model=list[ExerciseOut])
def list_exercises(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # とりあえず全件（後で “共通種目 + 自分作成” にしたければここを調整）
    return db.query(Exercise).order_by(Exercise.id.asc()).all()


@app.post("/exercises", response_model=ExerciseOut)
def create_exercise(
    body: ExerciseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    exist = db.query(Exercise).filter(Exercise.name == name).first()
    if exist:
        return exist

    ex = Exercise(name=name, created_by=current_user.id)
    db.add(ex)
    db.commit()
    db.refresh(ex)
    return ex

# --------------------
# Lift APIs
# --------------------
@app.post("/lifts", response_model=LiftOut)
def create_lift(
    body: LiftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 種目存在チェック
    ex = db.query(Exercise).filter(Exercise.id == body.exercise_id).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found")

    if body.weight_kg <= 0:
        raise HTTPException(status_code=400, detail="weight_kg must be > 0")
    if body.reps <= 0:
        raise HTTPException(status_code=400, detail="reps must be > 0")

    log = LiftLog(
        user_id=current_user.id,
        exercise_id=body.exercise_id,
        performed_at=body.performed_at,
        weight_kg=body.weight_kg,
        reps=body.reps,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

@app.get("/lifts/series", response_model=LiftSeriesOut)
def lift_series(
    exercise_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ex = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found")

    logs = (
        db.query(LiftLog)
        .filter(
            LiftLog.user_id == current_user.id,
            LiftLog.exercise_id == exercise_id
        )
        .order_by(LiftLog.performed_at.asc(), LiftLog.id.asc())
        .all()
    )

    from collections import defaultdict
    best_by_day = defaultdict(float)

    for log in logs:
        v = epley_1rm(log.weight_kg, log.reps)
        if v > best_by_day[log.performed_at]:
            best_by_day[log.performed_at] = v

    series = [
        SeriesPoint(t=day, v=round(val, 1))
        for day, val in sorted(best_by_day.items())
    ]

    return LiftSeriesOut(
        exercise_id=exercise_id,
        exercise_name=ex.name,
        series=series
    )


from collections import defaultdict


@app.post("/workouts", response_model=WorkoutSessionOut)
def create_workout(
    body: WorkoutSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = WorkoutSession(
        user_id=current_user.id,
        performed_at=body.performed_at,
        note=body.note,
    )
    db.add(session)
    db.flush()  # session.id を先に作る

    for s in body.sets:
        db.add(WorkoutSet(
            session_id=session.id,
            exercise_id=s.exercise_id,
            set_no=s.set_no,
            weight_kg=s.weight_kg,
            reps=s.reps,
        ))

    db.commit()
    db.refresh(session)
    return session

@app.get("/workouts", response_model=list[WorkoutSessionOut])
def list_my_workouts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(WorkoutSession)
        .filter(WorkoutSession.user_id == current_user.id)
        .order_by(WorkoutSession.performed_at.desc())
        .all()
    )


def is_friend(db: Session, me: int, other: int) -> bool:
    a, b = sorted([me, other])
    return db.query(Friendship).filter(
        Friendship.user_id == a,
        Friendship.friend_user_id == b
    ).first() is not None


@app.get("/users/{user_id}/workouts", response_model=list[WorkoutSessionOut])
def list_friend_workouts(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not is_friend(db, current_user.id, user_id):
        raise HTTPException(status_code=403, detail="Not friends")

    return (
        db.query(WorkoutSession)
        .filter(WorkoutSession.user_id == user_id)
        .order_by(WorkoutSession.performed_at.desc())
        .all()
    )




