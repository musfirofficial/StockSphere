import io
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.database import get_async_session

from sqlalchemy.ext.asyncio import AsyncSession

from app.routes.dependencies import RoleChecker

from app.models import UserRole, POType, User

from app.crud import purchaseorder as crud_po
from app.crud import supplier as crud_supplier
from app.crud import item as crud_item

from app.services.report_generator import generate_po_pdf_document

from app.schemas.purchaseorder import (
    PurchaseOrderCreate,
    PurchaseOrderItemResponse,
    PurchaseOrderItemCreate,
    PurchaseOrderItemUpdate,
)

router = APIRouter(prefix="/purchas-orders", tags=["purchaseorders"])


# -------------------- Endpoint for auto generated drafts -------------------- #
@router.post("/auto-generated", status_code=201)
async def auto_generated_drafts(
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker(
            [
                UserRole.ADMIN,
                UserRole.INVENTORY_MANAGER,
            ]
        )
    ),
):
    # 1. Fetch all suppliers that currently have active alerts
    suppliers_with_alerts = await crud_po.get_suppliers_with_alerts(db)
    if not suppliers_with_alerts:
        return {"message": "No active stock alerts found. No drafts created."}

    alerted_supplier_ids = {
        s.supplier_id for s in suppliers_with_alerts
    }  # set of supplier IDs with active alerts

    # 2. Query for suppliers that already have an open DRAFT purchase order
    existing_drafts = await crud_po.get_suppliers_with_draft_po(
        db, alerted_supplier_ids
    )

    # 3. Use Set Difference to find suppliers needing a new draft PO
    suppliers_to_create = alerted_supplier_ids - existing_drafts

    if not suppliers_to_create:
        return {
            "message": "All alerted suppliers already have active drafts pending review."
        }

    # 4. Use your Pydantic Schema to instantiate your records cleanly
    new_pos_to_commit = []
    for supplier_id in suppliers_to_create:
        # Utilizing your PurchaseOrderCreate Pydantic schema structure
        po_data = PurchaseOrderCreate(supplier_id=supplier_id, po_type=POType.DRAFT)
        new_po = await crud_po.create_purchase_order(db, po_data, current_user.user_id)
        new_pos_to_commit.append(new_po)

    # 5. Fast Bulk Save execution
    db.add_all(new_pos_to_commit)
    await db.commit()

    return {
        "message": f"Successfully auto-generated {len(new_pos_to_commit)} new draft purchase orders.",
        "created_for_supplier_ids": list(suppliers_to_create),
    }


# -------------------- Endpoint for manual draft creation -------------------- #
@router.post("/manual", status_code=201)
async def create_manual_draft_po(
    payload: PurchaseOrderCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker(
            [
                UserRole.ADMIN,
                UserRole.INVENTORY_MANAGER,
            ]
        )
    ),
):
    # 1. Ensure the supplier is valid and active
    result = await crud_supplier.get_supplier_by_supplier_id(db, payload.supplier_id)
    if not result:
        raise HTTPException(status_code=404, detail="Supplier not found.")
    if not result.is_active:
        raise HTTPException(
            status_code=400,
            detail="Cannot create a purchase order for an inactive supplier.",
        )

    # 2. Check if a draft already exists to prevent redundant open orders
    existing_draft = await crud_po.get_existing_draft_po(db, payload.supplier_id)
    if existing_draft:
        return {
            "message": "An open draft already exists for this supplier. Redirecting...",
            "po_id": existing_draft.po_id,
            "is_new": False,
        }

    # 3. Create the new blank draft PO row
    payload.po_type = POType.DRAFT
    new_po = await crud_po.create_purchase_order(db, payload, current_user.user_id)

    db.add(new_po)
    await db.commit()
    await db.refresh(new_po)

    return {
        "message": "Manual draft purchase order created successfully.",
        "po_id": new_po.po_id,
        "is_new": True,
    }


