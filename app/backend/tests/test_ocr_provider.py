import asyncio
import json

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.main import extract_match_ocr, get_ocr_provider_status
from app.models import Match, Tournament
from app.ocr_provider import (
    OCR_IMAGE_MAX_BYTES,
    OcrExtractionContext,
    OcrExtractionResult,
    OcrProviderResponseError,
    OcrProviderTimeoutError,
    OpenAIOcrProvider,
    get_ocr_provider,
    validate_image_upload,
)


PNG_BYTES = b"\x89PNG\r\n\x1a\nsynthetic"
JPEG_BYTES = b"\xff\xd8\xff\xe0synthetic"
WEBP_BYTES = b"RIFF\x04\x00\x00\x00WEBPsynthetic"


class SyntheticProvider:
    name = "synthetic"
    model = "fixture-v0"

    def __init__(self, *, configured=True, result=None, error=None):
        self.configured = configured
        self.result = result
        self.error = error
        self.received = None

    async def extract(self, image_bytes, mime_type, context):
        self.received = (image_bytes, mime_type, context)
        if self.error:
            raise self.error
        return self.result or OcrExtractionResult(
            provider=self.name,
            model=self.model,
            confidence=0.91,
            warnings=[],
            rows=[],
        )


class SyntheticRequest:
    def __init__(self, data, mime):
        self.data = data
        self.headers = {
            "content-type": mime,
            "content-length": str(len(data)),
        }

    async def stream(self):
        yield self.data


@pytest.fixture()
def api_context():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    tournament = Tournament(
        name="OCR Test",
        game="Warzone",
        status="active",
        format="battle_royale_points",
        team_size=3,
        scoring_profile="wsow_like",
    )
    session.add(tournament)
    session.flush()
    match = Match(round=2, tournament_id=tournament.id)
    session.add(match)
    session.commit()
    session.refresh(tournament)
    session.refresh(match)

    try:
        yield session, tournament, match
    finally:
        session.close()


def extract(db, provider, tournament_id, match_id, *, data=PNG_BYTES, mime="image/png", name="shot.png"):
    return asyncio.run(
        extract_match_ocr(
            tournament_id=tournament_id,
            match_id=match_id,
            request=SyntheticRequest(data, mime),
            filename=name,
            db=db,
            provider=provider,
        )
    )


def test_provider_unavailable_keeps_safe_fallback(api_context):
    db, tournament, match = api_context
    with pytest.raises(HTTPException) as exc:
        extract(db, SyntheticProvider(configured=False), tournament.id, match.id)
    assert exc.value.status_code == 503
    assert "Manual o CSV/TXT" in exc.value.detail


def test_openai_provider_is_unavailable_without_backend_credential(monkeypatch):
    monkeypatch.setenv("OCR_PROVIDER", "openai")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    provider = get_ocr_provider()
    assert provider.name == "openai"
    assert provider.configured is False


