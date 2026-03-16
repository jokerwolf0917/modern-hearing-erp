"""OpenAI 视觉解析服务。

运行前请确保 requirements.txt 中包含 openai 依赖，并在 .env 或系统环境变量中配置：
- OPENAI_API_KEY
- OPENAI_VISION_MODEL（可选，默认 gpt-4o）
- OPENAI_VISION_TIMEOUT_SECONDS（可选，默认 90）
- OPENAI_BASE_URL（可选，兼容 OpenAI-compatible 代理）
"""

from __future__ import annotations

import logging
import os
import time
from collections.abc import Mapping
from pathlib import Path

from openai import (
    APIConnectionError,
    APIError,
    APITimeoutError,
    AsyncOpenAI,
    BadRequestError,
    RateLimitError,
)
from pydantic import ValidationError

from app.schemas.ai_schemas import AudiogramData


logger = logging.getLogger(__name__)

ENV_PATH = Path(__file__).resolve().parents[2] / ".env"

SYSTEM_PROMPT = """你是一名专业的听力学数据提取助手。
你的任务是解析纸质听力图、验配档案或病例照片，并输出严格符合 JSON Schema 的结构化结果。
请遵守以下规则：
1. 只提取图片中能明确识别的信息，不要猜测。
2. 对 left_ear_thresholds 和 right_ear_thresholds 仅输出能明确识别的频点和整数阈值。
3. 频点键优先使用 250Hz、500Hz、1kHz、2kHz、4kHz、8kHz 这类标准写法。
4. 如果姓名或助听器型号无法可靠判断，返回 null。
5. raw_text_summary 需要对图片中的文字、表格和备注做简洁严谨的总结。
6. 必须严格返回与 Schema 一致的 JSON，不要输出额外字段。"""


class VisionServiceError(Exception):
    """AI 视觉服务基类异常。"""


class VisionTimeoutError(VisionServiceError):
    """OpenAI 接口超时。"""


class VisionPayloadTooLargeError(VisionServiceError):
    """请求图片过大。"""


class VisionBadRequestError(VisionServiceError):
    """OpenAI 请求参数或输入格式错误。"""


class VisionParseError(VisionServiceError):
    """模型返回未能通过结构化解析。"""


class VisionUpstreamError(VisionServiceError):
    """OpenAI 上游错误。"""


_client: AsyncOpenAI | None = None
_client_signature: tuple[str, str | None, float] | None = None


def _load_dotenv_value(key: str) -> str | None:
    if not ENV_PATH.exists():
        return None

    for raw_line in ENV_PATH.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        env_key, env_value = line.split("=", 1)
        if env_key.strip() == key:
            return env_value.strip().strip('"').strip("'")

    return None


def _get_setting(key: str, default: str | None = None) -> str | None:
    raw_value = os.getenv(key)
    if raw_value is not None and raw_value.strip():
        return raw_value.strip().strip('"').strip("'")

    dotenv_value = _load_dotenv_value(key)
    if dotenv_value is not None and dotenv_value.strip():
        return dotenv_value.strip().strip('"').strip("'")

    return default


def _get_float_setting(key: str, default: float) -> float:
    raw_value = _get_setting(key)
    if raw_value is None:
        return default

    try:
        return float(raw_value)
    except ValueError:
        logger.warning("Invalid float value for %s=%s, fallback to %s", key, raw_value, default)
        return default


def _get_runtime_settings() -> tuple[str, str | None, str, float]:
    api_key = _get_setting("OPENAI_API_KEY")
    if not api_key:
        raise VisionBadRequestError("OPENAI_API_KEY is not configured.")

    base_url = _get_setting("OPENAI_BASE_URL")
    model = _get_setting("OPENAI_VISION_MODEL", "gpt-4o") or "gpt-4o"
    timeout_seconds = _get_float_setting("OPENAI_VISION_TIMEOUT_SECONDS", 90.0)
    return api_key, base_url, model, timeout_seconds


