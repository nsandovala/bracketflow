"""Cubre la capa de identidad aditiva v0.

Los perfiles de jugador/equipo y los game handles viven junto al scoring, pero
no lo tocan. Los tests aseguran:
  - CRUD basico (create/list) para player_profiles, team_profiles y game_identities
  - FK obligatoria: game identity requiere un player_profile existente
  - La metadata opcional no rompe el flujo de scoring de un torneo real
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import crud, schemas
from app.database import Base
from app.main import (
    create_identity_game_identity,
    create_identity_player,
    create_identity_team,
    list_identity_game_identities,
    list_identity_players,
    list_identity_teams,
)


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


# ---------------------------------------------------------------------------
# CRUD directo
# ---------------------------------------------------------------------------


def test_create_and_list_player_profile(db_session):
    profile = crud.create_player_profile(
        db_session,
        schemas.PlayerProfileCreate(
            display_name="NeonWolf",
            short_name="NEO",
            country="AR",
            avatar_url="https://example.com/neo.png",
            notes="favorito del caster",
        ),
    )

    assert profile.id > 0
    assert profile.display_name == "NeonWolf"
    assert profile.short_name == "NEO"
    assert profile.created_at
    assert profile.updated_at == profile.created_at

    listing = crud.list_player_profiles(db_session)
    assert [p.id for p in listing] == [profile.id]


def test_create_and_list_team_profile(db_session):
    profile = crud.create_team_profile(
        db_session,
        schemas.TeamProfileCreate(
            display_name="Gedeon Esport",
            short_name="GED",
            logo_url="https://example.com/gedeon.png",
            primary_color="#0f0",
            secondary_color="#111",
        ),
    )

    assert profile.id > 0
    assert profile.display_name == "Gedeon Esport"
    assert profile.short_name == "GED"

    listing = crud.list_team_profiles(db_session)
    assert [p.display_name for p in listing] == ["Gedeon Esport"]


def test_create_and_list_game_identity_requires_existing_profile(db_session):
    with pytest.raises(ValueError):
        crud.create_player_game_identity(
            db_session,
            schemas.PlayerGameIdentityCreate(
                player_profile_id=9999,
                game="Warzone",
                game_handle="neonwolf#1234",
            ),
        )

    profile = crud.create_player_profile(
        db_session, schemas.PlayerProfileCreate(display_name="NeonWolf")
    )
    identity = crud.create_player_game_identity(
        db_session,
        schemas.PlayerGameIdentityCreate(
            player_profile_id=profile.id,
            game="Warzone",
            game_handle="neonwolf#1234",
            platform="PC",
            region="LATAM",
        ),
    )
    assert identity.id > 0
    assert identity.verified_status == "unverified"

    listing = crud.list_player_game_identities(db_session)
    assert [i.game_handle for i in listing] == ["neonwolf#1234"]

    filtered = crud.list_player_game_identities(db_session, player_profile_id=profile.id)
    assert [i.id for i in filtered] == [identity.id]

    empty = crud.list_player_game_identities(db_session, player_profile_id=profile.id + 999)
    assert empty == []


def test_duplicate_game_identity_is_rejected(db_session):
    profile = crud.create_player_profile(
        db_session, schemas.PlayerProfileCreate(display_name="NeonWolf")
    )
    crud.create_player_game_identity(
        db_session,
        schemas.PlayerGameIdentityCreate(
            player_profile_id=profile.id,
            game="Warzone",
            game_handle="neonwolf#1234",
        ),
    )
    with pytest.raises(ValueError):
        crud.create_player_game_identity(
            db_session,
            schemas.PlayerGameIdentityCreate(
                player_profile_id=profile.id,
                game="Warzone",
                game_handle="neonwolf#1234",
            ),
        )


def test_short_display_name_is_rejected():
    with pytest.raises(ValueError):
        schemas.PlayerProfileCreate(display_name="A")


# ---------------------------------------------------------------------------
# FastAPI route handlers (llamados como funciones para no arrastrar TestClient)
# ---------------------------------------------------------------------------


def test_route_handlers_create_and_list_player_and_team(db_session):
    created_player = create_identity_player(
        payload=schemas.PlayerProfileCreate(display_name="RouteWolf"),
        db=db_session,
    )
    created_team = create_identity_team(
        payload=schemas.TeamProfileCreate(display_name="Route Squad"),
        db=db_session,
    )

    assert created_player.display_name == "RouteWolf"
    assert created_team.display_name == "Route Squad"

    assert [p.display_name for p in list_identity_players(db=db_session)] == ["RouteWolf"]
    assert [t.display_name for t in list_identity_teams(db=db_session)] == ["Route Squad"]


def test_route_game_identity_returns_404_for_missing_profile(db_session):
    with pytest.raises(HTTPException) as excinfo:
        create_identity_game_identity(
            payload=schemas.PlayerGameIdentityCreate(
                player_profile_id=9999,
                game="Warzone",
                game_handle="ghost#0001",
            ),
            db=db_session,
        )
    assert excinfo.value.status_code == 404


def test_route_game_identity_created_and_filterable(db_session):
    profile = create_identity_player(
        payload=schemas.PlayerProfileCreate(display_name="RouteWolf"),
        db=db_session,
    )
    identity = create_identity_game_identity(
        payload=schemas.PlayerGameIdentityCreate(
            player_profile_id=profile.id,
            game="Warzone",
            game_handle="routewolf#0001",
        ),
        db=db_session,
    )
    assert identity.player_profile_id == profile.id

    all_identities = list_identity_game_identities(db=db_session)
    assert [i.id for i in all_identities] == [identity.id]

    filtered = list_identity_game_identities(
        player_profile_id=profile.id, db=db_session
    )
    assert [i.id for i in filtered] == [identity.id]


# ---------------------------------------------------------------------------
# Aislamiento del scoring — la metadata no altera calculos ni el shape del
# leaderboard existente aunque haya perfiles cargados en la misma DB.
# ---------------------------------------------------------------------------


def test_identity_metadata_does_not_affect_scoring(db_session):
    # Setup identidad
    crud.create_player_profile(
        db_session, schemas.PlayerProfileCreate(display_name="NeonWolf")
    )
    crud.create_team_profile(
        db_session, schemas.TeamProfileCreate(display_name="Neon Team")
    )

    # Torneo real WSOW-like con dos equipos
    tournament = crud.create_tournament(
        db_session,
        schemas.TournamentCreate(
            name="Identity Isolation",
            game="Warzone",
            format="battle_royale_points",
            team_size=3,
            scoring_profile="wsow_like",
        ),
    )
    team_a = crud.create_team(db_session, tournament.id, schemas.TeamCreate(name="A"))
    team_b = crud.create_team(db_session, tournament.id, schemas.TeamCreate(name="B"))

    match = crud.create_battle_royale_match(
        db_session, tournament, schemas.MatchCreate(round=1)
    )
    crud.create_team_result(
        db_session,
        tournament,
        match,
        schemas.TeamResultUpsert(team_id=team_a.id, kills=10, placement=1),
    )
    crud.create_team_result(
        db_session,
        tournament,
        match,
        schemas.TeamResultUpsert(team_id=team_b.id, kills=6, placement=2),
    )

    leaderboard = crud.get_leaderboard(db_session, tournament)
    # Shape del leaderboard no debe verse afectado por la existencia de perfiles
    assert [entry.team_id for entry in leaderboard] == [team_a.id, team_b.id]
    assert leaderboard[0].kills == 10
    assert leaderboard[0].total_points == pytest.approx(20.0)
    assert leaderboard[1].kills == 6
    assert leaderboard[1].total_points == pytest.approx(10.8)
