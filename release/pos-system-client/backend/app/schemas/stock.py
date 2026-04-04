from pydantic import BaseModel


class StockCategoryCreate(BaseModel):
    name: str


class StockPrinterCreate(BaseModel):
    name: str
    target: str | None = None
    token_print_enabled: bool = False
    main_bill_enabled: bool = False


class StockPrinterUpdate(BaseModel):
    token_print_enabled: bool = False
    main_bill_enabled: bool = False


class StockReceiptSettingsUpdate(BaseModel):
    title_enabled: bool = False
    details_enabled: bool = True
    title_font_size: int = 18
    logo_enabled: bool = False
    logo_image: str | None = None
    logo_alignment: str = "CENTER"
    logo_size: str = "SMALL"
    logo_width: int = 200
    header_text: str = ""
    header_alignment: str = "CENTER"
    header_font_size: int = 18
    details_font_size: int = 12
    item_font_size: int = 13
    summary_font_size: int = 14
    footer_enabled: bool = True
    footer_text: str = ""
    footer_alignment: str = "CENTER"
    footer_font_size: int = 12
    item_layout: str = "COMPACT"


class StockLoginBrandingUpdate(BaseModel):
    logo_enabled: bool = False
    logo_image: str | None = None


class StockProductCreate(BaseModel):
    name: str
    category_id: int
    display_position: int | None = None
    sale_price: float
    cost_price: float = 0
    tax_mode: str = "NO_TAX"
    printer_id: int | None = None
    image_data: str | None = None
    initial_stock_qty: float = 0


class StockProductUpdate(BaseModel):
    name: str
    category_id: int
    display_position: int | None = None
    sale_price: float
    cost_price: float = 0
    tax_mode: str = "NO_TAX"
    printer_id: int | None = None
    image_data: str | None = None


class StockProductCostUpdate(BaseModel):
    cost_price: float


class StockMovementCreate(BaseModel):
    product_id: int
    movement_type: str
    quantity: float
    note: str | None = None
