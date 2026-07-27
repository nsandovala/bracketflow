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
from pydantic import ValidationError
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
    update_identity_player,
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


def test_player_without_broadcast_profile_remains_valid(db_session):
    profile = crud.create_player_profile(
        db_session,
        schemas.PlayerProfileCreate(display_name="LegacyPlayer"),
    )

    serialized = schemas.PlayerProfile.model_validate(profile)
    assert serialized.display_name == "LegacyPlayer"
    assert serialized.declared_kd is None
    assert serialized.role is None
    assert serialized.short_bio is None
    assert serialized.broadcast_notes is None


def test_create_and_update_broadcast_profile(db_session):
    profile = crud.create_player_profile(
        db_session,
        schemas.PlayerProfileCreate(
            display_name="NeonWolf",
            country="CL",
            role="flex",
            declared_kd=2.45,
            declared_platform="pc",
            preferred_input="controller",
            short_bio="Jugador competitivo de Warzone.",
            social_handle="@neonwolf",
            avatar_url="https://example.com/neonwolf.png",
            broadcast_notes="Suele liderar las rotaciones.",
        ),
    )

    assert profile.declared_kd == pytest.approx(2.45)
    assert profile.role == "flex"
    assert profile.preferred_input == "controller"

    updated = crud.update_player_profile(
        db_session,
        profile,
        schemas.PlayerProfileUpdate(
            declared_kd=2.6,
            role="igl",
            broadcast_notes="Capitán y principal shot caller.",
        ),
    )
    assert updated.declared_kd == pytest.approx(2.6)
    assert updated.role == "igl"
    assert updated.broadcast_notes == "Capitán y principal shot caller."


def test_partial_broadcast_profile_update_preserves_omitted_fields(db_session):
    profile = crud.create_player_profile(
        db_session,
        schemas.PlayerProfileCreate(
            display_name="PartialPlayer",
            role="slayer",
            declared_kd=1.9,
            declared_platform="console",
            preferred_input="controller",
        ),
    )

    updated = crud.update_player_profile(
        db_session,
        profile,
        schemas.PlayerProfileUpdate(short_bio="Perfil actualizado parcialmente."),
    )
    assert updated.short_bio == "Perfil actualizado parcialmente."
    assert updated.role == "slayer"
    assert updated.declared_kd == pytest.approx(1.9)
    assert updated.declared_platform == "console"
    assert updated.preferred_input == "controller"


def test_negative_declared_kd_is_rejected():
    with pytest.raises(ValidationError):
        schemas.PlayerProfileUpdate(declared_kd=-0.01)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("role", "sniper"),
        ("declared_platform", "mobile"),
        ("preferred_input", "touch"),
    ],
)
def test_invalid_broadcast_profile_enum_is_rejected(field, value):
    with pytest.raises(ValidationError):
        schemas.PlayerProfileUpdate(**{field: value})


def test_broadcast_profile_fields_serialize_correctly(db_session):
    profile = crud.create_player_profile(
        db_session,
        schemas.PlayerProfileCreate(
            display_name="SerializedPlayer",
            country="AR",
            role="support",
            declared_kd=1.25,
            declared_platform="console",
            preferred_input="keyboard_mouse",
            short_bio="Bio breve.",
            social_handle="@serialized",
            broadcast_notes="Contexto exclusivo para caster.",
        ),
    )

    payload = schemas.PlayerProfile.model_validate(profile).model_dump()
    assert payload["declared_kd"] == pytest.approx(1.25)
    assert payload["role"] == "support"
    assert payload["declared_platform"] == "console"
    assert payload["preferred_input"] == "keyboard_mouse"
    assert payload["short_bio"] == "Bio breve."
    assert payload["social_handle"] == "@serialized"
    assert payload["broadcast_notes"] == "Contexto exclusivo para caster."


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


def test_route_updates_broadcast_profile_and_returns_404(db_session):
    profile = create_identity_player(
        payload=schemas.PlayerProfileCreate(display_name="RouteProfile"),
        db=db_session,
    )
    updated = update_identity_player(
        profile_id=profile.id,
        payload=schemas.PlayerProfileUpdate(declared_kd=2.1, role="flex"),
        db=db_session,
    )
    assert updated.declared_kd == pytest.approx(2.1)
    assert updated.role == "flex"

    with pytest.raises(HTTPException) as excinfo:
        update_identity_player(
            profile_id=9999,
            payload=schemas.PlayerProfileUpdate(short_bio="Missing"),
            db=db_session,
        )
    assert excinfo.value.status_code == 404


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
    identity_profile = crud.create_player_profile(
        db_session,
        schemas.PlayerProfileCreate(
            display_name="NeonWolf",
            role="igl",
            declared_kd=3.2,
            preferred_input="controller",
            broadcast_notes="Metadata declarada, ajena al scoring.",
        ),
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

    crud.update_player_profile(
        db_session,
        identity_profile,
        schemas.PlayerProfileUpdate(declared_kd=9.9, role="support"),
    )
    leaderboard_after_profile_update = crud.get_leaderboard(db_session, tournament)
    assert [entry.total_points for entry in leaderboard_after_profile_update] == pytest.approx(
        [20.0, 10.8]
    )
