import enum
import uuid
from datetime import datetime, timezone, date, timedelta
from decimal import Decimal
from sqlalchemy import (
    String,
    ForeignKey,
    Integer,
    Text,
    DateTime,
    Date,
    Enum,
    Numeric,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

# -------------------------- Setting local timezone -------------------------- #
local_tz = datetime.now().astimezone().tzinfo


# --------------------------- Enums for User Roles --------------------------- #
class UserRole(enum.Enum):
    ADMIN = "Admin"
    INVENTORY_MANAGER = "Inventory Manager"
    AUDITOR = "Auditor"
    SALES = "Sales"


# -------------------------- Enums for report types -------------------------- #
class ReportType(enum.Enum):
    OVERALL_SUMMARY = "OVERALL_SUMMARY"
    LOW_STOCK = "LOW_STOCK"
    TRANSACTION = "TRANSACTION"
    STOCK_MOVEMENT = "STOCK_MOVEMENT"
    CATEGORY_WISE = "CATEGORY_WISE"
    SUPPLIER = "SUPPLIER"


# ----------------------- Enums for report file formats ---------------------- #
class FileFormat(enum.Enum):
    CSV = "CSV"
    PDF = "PDF"


# ----------------------- Enums for purchase order type ---------------------- #
class POType(enum.Enum):
    DRAFT = "Draft"
    GENERATED = "Generated"


# ----------------------- Enums for Audit action types ----------------------- #
class AuditAction(enum.Enum):
    # Authentication & User Management
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    LOGOUT_SUCCESS = "LOGOUT_SUCCESS"
    USER_CREATE = "USER_CREATE"
    USER_DELETE = "USER_DELETE"
    USER_DEACTIVATE = "USER_DEACTIVATE"
    USER_REACTIVATE = "USER_REACTIVATE"
    USER_PASSWORD_CHANGE = "USER_PASSWORD_CHANGE"

    # Category Management
    CATEGORY_CREATE = "CATEGORY_CREATE"
    CATEGORY_DELETE = "CATEGORY_DELETE"

    # Supplier Management
    SUPPLIER_CREATE = "SUPPLIER_CREATE"
    SUPPLIER_DELETE = "SUPPLIER_DELETE"
    SUPPLIER_DEACTIVATE = "SUPPLIER_DEACTIVATE"
    SUPPLIER_REACTIVATE = "SUPPLIER_REACTIVATE"

    # Item & Price Management
    ITEM_CREATE = "ITEM_CREATE"
    ITEM_DELETE = "ITEM_DELETE"
    ITEM_DEACTIVATE = "ITEM_DEACTIVATE"
    ITEM_REACTIVATE = "ITEM_REACTIVATE"
    ITEM_PRICE_UPDATE = "ITEM_PRICE_UPDATE"


# ------------------------ Enums for Transaction types ----------------------- #
class TransactionType(enum.Enum):
    STOCK_IN = "STOCK_IN"
    STOCK_OUT = "STOCK_OUT"


# --------------------------- Enums for Alert types -------------------------- #
class AlertStatus(enum.Enum):
    CRITICAL = "CRITICAL"  # stock == 0           (red)
    LOW_STOCK = "LOW_STOCK"  # 0 < stock <= restock (orange)
    RESOLVED = "RESOLVED"  # stock > restock       (green)


# -------------------------------- User Model -------------------------------- #
class User(Base):
    __tablename__ = "users"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    full_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    user_name: Mapped[str] = mapped_column(
        String(50), nullable=False, unique=True, index=True
    )
    nic: Mapped[str] = mapped_column(String(12), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    phone: Mapped[str] = mapped_column(String(12), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), nullable=False, default=UserRole.SALES
    )
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(local_tz)
    )
    # Withot lambda the time will actually be the time your server started
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(local_tz),
        onupdate=lambda: datetime.now(local_tz),
    )
    refresh_token: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Relationships
    transactions: Mapped[list["Transaction"]] = relationship(
        "Transaction", back_populates="user", passive_deletes=True
    )
    reports: Mapped[list["Report"]] = relationship(
        "Report", back_populates="user", passive_deletes=True
    )
    purchaseorders: Mapped[list["PurchaseOrder"]] = relationship(
        "PurchaseOrder", back_populates="user", passive_deletes=True
    )
    auditlogs: Mapped[list["AuditLog"]] = relationship(
        "AuditLog", back_populates="user", passive_deletes=True
    )

    # back_populates use to sync both relationships, so we can access user from report and report from user
    # in relationship need to match attribute name not table name or class name
    # ForeignKey determine the 1:M relationship


class Category(Base):

    __tablename__ = "categories"

    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    category_name: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True, index=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(local_tz)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(local_tz),
        onupdate=lambda: datetime.now(local_tz),
    )
    # Relationships
    items: Mapped[list["Item"]] = relationship(
        "Item", back_populates="category", passive_deletes=True
    )


