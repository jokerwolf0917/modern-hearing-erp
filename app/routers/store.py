from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Store
from app.schemas.store import StoreCreate, StoreRead


router = APIRouter(prefix="/api/stores", tags=["stores"])


@router.post("", response_model=StoreRead, status_code=status.HTTP_201_CREATED)
async def create_store(
    payload: StoreCreate,
    session: AsyncSession = Depends(get_db),
) -> StoreRead:
    try:
        store = Store(
            name=payload.name,
            address=payload.address,
            phone=payload.phone,
            store_type=payload.store_type,
        )
        session.add(store)
        await session.commit()
        await session.refresh(store)
        return StoreRead(
            id=store.id,
            name=store.name,
            address=store.address,
            phone=store.phone,
            store_type=store.store_type,
            created_at=store.created_at,
        )
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Store name already exists",
        )
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while creating store.",
        )


@router.get("", response_model=list[StoreRead], status_code=status.HTTP_200_OK)
async def list_stores(session: AsyncSession = Depends(get_db)) -> list[StoreRead]:
    try:
        result = await session.execute(select(Store).order_by(Store.created_at.desc(), Store.name.asc()))
        stores = result.scalars().all()
        return [
            StoreRead(
                id=store.id,
                name=store.name,
                address=store.address,
                phone=store.phone,
                store_type=store.store_type,
                created_at=store.created_at,
            )
            for store in stores
        ]
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while loading stores.",
        )
