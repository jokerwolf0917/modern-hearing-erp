from pydantic import BaseModel, ConfigDict, Field


class EarThresholds(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    hz_250: int | None = Field(alias="250Hz")
    hz_500: int | None = Field(alias="500Hz")
    hz_1k: int | None = Field(alias="1kHz")
    hz_2k: int | None = Field(alias="2kHz")
    hz_4k: int | None = Field(alias="4kHz")
    hz_8k: int | None = Field(alias="8kHz")


class AudiogramData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    customer_name: str | None = Field(
        description="客户姓名；如果图片中无法可靠识别则返回 null。",
    )
    left_ear_thresholds: EarThresholds = Field(
        description="左耳听阈。若某个频点无法识别则该频点返回 null。",
    )
    right_ear_thresholds: EarThresholds = Field(
        description="右耳听阈。若某个频点无法识别则该频点返回 null。",
    )
    hearing_aid_model_mentioned: str | None = Field(
        description="图片中提及的助听器型号；无法确认则返回 null。",
    )
    raw_text_summary: str = Field(
        description="对图片中可见文字、表格和关键信息的严谨摘要。",
    )
