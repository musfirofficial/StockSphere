"use client";

import React from "react";
import { useTheme } from "../ThemeContext";
import { useData } from "../DataContext";
import PurchaseOrders from "../PurchaseOrders";

export default function PurchaseOrdersRoute() {
  const { c } = useTheme();
  const { supplierList } = useData();

  return <PurchaseOrders c={c} supplierList={supplierList} />;
}
