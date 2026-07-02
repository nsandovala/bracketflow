from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Tournament(Base):
    __tablename__ = "tournaments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    game: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="draft")
    format: Mapped[str] = mapped_column(
        String, nullable=False, default="single_elimination"
    )
    team_size: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    scoring_profile: Mapped[str] = mapped_column(
        String, nullable=False, default="wsow_like"
    )
    roster_status: Mapped[str] = mapped_column(
        String, nullable=False, default="participants_pending"
    )
    roster_respin_deadline_at: Mapped[str | None] = mapped_column(String, nullable=True)
    roster_locked_at: Mapped[str | None] = mapped_column(String, nullable=True)
    bracket_status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    bracket_respin_deadline_at: Mapped[str | None] = mapped_column(String, nullable=True)
    bracket_locked_at: Mapped[str | None] = mapped_column(String, nullable=True)
    config: Mapped[str | None] = mapped_column(Text, nullable=True)

    teams: Mapped[list["Team"]] = relationship(
        "Team", back_populates="tournament", cascade="all, delete-orphan"
    )
    matches: Mapped[list["Match"]] = relationship(
        "Match", back_populates="tournament", cascade="all, delete-orphan"
    )
    players: Mapped[list["Player"]] = relationship(
        "Player", back_populates="tournament", cascade="all, delete-orphan"
    )
    team_results: Mapped[list["TeamResult"]] = relationship(
        "TeamResult", back_populates="tournament", cascade="all, delete-orphan"
    )


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nickname: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    activision_id: Mapped[str | None] = mapped_column(String, nullable=True)
    tournament_id: Mapped[int] = mapped_column(
        ForeignKey("tournaments.id"), nullable=False, index=True
    )

    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="players")
    team_memberships: Mapped[list["TeamMember"]] = relationship(
        "TeamMember", back_populates="player", cascade="all, delete-orphan"
    )


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    tournament_id: Mapped[int] = mapped_column(
        ForeignKey("tournaments.id"), nullable=False, index=True
    )
    source: Mapped[str] = mapped_column(String, nullable=False, default="manual")

    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="teams")
    members: Mapped[list["TeamMember"]] = relationship(
        "TeamMember", back_populates="team", cascade="all, delete-orphan"
    )
    results: Mapped[list["TeamResult"]] = relationship("TeamResult", back_populates="team")


class TeamMember(Base):
    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False, index=True)
    player_id: Mapped[int] = mapped_column(
        ForeignKey("players.id"), nullable=False, index=True
    )

    team: Mapped["Team"] = relationship("Team", back_populates="members")
    player: Mapped["Player"] = relationship("Player", back_populates="team_memberships")


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    round: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    team_a_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"), nullable=True)
    team_b_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"), nullable=True)
    winner_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"), nullable=True)
    best_of: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    next_match_id: Mapped[int | None] = mapped_column(ForeignKey("matches.id"), nullable=True)
    next_slot: Mapped[str | None] = mapped_column(String, nullable=True)
    tournament_id: Mapped[int] = mapped_column(
        ForeignKey("tournaments.id"), nullable=False, index=True
    )

    tournament: Mapped["Tournament"] = relationship("Tournament", back_populates="matches")
    results: Mapped[list["TeamResult"]] = relationship(
        "TeamResult", back_populates="match", cascade="all, delete-orphan"
    )
    maps: Mapped[list["MatchMap"]] = relationship(
        "MatchMap", back_populates="match", cascade="all, delete-orphan"
    )


class MatchMap(Base):
    __tablename__ = "match_maps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), nullable=False, index=True)
    map_number: Mapped[int] = mapped_column(Integer, nullable=False)
    kills_a: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    kills_b: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    map_winner_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"), nullable=True)

    match: Mapped["Match"] = relationship("Match", back_populates="maps")


class TeamResult(Base):
    __tablename__ = "team_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tournament_id: Mapped[int] = mapped_column(
        ForeignKey("tournaments.id"), nullable=False, index=True
    )
    match_id: Mapped[int] = mapped_column(
        ForeignKey("matches.id"), nullable=False, index=True
    )
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"), nullable=False, index=True)
    kills: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    placement: Mapped[int] = mapped_column(Integer, nullable=False)
    kill_points: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    placement_points: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    total_points: Mapped[float] = mapped_column(Float, nullable=False, default=0)

    tournament: Mapped["Tournament"] = relationship(
        "Tournament", back_populates="team_results"
    )
    match: Mapped["Match"] = relationship("Match", back_populates="results")
    team: Mapped["Team"] = relationship("Team", back_populates="results")
