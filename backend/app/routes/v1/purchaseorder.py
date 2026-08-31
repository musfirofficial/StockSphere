import io
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal

from app.database import get_async_session
from app.routes.dependencies import RoleChecker
from app.models import UserRole, POStatus, User
from app.crud import purchaseorder as crud_po
from app.crud import supplier as crud_supplier
from app.crud import item as crud_item
from app.crud import item_supplier as crud_item_supplier
from app.crud import auditlog as crud_auditlog
from app.services.report_generator import generate_po_pdf_document
from app.schemas.purchaseorder import (
    PurchaseOrderCreate,
    PurchaseOrderResponse,
    PurchaseOrderItemResponse,
    PurchaseOrderStatusUpdate,
)

router = APIRouter(prefix="/purchas-orders", tags=["purchaseorders"])


# ----------------------- Get all Purchase Orders ---------------------------- #
@router.get("/", response_model=list[PurchaseOrderResponse])
async def get_all_purchase_orders(
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER, UserRole.AUDITOR])
    ),
):
    p_orders = await crud_po.get_all_purchase_orders(db)
    return [PurchaseOrderResponse.model_validate(po) for po in p_orders]


# ----------------------- Check Active PO for Supplier ----------------------- #
@router.get("/active-check/{supplier_id}")
async def check_active_po_for_supplier(
    supplier_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER])
    ),
):
    active_po = await crud_po.get_active_po_for_supplier(db, supplier_id)
    if active_po:
        return {
            "has_active_po": True,
            "po_id": active_po.po_id,
            "status": active_po.status.value,
        }
    return {"has_active_po": False}


# ----------------------- Get single Purchase Order by ID -------------------- #
@router.get("/{po_id}", response_model=PurchaseOrderResponse)
async def get_single_purchase_order(
    po_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER, UserRole.AUDITOR])
    ),
):
    po = await crud_po.get_purchase_order_by_id(db, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return PurchaseOrderResponse.model_validate(po)


# ----------------------- Create new Purchase Order -------------------------- #
@router.post("/", response_model=PurchaseOrderResponse, status_code=201)
async def create_purchase_order(
    payload: PurchaseOrderCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER])
    ),
):
    # 1. Verify supplier exists and is active
    supplier = await crud_supplier.get_supplier_by_supplier_id(db, payload.supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found.")
    if not supplier.is_active:
        raise HTTPException(
            status_code=400, detail="Cannot create purchase order for an inactive supplier."
        )

    # 2. Rule: Only ONE active PO per supplier
    active_po = await crud_po.get_active_po_for_supplier(db, payload.supplier_id)
    if active_po:
        raise HTTPException(
            status_code=400,
            detail=f"An active purchase order ({active_po.status.value}) already exists for this supplier. Complete or cancel it first.",
        )

    # 3. Verify items list is provided
    if not payload.items:
        raise HTTPException(
            status_code=400, detail="Purchase order must contain at least one item."
        )

    # 4. Enforce fixed agreed prices from ItemSupplier
    item_prices_map: dict[uuid.UUID, Decimal] = {}
    for item_input in payload.items:
        rel = await crud_item_supplier.get_item_supplier(
            db, item_input.item_id, payload.supplier_id
        )
        if not rel:
            item = await crud_item.get_item_by_item_id(db, item_input.item_id)
            item_name = item.item_name if item else "Unknown Item"
            raise HTTPException(
                status_code=400,
                detail=f'Item "{item_name}" is not supplied by {supplier.supplier_name}. Please link it with an agreed price first.',
            )
        item_prices_map[item_input.item_id] = rel.agreed_price

    # 5. Create PO and line items
    new_po = await crud_po.create_purchase_order(
        db, payload, current_user.user_id, item_prices_map
    )

    return PurchaseOrderResponse.model_validate(new_po)


# ----------------------- Update Purchase Order Status ----------------------- #
@router.patch("/{po_id}/status", response_model=PurchaseOrderResponse)
async def update_po_status(
    po_id: uuid.UUID,
    payload: PurchaseOrderStatusUpdate,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER])
    ),
):
    po = await crud_po.get_purchase_order_by_id(db, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    old_status = po.status
    new_status = payload.status

    # Enforce state machine rules
    if old_status in [POStatus.COMPLETED, POStatus.CANCELLED]:
        raise HTTPException(
            status_code=400,
            detail=f"Purchase order is {old_status.value} and cannot be modified.",
        )

    if new_status == POStatus.PENDING_APPROVAL and old_status != POStatus.DRAFT:
        raise HTTPException(
            status_code=400, detail="Only draft purchase orders can be sent for approval."
        )

    if new_status == POStatus.APPROVED and old_status not in [
        POStatus.DRAFT,
        POStatus.PENDING_APPROVAL,
    ]:
        raise HTTPException(
            status_code=400, detail="Cannot approve purchase order in its current status."
        )

    updated_po = await crud_po.update_purchase_order_status(
        db, po, new_status, payload.notes
    )

    return PurchaseOrderResponse.model_validate(updated_po)


# ----------------------- Delete Purchase Order ------------------------------ #
@router.delete("/{po_id}", status_code=204)
async def delete_purchase_order(
    po_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER])
    ),
):
    po = await crud_po.get_purchase_order_by_id(db, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    if po.status not in [POStatus.DRAFT, POStatus.CANCELLED]:
        raise HTTPException(
            status_code=400,
            detail="Only Draft or Cancelled purchase orders can be deleted.",
        )

    await crud_po.delete_purchase_order(db, po_id)


# ----------------------- Generate Purchase Order PDF ------------------------ #
@router.get("/{po_id}/pdf")
@router.post("/{po_id}/generate")
async def generate_purchase_order_pdf(
    po_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER, UserRole.AUDITOR])
    ),
):
    po = await crud_po.get_purchase_order_by_id(db, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    if not po.purchaseorderitems:
        raise HTTPException(
            status_code=400, detail="Cannot generate PDF for an empty purchase order."
        )

    pdf_buffer = io.BytesIO()
    generate_po_pdf_document(output_target=pdf_buffer, po_items=po.purchaseorderitems)
    pdf_buffer.seek(0)

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=Purchase_Order_{str(po_id)[:8]}.pdf"
        },
    )
