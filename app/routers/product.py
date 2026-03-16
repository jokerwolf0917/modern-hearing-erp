import csv
import io
import uuid
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Product
from app.schemas.product import ProductCreate, ProductRead, ProductUpdate


router = APIRouter(prefix="/api/products", tags=["products"])


@router.post("/import", status_code=status.HTTP_200_OK)
async def import_products(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only CSV files are supported")

    try:
        content = await file.read()
        text = content.decode("utf-8-sig")
        reader = csv.reader(io.StringIO(text))

        imported_count = 0
        skipped_count = 0
        products_to_create: list[Product] = []
        existing_skus = set((await session.execute(select(Product.sku))).scalars().all())
        seen_skus = set(existing_skus)

        for index, row in enumerate(reader):
            if not row or not any(cell.strip() for cell in row):
                continue

            normalized = [cell.strip() for cell in row]
            if index == 0 and any(value in {"name", "名称", "sku", "category", "类别"} for value in normalized):
                continue

            if len(normalized) < 4:
                skipped_count += 1
                continue

            name, sku, category, retail_price_raw = normalized[:4]
            if not name or not sku or not category:
                skipped_count += 1
                continue

            if sku in seen_skus:
                skipped_count += 1
                continue

            try:
                retail_price = Decimal(retail_price_raw)
                if retail_price <= 0:
                    raise InvalidOperation
            except (InvalidOperation, ValueError):
                skipped_count += 1
                continue

            products_to_create.append(
                Product(
                    name=name,
                    sku=sku,
                    category=category,
                    cost_price=Decimal("0.00"),
                    retail_price=retail_price,
                    brand="UNKNOWN",
                    manufacturer="UNKNOWN",
                    registration_no=f"PENDING-{sku}",
                    has_sn_tracking=False,
                )
            )
            seen_skus.add(sku)
            imported_count += 1

        if products_to_create:
            session.add_all(products_to_create)
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
            detail="Database error occurred while importing products.",
        )


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    session: AsyncSession = Depends(get_db),
) -> ProductRead:
    try:
        product = Product(
            name=payload.name,
            sku=payload.sku,
            category=payload.category,
            cost_price=payload.cost_price,
            retail_price=payload.retail_price,
            brand=payload.brand,
            manufacturer=payload.manufacturer,
            registration_no=payload.registration_no,
            has_sn_tracking=payload.has_sn_tracking,
        )
        session.add(product)
        await session.commit()
        await session.refresh(product)
        return ProductRead(
            id=product.id,
            name=product.name,
            sku=product.sku,
            category=product.category,
            cost_price=product.cost_price,
            retail_price=product.retail_price,
            brand=product.brand,
            manufacturer=product.manufacturer,
            registration_no=product.registration_no,
            has_sn_tracking=product.has_sn_tracking,
        )
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product SKU already exists",
        )
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while creating product.",
        )


@router.put("/{product_id}", response_model=ProductRead, status_code=status.HTTP_200_OK)
async def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    session: AsyncSession = Depends(get_db),
) -> ProductRead:
    try:
        product = await session.get(Product, product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

        product.name = payload.name
        product.sku = payload.sku
        product.category = payload.category
        product.cost_price = payload.cost_price
        product.retail_price = payload.retail_price
        product.brand = payload.brand
        product.manufacturer = payload.manufacturer
        product.registration_no = payload.registration_no
        product.has_sn_tracking = payload.has_sn_tracking
        await session.commit()
        await session.refresh(product)
        return ProductRead(
            id=product.id,
            name=product.name,
            sku=product.sku,
            category=product.category,
            cost_price=product.cost_price,
            retail_price=product.retail_price,
            brand=product.brand,
            manufacturer=product.manufacturer,
            registration_no=product.registration_no,
            has_sn_tracking=product.has_sn_tracking,
        )
    except HTTPException:
        raise
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product SKU already exists",
        )
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while updating product.",
        )


@router.get("", response_model=list[ProductRead], status_code=status.HTTP_200_OK)
async def list_products(session: AsyncSession = Depends(get_db)) -> list[ProductRead]:
    try:
        result = await session.execute(select(Product).order_by(Product.name.asc(), Product.sku.asc()))
        products = result.scalars().all()
        return [
            ProductRead(
                id=product.id,
                name=product.name,
                sku=product.sku,
                category=product.category,
                cost_price=product.cost_price,
                retail_price=product.retail_price,
                brand=product.brand,
                manufacturer=product.manufacturer,
                registration_no=product.registration_no,
                has_sn_tracking=product.has_sn_tracking,
            )
            for product in products
        ]
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while loading products.",
        )
