from pydantic import BaseModel


class SaleItemCreate(BaseModel):
    sale_item_id: int | None = None
    product_id: int | None = None
    item_name: str
    unit_price: float
    qty: int
    tax_mode: str = "NO_TAX"
    printer_name: str | None = None
    printer_target: str | None = None
    created_by_user_id: int | None = None
    created_by_username: str | None = None


class SaleSaveRequest(BaseModel):
    items: list[SaleItemCreate]
    customer_paid: float | None = None


class SaleCheckoutRequest(BaseModel):
    items: list[SaleItemCreate] = []
    customer_paid: float | None = None
    payment_method: str = "CASH"
    print_enabled: bool = True
    cash_paid: float | None = None
    card_paid: float | None = None
    upi_paid: float | None = None


class SaleBillUpdateRequest(BaseModel):
    items: list[SaleItemCreate] = []
    customer_paid: float | None = None
    payment_method: str = "CASH"
    print_enabled: bool = True
    cash_paid: float | None = None
    card_paid: float | None = None
    upi_paid: float | None = None
    actor_user_id: int | None = None
    actor_username: str | None = None
    actor_role: str | None = None


class SaleBillDeleteRequest(BaseModel):
    actor_user_id: int | None = None
    actor_username: str | None = None
    actor_role: str | None = None


class SaleMoveRequest(BaseModel):
    target_table_id: int


class SaleTransferItemRequest(BaseModel):
    target_table_id: int
    product_id: int | None = None
    item_name: str
    qty: int
    created_by_user_id: int | None = None
    created_by_username: str | None = None


class SaleExpenseSaveRequest(BaseModel):
    amount: float
    details: str
    expense_date: str | None = None
    expense_time: str | None = None
    actor_user_id: int | None = None
    actor_username: str | None = None
    actor_role: str | None = None


class SaleCashClosingSaveRequest(BaseModel):
    business_date: str | None = None
    cash_in_hand: float
    actor_user_id: int | None = None
    actor_username: str | None = None
    actor_role: str | None = None
