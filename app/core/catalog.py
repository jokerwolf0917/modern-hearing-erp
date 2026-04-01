from __future__ import annotations

from decimal import Decimal, InvalidOperation

from app.models import BrandEnum, CategoryEnum


BRAND_DISPLAY_BY_KEY: dict[str, str] = {
    "SIGNIA": "西嘉",
    "PHONAK": "峰力",
    "PHILIPS": "飞利浦",
    "SIEMENS": "西门子",
    "POWERONE": "POWERONE",
    "ZHILI": "至力",
}


CATEGORY_DISPLAY_BY_KEY: dict[str, str] = {
    "BTE": "BTE",
    "RIC": "RIC",
    "ITC": "ITC",
    "ITE": "ITE",
    "IIC": "IIC",
    "CIC": "CIC",
    "IIC_CIC": "IIC/CIC",
    "STANDARD_MACHINE": "标准机",
    "BEHIND_EAR_MACHINE": "耳背机",
    "CUSTOM_MACHINE": "定制机",
    "RECEIVER_2": "2.0受话器",
    "RECEIVER_3": "3.0受话器",
    "CHARGER": "充电器",
    "EAR_MOLD": "耳模",
    "ACCESSORY": "配件",
    "CARE_DEVICE": "护理宝",
    "CROS": "同声移",
    "DEMO_MACHINE": "Demo机",
    "BATTERY": "电池",
}


BRAND_ALIASES: dict[str, BrandEnum] = {
    "SIGNIA": BrandEnum.SIGNIA,
    "西嘉": BrandEnum.SIGNIA,
    "PHONAK": BrandEnum.PHONAK,
    "峰力": BrandEnum.PHONAK,
    "PHILIPS": BrandEnum.PHILIPS,
    "飞利浦": BrandEnum.PHILIPS,
    "SIEMENS": BrandEnum.SIEMENS,
    "西门子": BrandEnum.SIEMENS,
    "POWERONE": BrandEnum.POWERONE,
    "至力": BrandEnum.ZHILI,
    "ZHILI": BrandEnum.ZHILI,
}


CATEGORY_ALIASES: dict[str, CategoryEnum] = {
    "BTE": CategoryEnum.BTE,
    "RIC": CategoryEnum.RIC,
    "ITC": CategoryEnum.ITC,
    "ITE": CategoryEnum.ITE,
    "IIC": CategoryEnum.IIC,
    "CIC": CategoryEnum.CIC,
    "IIC/CIC": CategoryEnum.IIC_CIC,
    "IIC_CIC": CategoryEnum.IIC_CIC,
    "标准机": CategoryEnum.STANDARD_MACHINE,
    "STANDARD_MACHINE": CategoryEnum.STANDARD_MACHINE,
    "耳背机": CategoryEnum.BEHIND_EAR_MACHINE,
    "BEHIND_EAR_MACHINE": CategoryEnum.BEHIND_EAR_MACHINE,
    "定制机": CategoryEnum.CUSTOM_MACHINE,
    "CUSTOM_MACHINE": CategoryEnum.CUSTOM_MACHINE,
    "2.0受话器": CategoryEnum.RECEIVER_2,
    "受话器_2": CategoryEnum.RECEIVER_2,
    "RECEIVER_2": CategoryEnum.RECEIVER_2,
    "3.0受话器": CategoryEnum.RECEIVER_3,
    "受话器_3": CategoryEnum.RECEIVER_3,
    "RECEIVER_3": CategoryEnum.RECEIVER_3,
    "充电器": CategoryEnum.CHARGER,
    "CHARGER": CategoryEnum.CHARGER,
    "耳模": CategoryEnum.EAR_MOLD,
    "EAR_MOLD": CategoryEnum.EAR_MOLD,
    "配件": CategoryEnum.ACCESSORY,
    "ACCESSORY": CategoryEnum.ACCESSORY,
    "护理宝": CategoryEnum.CARE_DEVICE,
    "CARE_DEVICE": CategoryEnum.CARE_DEVICE,
    "同声移": CategoryEnum.CROS,
    "CROS": CategoryEnum.CROS,
    "Demo机": CategoryEnum.DEMO_MACHINE,
    "DEMO_MACHINE": CategoryEnum.DEMO_MACHINE,
    "电池": CategoryEnum.BATTERY,
    "BATTERY": CategoryEnum.BATTERY,
}


def brand_display(brand: BrandEnum | str) -> str:
    key = brand.name if isinstance(brand, BrandEnum) else str(brand).strip().upper()
    return BRAND_DISPLAY_BY_KEY.get(key, str(brand))


def category_display(category: CategoryEnum | str) -> str:
    key = category.name if isinstance(category, CategoryEnum) else str(category).strip().upper()
    if key in CATEGORY_DISPLAY_BY_KEY:
        return CATEGORY_DISPLAY_BY_KEY[key]

    normalized = str(category).strip()
    return CATEGORY_DISPLAY_BY_KEY.get(normalized, normalized)


def normalize_brand(value: BrandEnum | str) -> BrandEnum:
    if isinstance(value, BrandEnum):
        return value

    normalized = str(value).strip()
    if not normalized:
        raise ValueError("brand is required")

    candidate = BRAND_ALIASES.get(normalized.upper()) or BRAND_ALIASES.get(normalized)
    if candidate is None:
        raise ValueError(f"Unsupported brand: {value}")
    return candidate


def normalize_category(value: CategoryEnum | str) -> CategoryEnum:
    if isinstance(value, CategoryEnum):
        return value

    normalized = str(value).strip()
    if not normalized:
        raise ValueError("category is required")

    candidate = CATEGORY_ALIASES.get(normalized.upper()) or CATEGORY_ALIASES.get(normalized)
    if candidate is None:
        raise ValueError(f"Unsupported category: {value}")
    return candidate


def parse_decimal(value: str | Decimal | int | float | None) -> Decimal | None:
    if value is None or value == "":
        return None

    if isinstance(value, Decimal):
        return value

    if isinstance(value, (int, float)):
        return Decimal(str(value))

    normalized = str(value).replace(",", "").replace("楼", "").strip()
    if not normalized:
        return None

    try:
        return Decimal(normalized)
    except InvalidOperation as exc:
        raise ValueError(f"Invalid decimal value: {value}") from exc
