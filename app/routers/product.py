from __future__ import annotations

import csv
import io
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.catalog import brand_display, category_display, normalize_brand, normalize_category, parse_decimal
from app.database import get_db
from app.models import Employee, EmployeeRole, Inventory, Product, Store
from app.routers.deps import get_current_employee, require_admin
from app.schemas.product import ProductCreate, ProductImportResult, ProductRead, ProductUpdate

router = APIRouter(prefix="/api/products", tags=["products"])


def serialize_product(product: Product) -> ProductRead:
    return ProductRead(
        id=product.id,
        product_code=product.product_code,
        category=product.category.name,
        category_display=category_display(product.category),
        brand=product.brand.name,
        brand_display=brand_display(product.brand),
        name_cn=product.name_cn,
        name_en=product.name_en,
        specification=product.specification,
        matrix=product.matrix,
        original_price=product.original_price,
        unit=product.unit,
        remark=product.remark,
        created_at=product.created_at,
    )


def read_value(row: dict[str, str], keys: list[str]) -> str | None:
    for key in keys:
        value = row.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def build_product_from_payload(product: Product, payload: ProductCreate | ProductUpdate) -> Product:
    product.product_code = payload.product_code.strip()
    product.category = normalize_category(payload.category)
    product.brand = normalize_brand(payload.brand)
    product.name_cn = payload.name_cn.strip()
    product.name_en = payload.name_en.strip() if payload.name_en else None
    product.specification = payload.specification.strip() if payload.specification else None
    product.matrix = payload.matrix.strip() if payload.matrix else None
    product.original_price = payload.original_price
    product.unit = payload.unit.strip() if payload.unit else None
    product.remark = payload.remark.strip() if payload.remark else None
    return product


async def _resolve_store_scope(
    *,
    session: AsyncSession,
    current_employee: Employee,
    requested_store_id: uuid.UUID | None,
) -> uuid.UUID | None:
    if current_employee.role == EmployeeRole.ADMIN:
        if requested_store_id is None:
            return None
        if await session.get(Store, requested_store_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="门店不存在")
        return requested_store_id

    if current_employee.store_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前账号未绑定门店")

    if requested_store_id is not None and requested_store_id != current_employee.store_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只能查看当前门店商品")

    return current_employee.store_id


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    session: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
) -> ProductRead:
    _ = current_employee

    try:
        product = build_product_from_payload(Product(), payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    session.add(product)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="产品编号已存在") from exc
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建商品时发生数据库错误") from exc

    await session.refresh(product)
    return serialize_product(product)


@router.put("/{product_id}", response_model=ProductRead, status_code=status.HTTP_200_OK)
async def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    session: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
) -> ProductRead:
    _ = current_employee

    product = await session.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品不存在")

    try:
        build_product_from_payload(product, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="产品编号已存在") from exc
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新商品时发生数据库错误") from exc

    await session.refresh(product)
    return serialize_product(product)


@router.get("", response_model=list[ProductRead], status_code=status.HTTP_200_OK)
async def list_products(
    store_id: uuid.UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
) -> list[ProductRead]:
    scoped_store_id = await _resolve_store_scope(
        session=session,
        current_employee=current_employee,
        requested_store_id=store_id,
    )

    stmt = select(Product).order_by(Product.brand.asc(), Product.category.asc(), Product.product_code.asc())
    if scoped_store_id is not None:
        stmt = (
            stmt.join(Inventory, Inventory.product_id == Product.id)
            .where(Inventory.store_id == scoped_store_id)
            .distinct()
        )

    result = await session.execute(stmt)
    products = result.scalars().all()
    return [serialize_product(product) for product in products]


@router.post("/import", response_model=ProductImportResult, status_code=status.HTTP_200_OK)
async def import_products(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
) -> ProductImportResult:
    _ = current_employee

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅支持 CSV 文件")

    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    imported_count = 0
    skipped_count = 0

    for row in reader:
        product_code = read_value(row, ["product_code", "产品编号", "产品编码"])
        category = read_value(row, ["category", "类别", "机器外型"])
        brand = read_value(row, ["brand", "品牌"])
        name_cn = read_value(row, ["name_cn", "中文名称", "产品名称"])
        name_en = read_value(row, ["name_en", "英文名称"])
        specification = read_value(row, ["specification", "规格"])
        matrix = read_value(row, ["matrix", "矩阵", "型号", "型号/矩阵"])
        original_price_raw = read_value(row, ["original_price", "原价"])
        unit = read_value(row, ["unit", "单位"])
        remark = read_value(row, ["remark", "备注"])

        if not product_code or not category or not brand or not name_cn or not original_price_raw:
            skipped_count += 1
            continue

        try:
            original_price = parse_decimal(original_price_raw)
            normalized_category = normalize_category(category)
            normalized_brand = normalize_brand(brand)
        except ValueError:
            skipped_count += 1
            continue

        if original_price is None:
            skipped_count += 1
            continue

        result = await session.execute(select(Product).where(Product.product_code == product_code))
        product = result.scalar_one_or_none()

        if product is None:
            product = Product(product_code=product_code)
            session.add(product)

        product.product_code = product_code
        product.category = normalized_category
        product.brand = normalized_brand
        product.name_cn = name_cn
        product.name_en = name_en
        product.specification = specification
        product.matrix = matrix
        product.original_price = original_price
        product.unit = unit
        product.remark = remark
        imported_count += 1

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="导入商品时出现重复产品编号") from exc
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="导入商品时发生数据库错误") from exc

    return ProductImportResult(imported_count=imported_count, skipped_count=skipped_count)


@router.get("/export", response_class=StreamingResponse, status_code=status.HTTP_200_OK)
async def export_products(
    session: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
) -> StreamingResponse:
    _ = current_employee

    result = await session.execute(
        select(Product).order_by(Product.brand.asc(), Product.category.asc(), Product.product_code.asc())
    )
    products = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["产品编号", "类别", "品牌", "中文名称", "英文名称", "规格", "矩阵", "原价", "单位", "备注"])

    for product in products:
        writer.writerow(
            [
                product.product_code,
                category_display(product.category),
                brand_display(product.brand),
                product.name_cn,
                product.name_en or "",
                product.specification or "",
                product.matrix or "",
                str(product.original_price),
                product.unit or "",
                product.remark or "",
            ]
        )

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="products.csv"'},
    )
