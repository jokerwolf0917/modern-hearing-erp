import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Audiogram, Customer
from app.schemas.audiogram import AudiogramCreate, AudiogramRead


router = APIRouter(prefix="/api/customers", tags=["audiograms"])


async def _ensure_customer_exists(session: AsyncSession, customer_id: uuid.UUID) -> Customer:
    customer = await session.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return customer


@router.post("/{customer_id}/audiograms", response_model=AudiogramRead, status_code=status.HTTP_201_CREATED)
async def create_audiogram(
    customer_id: uuid.UUID,
    payload: AudiogramCreate,
    session: AsyncSession = Depends(get_db),
) -> AudiogramRead:
    try:
        await _ensure_customer_exists(session, customer_id)

        audiogram = Audiogram(
            customer_id=customer_id,
            test_date=payload.test_date,
            left_ear_data=payload.left_ear_data,
            right_ear_data=payload.right_ear_data,
            notes=payload.notes,
        )
        session.add(audiogram)
        await session.commit()
        await session.refresh(audiogram)

        return AudiogramRead(
            id=audiogram.id,
            customer_id=audiogram.customer_id,
            test_date=audiogram.test_date,
            left_ear_data=audiogram.left_ear_data,
            right_ear_data=audiogram.right_ear_data,
            notes=audiogram.notes,
            created_at=audiogram.created_at,
        )
    except HTTPException:
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while creating audiogram record.",
        )


@router.get("/{customer_id}/audiograms", response_model=list[AudiogramRead], status_code=status.HTTP_200_OK)
async def list_audiograms(
    customer_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
) -> list[AudiogramRead]:
    try:
        await _ensure_customer_exists(session, customer_id)

        result = await session.execute(
            select(Audiogram)
            .where(Audiogram.customer_id == customer_id)
            .order_by(Audiogram.test_date.desc(), Audiogram.created_at.desc())
        )
        audiograms = result.scalars().all()

        return [
            AudiogramRead(
                id=audiogram.id,
                customer_id=audiogram.customer_id,
                test_date=audiogram.test_date,
                left_ear_data=audiogram.left_ear_data,
                right_ear_data=audiogram.right_ear_data,
                notes=audiogram.notes,
                created_at=audiogram.created_at,
            )
            for audiogram in audiograms
        ]
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while loading audiogram records.",
        )
