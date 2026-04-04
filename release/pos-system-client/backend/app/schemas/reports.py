from pydantic import BaseModel, Field


class MailConfigUpdateRequest(BaseModel):
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = ""
    smtp_use_auth: bool = True
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    default_recipients: list[str] = Field(default_factory=list)


class AutoReportConfigUpdateRequest(BaseModel):
    auto_send_enabled: bool = False
    auto_send_time: str = "23:59"
    auto_report_type: str = "DAILY_SALES_FULL"
    auto_report_types: list[str] = Field(default_factory=list)
    auto_report_format: str = "CSV"
    auto_recipients: list[str] = Field(default_factory=list)


class ReportMailConfigUpdateRequest(BaseModel):
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = ""
    smtp_use_auth: bool = True
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    default_recipients: list[str] = Field(default_factory=list)
    auto_send_enabled: bool = False
    auto_send_time: str = "23:59"
    auto_report_type: str = "DAILY_SALES_FULL"
    auto_report_types: list[str] = Field(default_factory=list)
    auto_report_format: str = "CSV"
    auto_recipients: list[str] = Field(default_factory=list)


class MailConfigTestRequest(MailConfigUpdateRequest):
    test_recipient: str = ""


class ReportMailConfigTestRequest(ReportMailConfigUpdateRequest):
    test_recipient: str = ""


class ReportEmailSendRequest(BaseModel):
    report_type: str = "DAILY_SALES_FULL"
    report_format: str = "CSV"
    recipients: list[str] = Field(default_factory=list)
    date_from: str | None = None
    date_to: str | None = None
    table_id: int | None = None
    category_id: int | None = None
    product_id: int | None = None
    subject: str | None = None