def test_configured_model_name_is_exposed_without_remote_verification(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OCR_OPENAI_MODEL", "gpt-5-fixture")
    provider = get_ocr_provider()
    status = get_ocr_provider_status(provider)
    assert status == {
        "provider": "openai",
        "model": "gpt-5-fixture",
        "configured": True,
        "remote_verified": False,
    }


def test_missing_model_configuration_uses_gpt_5_default(monkeypatch):
    monkeypatch.delenv("OCR_OPENAI_MODEL", raising=False)
    provider = OpenAIOcrProvider(api_key="test-key")
    assert provider.model == "gpt-5"


def test_invalid_mime_is_rejected_before_provider(api_context):
    db, tournament, match = api_context
    provider = SyntheticProvider()
    with pytest.raises(HTTPException) as exc:
        extract(db, provider, tournament.id, match.id, mime="application/pdf", name="shot.pdf")
    assert exc.value.status_code == 400
    assert provider.received is None


def test_fake_png_payload_is_rejected(api_context):
    db, tournament, match = api_context
    with pytest.raises(HTTPException) as exc:
        extract(
            db,
            SyntheticProvider(),
            tournament.id,
            match.id,
            data=b"not-a-real-png",
        )
    assert exc.value.status_code == 400
    assert "no coincide" in exc.value.detail


@pytest.mark.parametrize(
    ("filename", "mime_type", "image_bytes"),
    [
        ("shot.png", "image/png", PNG_BYTES),
        ("shot.jpg", "image/jpeg", JPEG_BYTES),
        ("shot.webp", "image/webp", WEBP_BYTES),
    ],
)
def test_supported_image_signatures_are_accepted(filename, mime_type, image_bytes):
    validate_image_upload(filename, mime_type, image_bytes)


def test_mime_signature_mismatch_is_rejected(api_context):
    db, tournament, match = api_context
    with pytest.raises(HTTPException) as exc:
        extract(
            db,
            SyntheticProvider(),
            tournament.id,
            match.id,
            data=PNG_BYTES,
            mime="image/jpeg",
            name="shot.jpg",
        )
    assert exc.value.status_code == 400
    assert "no coincide" in exc.value.detail


def test_file_too_large_is_rejected_without_persistence(api_context):
    db, tournament, match = api_context
    provider = SyntheticProvider()
    with pytest.raises(HTTPException) as exc:
        extract(
            db,
            provider,
            tournament.id,
            match.id,
            data=b"x" * (OCR_IMAGE_MAX_BYTES + 1),
        )
    assert exc.value.status_code == 413
    assert provider.received is None


def test_uploaded_image_is_not_persisted(api_context, tmp_path, monkeypatch):
    db, tournament, match = api_context
    monkeypatch.chdir(tmp_path)
    provider = SyntheticProvider()
    extract(db, provider, tournament.id, match.id)
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize(
    ("error", "expected_status"),
    [
        (OcrProviderTimeoutError("timeout"), 504),
        (OcrProviderResponseError("malformed"), 502),
    ],
)
def test_provider_errors_have_clear_mapping(api_context, error, expected_status):
    db, tournament, match = api_context
    with pytest.raises(HTTPException) as exc:
        extract(db, SyntheticProvider(error=error), tournament.id, match.id)
    assert exc.value.status_code == expected_status
    assert exc.value.detail == str(error)


def test_valid_structured_extraction_with_player_stats(api_context):
    db, tournament, match = api_context
    result = OcrExtractionResult(
        provider="synthetic",
        model="fixture-v0",
        confidence=0.88,
        warnings=["review_scoreboard_crop"],
        raw_text="VISIBLE SCOREBOARD TEXT",
        rows=[
            {
                "raw_team_name": "Amon Reapers",
                "kills": 15,
                "placement": 2,
                "player_stats": [
                    {
                        "player_name": "VITO",
                        "kills": 8,
                        "damage": 3200,
                        "assists": 2,
                        "redeploys": 1,
                    }
                ],
                "confidence": 0.93,
                "warnings": [],
            }
        ],
    )
    provider = SyntheticProvider(result=result)
    response = extract(db, provider, tournament.id, match.id)
    payload = response.model_dump()
    assert payload["rows"][0]["raw_team_name"] == "Amon Reapers"
    assert payload["rows"][0]["player_stats"][0]["damage"] == 3200
    assert provider.received[0] == PNG_BYTES
    assert provider.received[2].match_id == match.id


def test_partial_extraction_preserves_missing_placement(api_context):
    db, tournament, match = api_context
    response = extract(
        db,
        SyntheticProvider(
            result=OcrExtractionResult(
                provider="synthetic",
                model="fixture-v0",
                confidence=0.55,
                warnings=["missing_placement"],
                rows=[
                    {
                        "raw_team_name": None,
                        "kills": 4,
                        "placement": None,
                        "confidence": 0.55,
                        "warnings": ["missing_team_name", "missing_placement"],
                    }
                ],
            )
        ),
        tournament.id,
        match.id,
    )
    assert response.rows[0].raw_team_name is None
    assert response.rows[0].placement is None


def test_stale_tournament_match_context_is_rejected(api_context):
    db, tournament, match = api_context
    with pytest.raises(HTTPException) as exc:
        extract(db, SyntheticProvider(), tournament.id, match.id + 999)
    assert exc.value.status_code == 409


def test_openai_adapter_rejects_malformed_structured_response():
    provider = OpenAIOcrProvider(api_key="test", timeout_seconds=0.1)
    provider._post = lambda payload: {
        "output": [
            {
                "type": "message",
                "content": [{"type": "output_text", "text": '{"rows":"bad"}'}],
            }
        ]
    }
    with pytest.raises(OcrProviderResponseError):
        asyncio.run(
            provider.extract(
                PNG_BYTES,
                "image/png",
                OcrExtractionContext(1, "Test", 2, 1),
            )
        )


def test_openai_request_disables_response_storage():
    provider = OpenAIOcrProvider(api_key="test", model="gpt-5")
    payload = provider._request_payload(
        PNG_BYTES,
        "image/png",
        OcrExtractionContext(1, "Test", 2, 1),
    )
    assert payload["store"] is False


def test_openai_adapter_maps_synthetic_structured_response():
    provider = OpenAIOcrProvider(api_key="test", model="fixture-model")
    structured = {
        "confidence": 0.9,
        "warnings": [],
        "raw_text": None,
        "rows": [
            {
                "raw_team_name": "Ghost Squad",
                "kills": 7,
                "placement": 3,
                "player_stats": None,
                "confidence": 0.8,
                "warnings": [],
            }
        ],
    }
    provider._post = lambda payload: {
        "output": [
            {
                "type": "message",
                "content": [{"type": "output_text", "text": json.dumps(structured)}],
            }
        ]
    }
    result = asyncio.run(
        provider.extract(
            PNG_BYTES,
            "image/png",
            OcrExtractionContext(1, "Test", 2, 1),
        )
    )
    assert result.provider == "openai"
    assert result.model == "fixture-model"
    assert result.rows[0].placement == 3
