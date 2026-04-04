from fastapi import APIRouter

from app.schemas.stock import (
    StockCategoryCreate,
    StockLoginBrandingUpdate,
    StockMovementCreate,
    StockProductCostUpdate,
    StockPrinterCreate,
    StockReceiptSettingsUpdate,
    StockPrinterUpdate,
    StockProductCreate,
    StockProductUpdate,
)
from app.services.stock import (
    add_category,
    add_stock_movement,
    add_printer,
    add_product,
    delete_category,
    delete_printer,
    delete_product,
    get_categories,
    get_login_branding_settings,
    get_stock_movements,
    get_printers,
    get_products,
    get_receipt_settings,
    get_system_printers,
    update_product,
    update_product_cost_price,
    update_login_branding_settings,
    update_receipt_settings,
    update_printer_options,
)

router = APIRouter(prefix="/stock")


@router.get("/categories")
def read_categories():
    return get_categories()


@router.post("/categories")
def create_category(data: StockCategoryCreate):
    return add_category(data)


@router.delete("/categories/{category_id}")
def remove_category(category_id: int):
    return delete_category(category_id)


@router.get("/printers")
def read_printers():
    return get_printers()


@router.get("/system-printers")
def read_system_printers():
    return get_system_printers()


@router.get("/receipt-settings")
def read_receipt_settings():
    return get_receipt_settings()


@router.put("/receipt-settings")
def save_receipt_settings(data: StockReceiptSettingsUpdate):
    return update_receipt_settings(data)


@router.get("/login-branding")
def read_login_branding_settings():
    return get_login_branding_settings()


@router.put("/login-branding")
def save_login_branding_settings(data: StockLoginBrandingUpdate):
    return update_login_branding_settings(data)


@router.post("/printers")
def create_printer(data: StockPrinterCreate):
    return add_printer(data)


@router.put("/printers/{printer_id}")
def update_printer(printer_id: int, data: StockPrinterUpdate):
    return update_printer_options(printer_id, data)


@router.delete("/printers/{printer_id}")
def remove_printer(printer_id: int):
    return delete_printer(printer_id)


@router.get("/products")
def read_products():
    return get_products()


@router.post("/products")
def create_product(data: StockProductCreate):
    return add_product(data)


@router.put("/products/{product_id}")
def edit_product(product_id: int, data: StockProductUpdate):
    return update_product(product_id, data)


@router.delete("/products/{product_id}")
def remove_product(product_id: int):
    return delete_product(product_id)


@router.put("/products/{product_id}/cost-price")
def update_product_cost(product_id: int, data: StockProductCostUpdate):
    return update_product_cost_price(product_id, data)


@router.get("/movements")
def read_stock_movements(limit: int | None = None):
    return get_stock_movements(limit=limit)


@router.post("/movements")
def create_stock_movement(data: StockMovementCreate):
    return add_stock_movement(data)
