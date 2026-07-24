import io

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen import canvas


# ---------------------------------------------------------------------------- #
#                            Purchase Order generate                           #
# ---------------------------------------------------------------------------- #
class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to handle dynamic page numbers cleanly.
    """

    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()  # type: ignore

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()

        # 1. Top dark blue accent bar
        self.setFillColor(colors.HexColor("#42578A"))
        self.rect(0, A4[1] - 8 * mm, A4[0], 8 * mm, fill=1, stroke=0)

        # 2. Global Footer text (Updated to your production details)
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#64748B"))
        footer_text = "If you have any questions about this purchase order, please contact Homerex, 077 777 7777"
        self.drawCentredString(A4[0] / 2.0, 15 * mm, footer_text)

        # 3. Dynamic page numbers
        current_page = self.getPageNumber()
        page_num_str = f"Page {current_page} of {page_count}"
        self.drawRightString(A4[0] - 15 * mm, 15 * mm, page_num_str)

        self.restoreState()


def generate_po_pdf_document(output_target: io.BytesIO, po_items: list):
    doc = SimpleDocTemplate(
        output_target,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=20 * mm,
        bottomMargin=25 * mm,
    )

    # Custom Brand Typography Stylesheet
    style_company_name = ParagraphStyle(
        "CompanyHeader",
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=18,
        textColor=colors.HexColor("#1E293B"),
    )
    style_company_details = ParagraphStyle(
        "CompanyDetails",
        fontName="Helvetica",
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#475569"),
    )
    style_po_title = ParagraphStyle(
        "POTitle",
        fontName="Helvetica-Bold",
        fontSize=28,
        leading=32,
        alignment=2,
        textColor=colors.HexColor("#42578A"),
    )
    style_vendor_header = ParagraphStyle(
        "VendorHeader",
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.white,
    )
    style_vendor_details = ParagraphStyle(
        "VendorDetails",
        fontName="Helvetica",
        fontSize=10,
        leading=15,
        textColor=colors.HexColor("#334155"),
    )
    style_th = ParagraphStyle(
        "TableHeader",
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=12,
        textColor=colors.white,
        alignment=1,
    )
    style_td_center = ParagraphStyle(
        "TableCellCenter", fontName="Helvetica", fontSize=9.5, leading=13, alignment=1
    )
    style_td_left = ParagraphStyle(
        "TableCellLeft", fontName="Helvetica", fontSize=9.5, leading=13, alignment=0
    )
    style_td_right = ParagraphStyle(
        "TableCellRight", fontName="Helvetica", fontSize=9.5, leading=13, alignment=2
    )

    elements = []

    # ------------------ 1. TOP HEADER BRAND BLOCK ------------------
    header_data = [
        [
            Paragraph("HOMEREX", style_company_name),
            Paragraph("PURCHASE ORDER", style_po_title),
        ],
        # Kept row padding and margins tight to minimize spacing before details
        [
            Paragraph(
                "[Street Address]<br/>[Email]<br/>Phone: (000) 000-0000",
                style_company_details,
            ),
            "",
        ],
    ]
    header_table = Table(header_data, colWidths=[100 * mm, 80 * mm])
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, 1), "RIGHT"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 1), (-1, 1), 2),  # Pulls details closer to the title
            ]
        )
    )
    elements.append(header_table)
    elements.append(Spacer(1, 15))

    # ------------------ 2. VENDOR DETAILS BLOCK ------------------
    vendor_title_table = Table(
        [[Paragraph("VENDOR", style_vendor_header)]], colWidths=[75 * mm], hAlign="LEFT"
    )
    vendor_title_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#42578A")),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(vendor_title_table)

    # Added hAlign='LEFT' here as well
    vendor_details_table = Table(
        [
            [
                Paragraph(
                    "[Supplier Name]<br/>[Contact Person]<br/>[Street Address]<br/>Phone: 000 000 0000",
                    style_vendor_details,
                )
            ]
        ],
        colWidths=[75 * mm],
        hAlign="LEFT",
    )
    vendor_details_table.setStyle(
        TableStyle(
            [
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(vendor_details_table)
    elements.append(Spacer(1, 20))

    # ------------------ 3. DYNAMIC DATA GRID BLOCK ------------------
    grid_data = [
        [
            Paragraph("NO", style_th),
            Paragraph("ITEM", style_th),
            Paragraph("QTY", style_th),
            Paragraph("UNIT PRICE", style_th),
            Paragraph("TOTAL", style_th),
        ]
    ]

    subtotal = 0.0

    for index, poi in enumerate(po_items, start=1):
        qty_val = int(poi.quantity) if poi.quantity is not None else 0
        price_val = float(poi.unit_price) if poi.unit_price is not None else 0.0
        line_total = qty_val * price_val
        subtotal += line_total

        name_val = "Item Details Unloaded"
        if hasattr(poi, "item") and poi.item is not None:
            name_val = str(getattr(poi.item, "item_name", "Unnamed Item"))

        grid_data.append(
            [
                Paragraph(str(index), style_td_center),
                Paragraph(name_val, style_td_left),
                Paragraph(str(qty_val), style_td_center),
                Paragraph(f"{price_val:,.2f}", style_td_right),
                Paragraph(f"{line_total:,.2f}", style_td_right),
            ]
        )

    col_widths = [15 * mm, 85 * mm, 23 * mm, 27 * mm, 30 * mm]
    items_table = Table(grid_data, colWidths=col_widths, repeatRows=1)

    grid_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#42578A")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#1E293B")),
    ]

    for row in range(1, len(grid_data)):
        if row % 2 == 0:
            grid_style.append(
                ("BACKGROUND", (0, row), (-1, row), colors.HexColor("#F1F5F9"))
            )
        else:
            grid_style.append(("BACKGROUND", (0, row), (-1, row), colors.white))

    items_table.setStyle(TableStyle(grid_style))
    elements.append(items_table)

    # ------------------ 4. TOTALS SUMMARY BLOCK ------------------
    summary_data = [
        [
            Paragraph("SUBTOTAL", style_td_center),
            Paragraph(f"{subtotal:,.2f}", style_td_right),
        ],
        [Paragraph("OTHER", style_td_center), Paragraph("-", style_td_right)],
        [
            Paragraph("TOTAL", style_th),
            Paragraph(f"Rs. {subtotal:,.2f}", style_td_right),
        ],
    ]

    summary_table = Table(summary_data, colWidths=[27 * mm, 30 * mm])
    summary_table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#1E293B")),
                ("BACKGROUND", (0, 2), (0, 2), colors.HexColor("#42578A")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )

    wrapper_table = Table([["", summary_table]], colWidths=[123 * mm, 57 * mm])
    wrapper_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    elements.append(wrapper_table)

    doc.build(elements, canvasmaker=NumberedCanvas)
