"""Swappable, backend-only multimodal extraction providers for OCR intake."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator


logger = logging.getLogger(__name__)

OCR_IMAGE_MAX_BYTES = 8 * 1024 * 1024
OCR_IMAGE_ACCEPTED_TYPES = frozenset({"image/png", "image/jpeg", "image/webp"})
OCR_IMAGE_ACCEPTED_EXTENSIONS = frozenset({".png", ".jpg", ".jpeg", ".webp"})
OCR_IMAGE_TYPE_EXTENSIONS = {
    "image/png": frozenset({".png"}),
    "image/jpeg": frozenset({".jpg", ".jpeg"}),
    "image/webp": frozenset({".webp"}),
}


class OcrProviderUnavailableError(RuntimeError):
    pass


class OcrProviderTimeoutError(RuntimeError):
    pass


class OcrProviderResponseError(RuntimeError):
    pass


class OcrPlayerStat(BaseModel):
    model_config = ConfigDict(extra="forbid")

    player_name: str
    kills: int | None = Field(default=None, ge=0)
    damage: int | None = Field(default=None, ge=0)
    assists: int | None = Field(default=None, ge=0)
    redeploys: int | None = Field(default=None, ge=0)

    @field_validator("player_name")
    @classmethod
    def validate_player_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("player_name cannot be empty")
        return stripped


class OcrExtractionRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    raw_team_name: str | None = None
    kills: int | None = Field(default=None, ge=0)
    placement: int | None = Field(default=None, ge=1)
    player_stats: list[OcrPlayerStat] | None = None
    confidence: float = Field(ge=0, le=1)
    warnings: list[str] = Field(default_factory=list)


class OcrProviderPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confidence: float = Field(ge=0, le=1)
    warnings: list[str] = Field(default_factory=list)
    raw_text: str | None = None
    rows: list[OcrExtractionRow] = Field(default_factory=list)


class OcrExtractionResult(OcrProviderPayload):
    provider: str
    model: str


@dataclass(frozen=True)
class OcrExtractionContext:
    tournament_id: int
    tournament_name: str
    match_id: int
    match_round: int


class OcrExtractionProvider(Protocol):
    name: str
    model: str

    @property
    def configured(self) -> bool: ...

    async def extract(
        self,
        image_bytes: bytes,
        mime_type: str,
        context: OcrExtractionContext,
    ) -> OcrExtractionResult: ...


def validate_image_upload(filename: str, mime_type: str, image_bytes: bytes) -> None:
    extension = Path(filename).suffix.lower()
    if mime_type not in OCR_IMAGE_ACCEPTED_TYPES or extension not in OCR_IMAGE_ACCEPTED_EXTENSIONS:
        raise ValueError("Formato no compatible. Usa PNG, JPG/JPEG o WEBP.")
    if not image_bytes:
        raise ValueError("El archivo está vacío o no se pudo leer.")
    if len(image_bytes) > OCR_IMAGE_MAX_BYTES:
        raise OverflowError("La imagen supera el máximo permitido (8 MB).")
    detected_type = None
    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        detected_type = "image/png"
    elif image_bytes.startswith(b"\xff\xd8\xff"):
        detected_type = "image/jpeg"
    elif (
        len(image_bytes) >= 12
        and image_bytes.startswith(b"RIFF")
        and image_bytes[8:12] == b"WEBP"
    ):
        detected_type = "image/webp"
    if (
        detected_type is None
        or detected_type != mime_type
        or extension not in OCR_IMAGE_TYPE_EXTENSIONS[detected_type]
    ):
        raise ValueError(
            "El contenido de la imagen no coincide con el MIME o la extensión declarados."
        )


class UnavailableOcrProvider:
    name = "unavailable"
    model = "none"
    configured = False

    async def extract(
        self,
        image_bytes: bytes,
        mime_type: str,
        context: OcrExtractionContext,
    ) -> OcrExtractionResult:
        raise OcrProviderUnavailableError(
            "El motor de OCR todavía no está disponible. Usa Manual o CSV/TXT mientras tanto."
        )


OPENAI_PAYLOAD_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "warnings": {"type": "array", "items": {"type": "string"}},
        "raw_text": {"type": ["string", "null"]},
        "rows": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "raw_team_name": {"type": ["string", "null"]},
                    "kills": {"type": ["integer", "null"], "minimum": 0},
                    "placement": {"type": ["integer", "null"], "minimum": 1},
                    "player_stats": {
                        "type": ["array", "null"],
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "player_name": {"type": "string"},
                                "kills": {"type": ["integer", "null"], "minimum": 0},
                                "damage": {"type": ["integer", "null"], "minimum": 0},
                                "assists": {"type": ["integer", "null"], "minimum": 0},
                                "redeploys": {"type": ["integer", "null"], "minimum": 0},
                            },
                            "required": [
                                "player_name",
                                "kills",
                                "damage",
                                "assists",
                                "redeploys",
                            ],
                        },
                    },
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                    "warnings": {"type": "array", "items": {"type": "string"}},
                },
                "required": [
                    "raw_team_name",
                    "kills",
                    "placement",
                    "player_stats",
                    "confidence",
                    "warnings",
                ],
            },
        },
    },
    "required": ["confidence", "warnings", "raw_text", "rows"],
}


class OpenAIOcrProvider:
    name = "openai"

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str | None = None,
        timeout_seconds: float | None = None,
        api_url: str | None = None,
    ) -> None:
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        configured_model = model or os.getenv("OCR_OPENAI_MODEL", "")
        self.model = configured_model.strip() or "gpt-5"
        self.timeout_seconds = timeout_seconds or float(
            os.getenv("OCR_PROVIDER_TIMEOUT_SECONDS", "30")
        )
        self.api_url = api_url or os.getenv(
            "OPENAI_API_BASE_URL", "https://api.openai.com/v1"
        ).rstrip("/")

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def _request_payload(
        self,
        image_bytes: bytes,
        mime_type: str,
        context: OcrExtractionContext,
    ) -> dict:
        image_url = (
            f"data:{mime_type};base64,"
            f"{base64.b64encode(image_bytes).decode('ascii')}"
        )
        prompt = (
            "Extract only scoreboard values visibly present in this screenshot. "
            "Do not infer team identity from logos, colors, roster knowledge, tournament "
            "context, or visual appearance. Preserve missing team names and placements "
            "as null. Include a player stat only when the player name is visible. Keep "
            "any unreadable numeric field null and add a concise warning. Flag ambiguous "
            "digits as uncertain_digit:<field>. This request is scoped only to "
            f"tournament {context.tournament_id} ({context.tournament_name}), match "
            f"{context.match_id}, round {context.match_round}; context is not evidence "
            "for values."
        )
        return {
            "model": self.model,
            "store": False,
            "input": [
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": prompt},
                        {"type": "input_image", "image_url": image_url, "detail": "high"},
                    ],
                }
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "bracketflow_ocr_extraction",
                    "strict": True,
                    "schema": OPENAI_PAYLOAD_SCHEMA,
                }
            },
            "reasoning": {"effort": "low"},
            "max_output_tokens": 5000,
        }

    def _post(self, payload: dict) -> dict:
        request = Request(
            f"{self.api_url}/responses",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8"))
        except TimeoutError as error:
            raise OcrProviderTimeoutError("El proveedor OCR agotó el tiempo de espera.") from error
        except HTTPError as error:
            raise OcrProviderResponseError(
                f"El proveedor OCR respondió con HTTP {error.code}."
            ) from error
        except (URLError, json.JSONDecodeError) as error:
            raise OcrProviderResponseError(
                "No se pudo obtener una respuesta válida del proveedor OCR."
            ) from error

    @staticmethod
    def _extract_output_text(response: dict) -> str:
        for item in response.get("output", []):
            if item.get("type") != "message":
                continue
            for content in item.get("content", []):
                if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                    return content["text"]
        raise OcrProviderResponseError("El proveedor OCR no devolvió extracción estructurada.")

    async def extract(
        self,
        image_bytes: bytes,
        mime_type: str,
        context: OcrExtractionContext,
    ) -> OcrExtractionResult:
        if not self.configured:
            raise OcrProviderUnavailableError(
                "El motor de OCR todavía no está disponible. Usa Manual o CSV/TXT mientras tanto."
            )
        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(self._post, self._request_payload(image_bytes, mime_type, context)),
                timeout=self.timeout_seconds + 1,
            )
        except asyncio.TimeoutError as error:
            raise OcrProviderTimeoutError("El proveedor OCR agotó el tiempo de espera.") from error

        try:
            payload = OcrProviderPayload.model_validate_json(
                self._extract_output_text(response)
            )
        except (ValidationError, json.JSONDecodeError) as error:
            raise OcrProviderResponseError(
                "El proveedor OCR devolvió una respuesta con formato inválido."
            ) from error
        return OcrExtractionResult(
            provider=self.name,
            model=self.model,
            **payload.model_dump(),
        )


def get_ocr_provider() -> OcrExtractionProvider:
    provider_name = os.getenv("OCR_PROVIDER", "openai").strip().lower()
    if provider_name == "openai":
        return OpenAIOcrProvider()
    return UnavailableOcrProvider()
