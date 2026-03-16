import base64
import logging

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.schemas.ai_schemas import AudiogramData
from app.services.vision_service import (
    VisionBadRequestError,
    VisionParseError,
    VisionPayloadTooLargeError,
    VisionTimeoutError,
    VisionUpstreamError,
    parse_audiogram_image,
)


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai-parser"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png"}
MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024


@router.post(
    "/parse-audiogram",
    response_model=AudiogramData,
    status_code=status.HTTP_200_OK,
)
async def parse_audiogram(file: UploadFile = File(...)) -> AudiogramData:
    # 先做 MIME 类型校验，尽早拦截不支持的文件。
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only jpg, jpeg and png files are supported.",
        )

    try:
        contents = await file.read()
    except Exception as exc:
        logger.exception("Failed to read uploaded audiogram file")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded file: {exc}",
        ) from exc
    finally:
        await file.close()

    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    if len(contents) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image too large. Maximum allowed size is {MAX_IMAGE_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    mime_type = "image/png" if file.content_type == "image/png" else "image/jpeg"
    base64_image = f"data:{mime_type};base64,{base64.b64encode(contents).decode('utf-8')}"

    logger.info(
        "Starting OpenAI audiogram parse: filename=%s content_type=%s size_bytes=%s",
        file.filename,
        file.content_type,
        len(contents),
    )

    try:
        result = await parse_audiogram_image(base64_image)
        logger.info("Completed OpenAI audiogram parse: filename=%s", file.filename)
        return result
    except VisionPayloadTooLargeError as exc:
        logger.warning("OpenAI audiogram parse rejected oversized payload: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=str(exc),
        ) from exc
    except VisionBadRequestError as exc:
        logger.warning("OpenAI audiogram parse bad request: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except VisionTimeoutError as exc:
        logger.warning("OpenAI audiogram parse timed out: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(exc),
        ) from exc
    except VisionParseError as exc:
        logger.warning("OpenAI audiogram parse returned invalid structured output: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except VisionUpstreamError as exc:
        logger.exception("OpenAI audiogram upstream error")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error while parsing audiogram image")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error while parsing audiogram image: {exc}",
        ) from exc