# ------------------ Open/Synchronize a draft Purchase Order ----------------- #
@router.get("/{po_id}/items", response_model=list[PurchaseOrderItemResponse])
async def get_purchase_order_items(
    po_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker(
            [
                UserRole.ADMIN,
                UserRole.INVENTORY_MANAGER,
            ]
        )
    ),
):
    # 1. Fetch PO and pre-load existing items with their core product attributes
    po = await crud_po.get_purchase_order_with_poi(db, po_id)

    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")

    # Track items that are already in this purchase order
    existing_poi_item_ids = {poi.item_id for poi in po.purchaseorderitems}

    # 2. Get the up-to-the-minute active stock alerts for this supplier
    current_low_stock_items = await crud_item.get_items_with_active_stock_alerts(
        db, po.supplier_id
    )
    if not current_low_stock_items:
        current_low_stock_items = []

    # Create a quick look-up set of item IDs that currently need a reorder
    active_alert_item_ids = {item.item_id for item in current_low_stock_items}

    # 3. Identify alert items that have NOT yet been added to this draft
    missing_poicreate_payload = []
    for item in current_low_stock_items:
        if item.item_id not in existing_poi_item_ids:
            missing_poicreate_payload.append(
                PurchaseOrderItemCreate(
                    item_id=item.item_id,
                    quantity=item.reorder_quantity,
                    unit_price=item.cost_price,
                )
            )

    # 4. If new alerts are found that aren't in the draft yet, save them in bulk
    if missing_poicreate_payload:
        await crud_po.create_purchase_order_items_bulk(
            db, missing_poicreate_payload, po_id
        )
        # Re-fetch the PO so SQLAlchemy catches the updated list with loaded items
        po = await crud_po.get_purchase_order_with_poi(db, po_id)
        if not po:
            raise HTTPException(status_code=404, detail="Purchase Order not found.")

    # 5. Map the fully synchronized rows cleanly into your flat response schema
    return [
        PurchaseOrderItemResponse(
            item_id=poi.item_id,
            quantity=poi.quantity,
            unit_price=poi.unit_price,
            poi_id=poi.poi_id,
            po_id=poi.po_id,
            item_name=poi.item.item_name,
            # active stock alerts, it means it has been restocked elsewhere!
            is_stale_alert=poi.item_id not in active_alert_item_ids,
        )
        for poi in po.purchaseorderitems
    ]


