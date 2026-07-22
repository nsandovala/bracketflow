from sqlalchemy import Float, ForeignKey, Integer, String, Text, UniqueConstraint
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
    # Un resultado oficial por equipo y partida. La correccion de un reporte
    # queda para un flujo explicito futuro; este endpoint nunca sobreescribe.
    __table_args__ = (
        UniqueConstraint("match_id", "team_id", name="uq_team_results_match_team"),
    )

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
    player_stats: Mapped[list["TeamResultPlayerStat"]] = relationship(
        "TeamResultPlayerStat",
        back_populates="team_result",
        cascade="all, delete-orphan",
    )


class TeamResultPlayerStat(Base):
    """Desglose opcional de kills por player de un resultado oficial.

    Tabla separada (no columna nueva) para que las DBs existentes sigan
    funcionando: create_all agrega tablas nuevas sin migrar las viejas.
    El score del equipo se calcula SIEMPRE desde TeamResult.kills/placement;
    esto es metadata de detalle."""

    __tablename__ = "team_result_player_stats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    team_result_id: Mapped[int] = mapped_column(
        ForeignKey("team_results.id"), nullable=False, index=True
    )
    player_name: Mapped[str] = mapped_column(String, nullable=False)
    kills: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    team_result: Mapped["TeamResult"] = relationship(
        "TeamResult", back_populates="player_stats"
    )


# ---------------------------------------------------------------------------
# Identity metadata v0 (aditivo, no toca scoring ni reports)
#
# Perfiles estables de jugador y equipo, y game-handles por juego. Los torneos
# existentes siguen usando Player/Team locales al torneo. Esto es solo un
# catalogo consultable a nivel workspace para futuras superficies (Caster,
# MVP, stats historicas). NO hay FK desde Player/Team hacia estos perfiles
# todavia: el link puede hacerse en una v1 posterior sin migracion destructiva.
# ---------------------------------------------------------------------------


class PlayerProfile(Base):
    __tablename__ = "player_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    short_name: Mapped[str | None] = mapped_column(String, nullable=True)
    country: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)

    game_identities: Mapped[list["PlayerGameIdentity"]] = relationship(
        "PlayerGameIdentity",
        back_populates="player_profile",
        cascade="all, delete-orphan",
    )


class TeamProfile(Base):
    __tablename__ = "team_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    short_name: Mapped[str | None] = mapped_column(String, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    primary_color: Mapped[str | None] = mapped_column(String, nullable=True)
    secondary_color: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


class PlayerGameIdentity(Base):
    __tablename__ = "player_game_identities"
    __table_args__ = (
        UniqueConstraint(
            "player_profile_id",
            "game",
            "game_handle",
            name="uq_player_game_identity",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    player_profile_id: Mapped[int] = mapped_column(
        ForeignKey("player_profiles.id"), nullable=False, index=True
    )
    game: Mapped[str] = mapped_column(String, nullable=False)
    game_handle: Mapped[str] = mapped_column(String, nullable=False)
    game_id: Mapped[str | None] = mapped_column(String, nullable=True)
    platform: Mapped[str | None] = mapped_column(String, nullable=True)
    region: Mapped[str | None] = mapped_column(String, nullable=True)
    verified_status: Mapped[str] = mapped_column(
        String, nullable=False, default="unverified"
    )
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)

    player_profile: Mapped["PlayerProfile"] = relationship(
        "PlayerProfile", back_populates="game_identities"
    )