def _get_client() -> tuple[AsyncOpenAI, str, float]:
    global _client
    global _client_signature

    api_key, base_url, model, timeout_seconds = _get_runtime_settings()
    signature = (api_key, base_url, timeout_seconds)

    if _client is None or _client_signature != signature:
        client_kwargs: dict[str, object] = {
            "api_key": api_key,
            "timeout": timeout_seconds,
        }
        if base_url:
            client_kwargs["base_url"] = base_url

        _client = AsyncOpenAI(**client_kwargs)
        _client_signature = signature

        logger.info(
            "Initialized OpenAI client: model=%s base_url=%s timeout_seconds=%s env_path=%s",
            model,
            base_url or "https://api.openai.com/v1",
            timeout_seconds,
            ENV_PATH,
        )

    return _client, model, timeout_seconds


def _coerce_audiogram_data(parsed: object) -> AudiogramData:
    if isinstance(parsed, AudiogramData):
        return parsed

    if isinstance(parsed, str):
        return AudiogramData.model_validate_json(parsed)

    if isinstance(parsed, Mapping):
        return AudiogramData.model_validate(parsed)

    raise VisionParseError("Unsupported parsed payload returned by OpenAI.")


async def parse_audiogram_image(base64_image: str) -> AudiogramData:
    """调用 OpenAI 视觉模型解析听力图图片并返回结构化数据。"""
    client, model, timeout_seconds = _get_client()
    started_at = time.perf_counter()

    logger.info(
        "Starting OpenAI responses.parse call: model=%s timeout_seconds=%s image_chars=%s",
        model,
        timeout_seconds,
        len(base64_image),
    )

    try:
        response = await client.responses.parse(
            model=model,
            instructions=SYSTEM_PROMPT,
            input=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": "请解析这张听力图或档案照片，并严格输出结构化 JSON。",
                        },
                        {
                            "type": "input_image",
                            "image_url": base64_image,
                            "detail": "high",
                        },
                    ],
                }
            ],
            text_format=AudiogramData,
            timeout=timeout_seconds,
        )

        parsed = response.output_parsed
        if parsed is None:
            raise VisionParseError(
                f"Structured output missing from model response: {getattr(response, 'output_text', '')}"
            )

        result = _coerce_audiogram_data(parsed)
        elapsed = time.perf_counter() - started_at
        logger.info("Completed OpenAI responses.parse call in %.2f seconds", elapsed)
        return result
    except APITimeoutError as exc:
        elapsed = time.perf_counter() - started_at
        logger.warning("OpenAI audiogram parse timed out after %.2f seconds", elapsed)
        raise VisionTimeoutError(f"OpenAI request timed out after {timeout_seconds:.0f} seconds.") from exc
    except BadRequestError as exc:
        elapsed = time.perf_counter() - started_at
        message = str(exc)
        logger.warning("OpenAI bad request while parsing audiogram after %.2f seconds: %s", elapsed, message)
        lowered = message.lower()
        if "too large" in lowered or "maximum" in lowered or ("image" in lowered and "size" in lowered):
            raise VisionPayloadTooLargeError(message) from exc
        raise VisionBadRequestError(message) from exc
    except RateLimitError as exc:
        elapsed = time.perf_counter() - started_at
        logger.warning("OpenAI rate limit while parsing audiogram after %.2f seconds", elapsed)
        raise VisionUpstreamError("OpenAI rate limit exceeded.") from exc
    except APIConnectionError as exc:
        elapsed = time.perf_counter() - started_at
        logger.exception("Failed to connect to OpenAI while parsing audiogram after %.2f seconds", elapsed)
        raise VisionUpstreamError("Failed to connect to OpenAI.") from exc
    except APIError as exc:
        elapsed = time.perf_counter() - started_at
        logger.exception("OpenAI API error while parsing audiogram after %.2f seconds: %s", elapsed, exc)
        raise VisionUpstreamError(f"OpenAI API error: {exc}") from exc
    except ValidationError as exc:
        elapsed = time.perf_counter() - started_at
        logger.warning("OpenAI structured output validation failed after %.2f seconds: %s", elapsed, exc)
        raise VisionParseError(f"Structured output validation failed: {exc}") from exc
    except VisionServiceError:
        raise
    except Exception as exc:
        elapsed = time.perf_counter() - started_at
        logger.exception("Unexpected vision service error after %.2f seconds", elapsed)
        raise VisionUpstreamError(f"Unexpected error from vision service: {exc}") from exc