# ---------------------- Add a single item/row in draft ---------------------- #
@router.post(
    "/{po_id}/items", response_model=PurchaseOrderItemResponse, status_code=201
)
async def add_single_item_to_po(
    po_id: uuid.UUID,
    payload: PurchaseOrderItemCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker(
            [
                UserRole.ADMIN,
                UserRole.INVENTORY_MANAGER,
            ]
        )
    ),
):
    # 1. Fetch the target Purchase Order to verify its type and supplier
    po = await crud_po.get_purchase_order_by_id(db, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")

    if po.po_type != POType.DRAFT:
        raise HTTPException(
            status_code=400, detail="Cannot add items to a finalized purchase order."
        )

    # 2. Crucial Validation: Verify the item exists and belongs to this PO's supplier
    item = await crud_item.get_item_by_item_id(db, payload.item_id)

    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")
    if not item.is_active:
        raise HTTPException(
            status_code=400, detail="Cannot add an inactive item to the purchase order."
        )
    if item.supplier_id != po.supplier_id:
        raise HTTPException(
            status_code=400,
            detail="This item does not belong to the supplier assigned to this purchase order.",
        )

    # 3. Check if the item is already in the draft PO to prevent redundancy
    existing_pois = await crud_po.get_purchase_order_items_by_po_id(db, po_id)

    if existing_pois is None:
        existing_pois = []

    if any(poi.item_id == payload.item_id for poi in existing_pois):
        raise HTTPException(
            status_code=400,
            detail="This item is already included in the purchase order.",
        )

    # 4. Save the single row to the database
    new_pois = await crud_po.create_purchase_order_items_bulk(db, [payload], po_id)
    new_poi = new_pois[0]

    # 5. Return the record mapped to your flat PurchaseOrderItemResponse schema
    return PurchaseOrderItemResponse(
        item_id=new_poi.item_id,
        quantity=new_poi.quantity,
        unit_price=new_poi.unit_price,
        poi_id=new_poi.poi_id,
        po_id=new_poi.po_id,
        item_name=item.item_name,
    )


# ----------------- Bulk Update Items in a Draft PO ---------------- #
@router.patch("/{po_id}/items/bulk-update", status_code=200)
async def bulk_patch_po_items(
    po_id: uuid.UUID,
    payload: list[PurchaseOrderItemUpdate],
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker(
            [
                UserRole.ADMIN,
                UserRole.INVENTORY_MANAGER,
            ]
        )
    ),
):
    # 1. Verify the targeted purchase order exists
    po = await crud_po.get_purchase_order_by_id(db, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")

    # 2. Enforce editing rules: Finalized orders cannot be mutated
    if po.po_type != POType.DRAFT:
        raise HTTPException(
            status_code=400,
            detail="Cannot update items on a finalized or generated purchase order.",
        )

    # 3. Execute the high-performance bulk update
    updated_count = await crud_po.update_purchase_order_items_bulk(db, po_id, payload)

    # 4. If the payload items don't map to actual database rows for this PO, alert the client
    if updated_count == 0 and payload:
        raise HTTPException(
            status_code=400,
            detail="No matching items were found or updated for this purchase order.",
        )

    return {
        "message": "Purchase order items updated successfully.",
        "updated_rows_count": updated_count,
    }


# ---------------------------- Delete a single poi --------------------------- #
@router.delete("/items/{poi_id}", status_code=200)
async def delete_single_po_item(
    poi_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker(
            [
                UserRole.ADMIN,
                UserRole.INVENTORY_MANAGER,
            ]
        )
    ),
):
    result = await crud_po.get_purchase_order_item_by_poi_id(db, poi_id)
    if not result:
        raise HTTPException(status_code=404, detail="Purchase Order Item not found.")
    await crud_po.delete_purchase_order_item(db, poi_id)
    return {"message": "Line item removed successfully."}


# ------------------- Endpoint for delete a purchase order ------------------- #
@router.delete("/{po_id}", status_code=200)
async def delete_entire_purchase_order(
    po_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker(
            [
                UserRole.ADMIN,
                UserRole.INVENTORY_MANAGER,
            ]
        )
    ),
):
    result = await crud_po.get_purchase_order_by_id(db, po_id)
    if not result:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")
    await crud_po.delete_purchase_order(db, po_id)
    return {"message": "Purchase order and all associated items deleted successfully."}


# ------------------------------- Generate PDF ------------------------------- #
@router.post("/{po_id}/generate", status_code=200)
async def generate_purchase_order(
    po_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker(
            [
                UserRole.ADMIN,
                UserRole.INVENTORY_MANAGER,
            ]
        )
    ),
):
    # 1. Fetch the PO with nested items and core names using your existing CRUD function
    po = await crud_po.get_purchase_order_with_poi(db, po_id)

    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")

    print(
        f"--- DEBUG: My database found {len(po.purchaseorderitems)} items for this PO ---"
    )

    # if po.po_type != POType.DRAFT:
    #     raise HTTPException(
    #         status_code=400,
    #         detail="This purchase order has already been finalized."
    #     )

    if not po.purchaseorderitems:
        raise HTTPException(
            status_code=400, detail="Cannot finalize an empty purchase order."
        )

    # 2. Lock the status by moving it to GENERATED in memory
    po.po_type = POType.GENERATED
    # Commit the status change safely to the database
    await db.commit()

    # 3. Instantiate an in-memory byte buffer stream
    pdf_buffer = io.BytesIO()

    # 4. Write PDF data straight into the RAM stream
    generate_po_pdf_document(output_target=pdf_buffer, po_items=po.purchaseorderitems)

    # 5. Move stream index back to position zero so FastAPI reads from the beginning
    pdf_buffer.seek(0)

    # 6. Stream file directly back to the user's browser download pipeline
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=Purchase_Order_{po_id}.pdf"
        },
    )