class Supplier(Base):

    __tablename__ = "suppliers"

    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    supplier_name: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True, index=True
    )
    contact_person: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(local_tz)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(local_tz),
        onupdate=lambda: datetime.now(local_tz),
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_supplies: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    items: Mapped[list["Item"]] = relationship(
        "Item", back_populates="supplier", passive_deletes=True
    )
    purchaseorders: Mapped[list["PurchaseOrder"]] = relationship(
        "PurchaseOrder",
        back_populates="supplier",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    stockalerts: Mapped[list["StockAlert"]] = relationship(
        "StockAlert", back_populates="supplier", passive_deletes=True
    )


class Report(Base):

    __tablename__ = "reports"

    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    report_name: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True, index=True
    )
    report_type: Mapped[ReportType] = mapped_column(Enum(ReportType), nullable=False)
    generated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=True,
    )
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(local_tz)
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    file_format: Mapped[FileFormat] = mapped_column(
        Enum(FileFormat), nullable=False, default=FileFormat.PDF
    )

    # Realtionships
    user: Mapped["User | None"] = relationship("User", back_populates="reports")


class PurchaseOrder(Base):

    __tablename__ = "purchase_orders"

    po_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suppliers.supplier_id", ondelete="CASCADE"),
        nullable=False,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=True,
    )
    po_type: Mapped[POType] = mapped_column(Enum(POType), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(local_tz)
    )

    # Relationships
    user: Mapped["User | None"] = relationship(
        "User", back_populates="purchaseorders", foreign_keys=[created_by]
    )
    supplier: Mapped["Supplier"] = relationship(
        "Supplier", back_populates="purchaseorders"
    )
    purchaseorderitems: Mapped[list["PurchaseOrderItem"]] = relationship(
        "PurchaseOrderItem",
        back_populates="purchaseorder",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Nullable=True because a failed login or system-generated task might not have a valid user_id
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[AuditAction] = mapped_column(
        Enum(AuditAction), nullable=False, index=True
    )
    # Human-readable summary (e.g., "Updated selling price of Item 'Laptop X' from $1000 to $1200")
    description: Mapped[str] = mapped_column(String, nullable=False)
    target_table: Mapped[str] = mapped_column(String, nullable=False, index=True)
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=True)
    old_value: Mapped[str | None] = mapped_column(String, nullable=True)
    new_value: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(local_tz), index=True
    )
    # Relationships
    user: Mapped["User | None"] = relationship("User", back_populates="auditlogs")


class Item(Base):

    __tablename__ = "items"

    __table_args__ = (
        Index(
            "idx_items_report_summary",
            "is_active",
            "quantity_in_stock",
            "cost_price",
            "selling_price",
        ),
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    item_name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    sku: Mapped[str] = mapped_column(
        String(50), nullable=False, unique=True, index=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.category_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suppliers.supplier_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    quantity_in_stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unit: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # Kg, Liters, Pieces, etc.
    cost_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    selling_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    reorder_level: Mapped[int] = mapped_column(
        Integer, nullable=False, default=10, index=True
    )
    reorder_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    is_active: Mapped[bool] = mapped_column(default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(local_tz)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(local_tz),
        onupdate=lambda: datetime.now(local_tz),
    )

    # Relationships
    category: Mapped["Category"] = relationship("Category", back_populates="items")
    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="items")
    purchaseorderitems: Mapped[list["PurchaseOrderItem"]] = relationship(
        "PurchaseOrderItem",
        back_populates="item",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    transactions: Mapped[list["Transaction"]] = relationship(
        "Transaction",
        back_populates="item",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    stockalerts: Mapped[list["StockAlert"]] = relationship(
        "StockAlert",
        back_populates="item",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Transaction(Base):

    __tablename__ = "transactions"

    __table_args__ = (
        Index(
            "idx_transactions_date_range_lookup",
            "transaction_date",
            "transaction_type",
            "item_id",
        ),
    )

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("items.item_id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=True,
    )
    transaction_type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    previous_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    new_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    transaction_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(local_tz), index=True
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Realtionships
    user: Mapped["User | None"] = relationship("User", back_populates="transactions")
    item: Mapped["Item"] = relationship("Item", back_populates="transactions")


class StockAlert(Base):

    __tablename__ = "stock_alerts"

    __table_args__ = (
        Index(
            "idx_stock_alerts_metrics_lookup",
            "status",
            "created_at",
            "supplier_id",
            "resolved_at",
        ),
    )

    alert_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("items.item_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suppliers.supplier_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[AlertStatus] = mapped_column(
        Enum(AlertStatus), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(local_tz)
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    supplier: Mapped["Supplier | None"] = relationship(
        "Supplier", back_populates="stockalerts"
    )
    item: Mapped["Item"] = relationship("Item", back_populates="stockalerts")


class PurchaseOrderItem(Base):

    __tablename__ = "purchase_order_items"

    poi_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    po_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("purchase_orders.po_id", ondelete="CASCADE"),
        nullable=False,
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("items.item_id", ondelete="CASCADE"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # Relationships
    purchaseorder: Mapped["PurchaseOrder"] = relationship(
        "PurchaseOrder", back_populates="purchaseorderitems"
    )
    item: Mapped["Item"] = relationship("Item", back_populates="purchaseorderitems")
