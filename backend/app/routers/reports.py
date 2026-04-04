from fastapi import APIRouter, Response

from app.schemas.reports import (
    AutoReportConfigUpdateRequest,
    MailConfigTestRequest,
    MailConfigUpdateRequest,
    ReportEmailSendRequest,
    ReportMailConfigTestRequest,
    ReportMailConfigUpdateRequest,
)
from app.services.reports import (
    export_report_file,
    get_auto_report_config,
    get_mail_config,
    get_report_dashboard,
    get_report_mail_config,
    save_auto_report_config,
    save_mail_config,
    save_report_mail_config,
    send_auto_report_now,
    send_report_email,
    send_test_mail_config_email,
)

router = APIRouter(prefix="/reports")


@router.get("/data")
def read_report_data(
    date_from: str | None = None,
    date_to: str | None = None,
    table_id: int | None = None,
    category_id: int | None = None,
    product_id: int | None = None,
):
    return get_report_dashboard(
        date_from=date_from,
        date_to=date_to,
        table_id=table_id,
        category_id=category_id,
        product_id=product_id,
    )


@router.get("/config")
def read_report_mail_config():
    return get_report_mail_config()


@router.put("/config")
def update_report_mail_config(payload: ReportMailConfigUpdateRequest):
    return save_report_mail_config(payload)


@router.get("/mail-config")
def read_mail_config():
    return get_mail_config()


@router.put("/mail-config")
def update_mail_config(payload: MailConfigUpdateRequest):
    return save_mail_config(payload)


@router.get("/auto-config")
def read_auto_report_config():
    return get_auto_report_config()


@router.put("/auto-config")
def update_auto_report_config(payload: AutoReportConfigUpdateRequest):
    return save_auto_report_config(payload)


@router.post("/send-email")
def send_report_email_now(payload: ReportEmailSendRequest):
    return send_report_email(payload)


@router.post("/test-email")
def send_test_email_now(payload: MailConfigTestRequest):
    return send_test_mail_config_email(payload)


@router.post("/send-auto-now")
def send_auto_report_now_endpoint(payload: AutoReportConfigUpdateRequest):
    return send_auto_report_now(payload)


@router.get("/export")
def download_report_export(
    report_type: str = "DAILY_SALES_FULL",
    report_format: str = "CSV",
    date_from: str | None = None,
    date_to: str | None = None,
    table_id: int | None = None,
    category_id: int | None = None,
    product_id: int | None = None,
):
    export_result = export_report_file(
        report_type=report_type,
        report_format=report_format,
        date_from=date_from,
        date_to=date_to,
        table_id=table_id,
        category_id=category_id,
        product_id=product_id,
    )
    return Response(
        content=export_result["content"],
        media_type=export_result["media_type"],
        headers={
            "Content-Disposition": (
                f'attachment; filename="{export_result["filename"]}"'
            )
        },
    )
