import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Customer, Store
from app.schemas.customer import CustomerCreate, CustomerListResponse, CustomerRead


router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.post("/import", status_code=status.HTTP_200_OK)
async def import_customers(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only CSV files are supported")

    try:
        default_store = await session.scalar(select(Store).order_by(Store.created_at.asc()).limit(1))
        if default_store is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please create at least one store before importing customers.",
            )

        content = await file.read()
        text = content.decode("utf-8-sig")
        reader = csv.reader(io.StringIO(text))

        imported_count = 0
        skipped_count = 0
        customers_to_create: list[Customer] = []

        for index, row in enumerate(reader):
            if not row or not any(cell.strip() for cell in row):
                continue

            normalized = [cell.strip() for cell in row]
            if index == 0 and any(value in {"name", "姓名", "phone", "电话"} for value in normalized):
                continue

            if len(normalized) < 5:
                skipped_count += 1
                continue

            name, phone, age_raw, gender, hearing_loss_type = normalized[:5]
            if not name or not phone:
                skipped_count += 1
                continue

            try:
                age = int(age_raw)
            except ValueError:
                skipped_count += 1
                continue

            customers_to_create.append(
                Customer(
                    name=name,
                    phone=phone,
                    age=age,
                    gender=gender or None,
                    hearing_loss_type=hearing_loss_type or None,
                    primary_store_id=default_store.id,
                )
            )
            imported_count += 1

        if customers_to_create:
            session.add_all(customers_to_create)
            await session.commit()

        return {"imported_count": imported_count, "skipped_count": skipped_count}
    except UnicodeDecodeError:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV encoding must be UTF-8")
    except HTTPException:
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while importing customers.",
        )


@router.post("", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    session: AsyncSession = Depends(get_db),
) -> CustomerRead:
    try:
        default_store = await session.scalar(select(Store).order_by(Store.created_at.asc()).limit(1))
        if default_store is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please seed at least one store before creating customers.",
            )

        customer = Customer(
            name=payload.name,
            phone=payload.phone,
            age=payload.age,
            gender=payload.gender,
            hearing_loss_type=payload.hearing_loss_type,
            primary_store_id=default_store.id,
        )
        session.add(customer)
        await session.commit()
        await session.refresh(customer)

        return CustomerRead(
            id=customer.id,
            name=customer.name,
            phone=customer.phone,
            age=customer.age,
            gender=customer.gender,
            hearing_loss_type=customer.hearing_loss_type,
            created_at=customer.created_at,
        )
    except HTTPException:
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while creating customer.",
        )


@router.get("", response_model=CustomerListResponse, status_code=status.HTTP_200_OK)
async def list_customers(
    q: str | None = Query(default=None, description="Search by name or phone"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    session: AsyncSession = Depends(get_db),
) -> CustomerListResponse:
    try:
        filters = []
        if q:
            keyword = f"%{q.strip()}%"
            filters.append(or_(Customer.name.ilike(keyword), Customer.phone.ilike(keyword)))

        count_stmt = select(func.count(Customer.id))
        data_stmt = select(Customer).order_by(Customer.created_at.desc())

        if filters:
            count_stmt = count_stmt.where(*filters)
            data_stmt = data_stmt.where(*filters)

        total = await session.scalar(count_stmt)
        result = await session.execute(data_stmt.offset((page - 1) * page_size).limit(page_size))
        customers = result.scalars().all()

        items = [
            CustomerRead(
                id=customer.id,
                name=customer.name,
                phone=customer.phone,
                age=customer.age,
                gender=customer.gender,
                hearing_loss_type=customer.hearing_loss_type,
                created_at=customer.created_at,
            )
            for customer in customers
        ]

        return CustomerListResponse(
            items=items,
            total=total or 0,
            page=page,
            page_size=page_size,
        )
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while loading customers.",
        )
