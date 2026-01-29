from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
import secrets

from db import Base
from sqlalchemy import Date

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)

    measurements = relationship("Measurement", back_populates="user", cascade="all, delete-orphan")

    # フレンド/チーム（便利）
    sent_friend_requests = relationship(
        "FriendRequest",
        foreign_keys="FriendRequest.from_user_id",
        cascade="all, delete-orphan",
    )
    received_friend_requests = relationship(
        "FriendRequest",
        foreign_keys="FriendRequest.to_user_id",
        cascade="all, delete-orphan",
    )


class Measurement(Base):
    __tablename__ = "measurements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    preset_id = Column(String, index=True)
    height = Column(Float)
    weight = Column(Float)
    fat = Column(Float)
    level = Column(Float)
    performed_at = Column(Date, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="measurements")


class FriendRequest(Base):
    __tablename__ = "friend_requests"

    id = Column(Integer, primary_key=True, index=True)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="pending")  # pending/accepted/rejected
    performed_at = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    from_user = relationship("User", foreign_keys=[from_user_id])
    to_user = relationship("User", foreign_keys=[to_user_id])

    __table_args__ = (
        UniqueConstraint("from_user_id", "to_user_id", name="uq_friend_request_pair"),
    )


class Friendship(Base):
    """
    友達成立後のペアを1行で保持（user_id < friend_user_id のように正規化して保存する）
    """
    __tablename__ = "friendships"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    friend_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])
    friend = relationship("User", foreign_keys=[friend_user_id])

    __table_args__ = (
        UniqueConstraint("user_id", "friend_user_id", name="uq_friendship_pair"),
    )

import secrets
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from db import Base

class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    invite_code = Column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
        default=lambda: secrets.token_urlsafe(12)
    )

    owner = relationship("User", foreign_keys=[owner_user_id])
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")




class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String, default="member")  # owner/admin/member
    joined_at = Column(DateTime, default=datetime.utcnow)

    team = relationship("Team", back_populates="members")
    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        UniqueConstraint("team_id", "user_id", name="uq_team_member"),
    )

    from sqlalchemy import Date

class Exercise(Base):
    __tablename__ = "exercises"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class LiftLog(Base):
    __tablename__ = "lift_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)

    performed_at = Column(Date, nullable=False)
    weight_kg = Column(Float, nullable=False)
    reps = Column(Integer, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

def epley_1rm(weight: float, reps: int) -> float:
    reps = max(1, reps)
    return weight * (1 + reps / 30.0)


from sqlalchemy.orm import relationship
from datetime import datetime

class WorkoutSession(Base):
    __tablename__ = "workout_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    performed_at = Column(DateTime, nullable=False)
    note = Column(String, default="")

    sets = relationship("WorkoutSet", back_populates="session", cascade="all, delete-orphan")


class WorkoutSet(Base):
    __tablename__ = "workout_sets"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("workout_sessions.id"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)

    set_no = Column(Integer, nullable=False)
    weight_kg = Column(Float, nullable=False)
    reps = Column(Integer, nullable=False)

    session = relationship("WorkoutSession", back_populates="sets")
