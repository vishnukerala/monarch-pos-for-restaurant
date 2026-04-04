from fastapi import APIRouter

from app.schemas.sales import (
    SaleBillDeleteRequest,
    SaleBillUpdateRequest,
    SaleCashClosingSaveRequest,
    SaleCheckoutRequest,
    SaleExpenseSaveRequest,
    SaleMoveRequest,
    SaleSaveRequest,
    SaleTransferItemRequest,
)
from app.services.sale_live_updates import stream_table_sale_events
from app.services.sales import (
    checkout_sale_for_table,
    get_billed_sale,
    get_billed_sales,
    get_billed_sale_history,
    get_open_sales,
    get_sale_expenses,
    get_sales_reports,
    get_sale_for_table,
    move_sale_to_table,
    print_main_bill,
    print_pending_kot_for_table,
    save_sale_cash_closing,
    save_sale_expense,
    save_sale_for_table,
    transfer_sale_item_to_table,
    delete_billed_sale,
    update_sale_expense,
    update_billed_sale,
)

router = APIRouter(prefix="/sales")


@router.get("/open")
def read_open_sales():
    return get_open_sales()


@router.get("/bills")
def read_billed_sales(
    date_from: str | None = None,
    date_to: str | None = None,
    bill_number: str | None = None,
    bill_number_exact: bool = False,
    payment_method: str | None = None,
    change_filter: str | None = None,
    limit: int | None = None,
):
    return get_billed_sales(
        date_from,
        date_to,
        bill_number,
        payment_method,
        bill_number_exact=bill_number_exact,
        change_filter=change_filter,
        limit=limit,
    )


@router.get("/reports")
def read_sales_reports(
    date_from: str | None = None,
    date_to: str | None = None,
    table_id: int | None = None,
    category_id: int | None = None,
    product_id: int | None = None,
):
    return get_sales_reports(
        date_from=date_from,
        date_to=date_to,
        table_id=table_id,
        category_id=category_id,
        product_id=product_id,
    )


@router.get("/expenses")
def read_sale_expenses(expense_date: str | None = None):
    return get_sale_expenses(expense_date=expense_date)


@router.post("/expenses")
def create_sale_expense(payload: SaleExpenseSaveRequest):
    return save_sale_expense(payload)


@router.put("/expenses/{expense_id}")
def edit_sale_expense(expense_id: int, payload: SaleExpenseSaveRequest):
    return update_sale_expense(expense_id, payload)


@router.put("/cash-closing")
def update_sale_cash_closing(payload: SaleCashClosingSaveRequest):
    return save_sale_cash_closing(payload)


@router.get("/bills/{bill_id}")
def read_billed_sale(bill_id: int):
    return get_billed_sale(bill_id)


@router.post("/bills/{bill_id}/print")
def print_billed_sale(bill_id: int):
    return print_main_bill(bill_id)


@router.get("/bills/{bill_id}/history")
def read_billed_sale_history(bill_id: int):
    return get_billed_sale_history(bill_id)


@router.put("/bills/{bill_id}")
def update_bill(bill_id: int, payload: SaleBillUpdateRequest):
    return update_billed_sale(bill_id, payload)


@router.delete("/bills/{bill_id}")
def remove_bill(bill_id: int, payload: SaleBillDeleteRequest):
    return delete_billed_sale(bill_id, payload)


@router.get("/table/{table_id}")
def read_table_sale(table_id: int):
    return get_sale_for_table(table_id)


@router.get("/table/{table_id}/events")
async def read_table_sale_events(table_id: int):
    return await stream_table_sale_events(table_id)


@router.post("/table/{table_id}")
def save_table_sale(table_id: int, payload: SaleSaveRequest):
    return save_sale_for_table(table_id, payload)


@router.post("/table/{table_id}/checkout")
def checkout_table_sale(table_id: int, payload: SaleCheckoutRequest):
    return checkout_sale_for_table(table_id, payload)


@router.post("/table/{table_id}/move")
def move_table_sale(table_id: int, payload: SaleMoveRequest):
    return move_sale_to_table(table_id, payload)


@router.post("/table/{table_id}/transfer")
def transfer_table_sale_item(table_id: int, payload: SaleTransferItemRequest):
    return transfer_sale_item_to_table(table_id, payload)


@router.post("/table/{table_id}/kot")
def print_table_kot(table_id: int, sender_name: str | None = None):
    return print_pending_kot_for_table(table_id, sender_name=sender_name)
