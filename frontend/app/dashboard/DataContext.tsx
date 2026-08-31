"use client";

import React, { createContext, useContext, useState } from "react";
import { apiFetch } from "@/lib/api";

// ── Dashboard API types ────────────────────────────────────
export interface MostSoldItem {
  name: string;
  quantity_sold: number;
}

export interface RecentTransaction {
  transaction_id: string;
  item_id: string;
  item_name: string;
  user_id: string;
  user_name: string;
  transaction_type:
    | "STOCK_IN"
    | "STOCK_OUT"
    | "PURCHASE"
    | "SOLD"
    | "CUSTOMER_RETURN"
    | "DAMAGED"
    | "EXPIRED"
    | "ADJUSTMENT_INCREASE"
    | "ADJUSTMENT_DECREASE";
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  note: string | null;
  transaction_date: string;
}

export interface DashboardData {
  items_in_stock: number | null;
  value_of_item_in_stock: string | null;   // formatted e.g. "12,500.50"
  active_low_stock_alerts: number | null;
  active_out_of_stock_alerts: number | null;
  active_alerts: number | null;
  draft_po_count: number | null;
  sold_value: string | null;               // formatted e.g. "3,200.00"
  sales_trend: string[];                   // 7-element array of formatted decimals
  most_sold_items: MostSoldItem[];
  recent_transaction: RecentTransaction[] | null;
}

// ── Types ──────────────────────────────────────────────────
export interface User {
  id: string;
  fullName: string;
  username: string;
  nic: string;
  email: string;
  phone: string;
  password: string;
  role: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  supplierName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  notes: string;
  totalSupplies: number;
}

export interface Transaction {
  id: string;
  itemId: string;
  item: string;
  type: "Stock in" | "Stock out";
  qty: number; // positive for Stock in, negative for Stock out
  user: string;
  date: string;
  prevQty: number;
  newQty: number;
}

export interface Item {
  id: string;
  sku: string;
  itemName: string;
  description: string;
  category: string;
  supplier: string;
  quantity: number;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  reorderLevel: number;
  reorderQuantity: number;
  active: boolean;
  healthStatus?: "HEALTHY" | "LOW_STOCK" | "CRITICAL";
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DataContextType {
  userList: User[];
  setUserList: React.Dispatch<React.SetStateAction<User[]>>;
  supplierList: Supplier[];
  setSupplierList: React.Dispatch<React.SetStateAction<Supplier[]>>;
  transactionList: Transaction[];
  setTransactionList: React.Dispatch<React.SetStateAction<Transaction[]>>;
  itemList: Item[];
  setItemList: React.Dispatch<React.SetStateAction<Item[]>>;
  categoryList: Category[];
  setCategoryList: React.Dispatch<React.SetStateAction<Category[]>>;

  loggedInUser: User | null;
  setLoggedInUser: React.Dispatch<React.SetStateAction<User | null>>;

  headerActions: React.ReactNode;
  setHeaderActions: React.Dispatch<React.SetStateAction<React.ReactNode>>;

  // Dashboard API data
  dashboardData: DashboardData | null;
  dashboardLoading: boolean;
  fetchDashboard: (forceRefresh?: boolean) => Promise<DashboardData | null>;

  addUser: (u: any) => void;
  saveUserEdit: (u: any) => void;
  deleteUser: (id: string) => void;

  addSupplier: (s: any) => void;
  saveSupplierEdit: (s: any) => void;
  deleteSupplier: (id: string) => void;

  addItem: (item: any) => void;
  saveItemEdit: (item: any) => void;
  deleteItem: (id: string) => void;

  recordTransactions: (
    txs: Array<{ item: string; type: "Stock in" | "Stock out"; qty: number; note?: string }>
  ) => Promise<{ success: boolean; error?: string; completed: number }>;

  fetchCategories: (forceRefresh?: boolean) => Promise<Category[]>;
  fetchSuppliers: (forceRefresh?: boolean) => Promise<Supplier[]>;
  refreshCategories: () => Promise<Category[]>;
  refreshSuppliers: () => Promise<Supplier[]>;
  fetchTransactions: (forceRefresh?: boolean) => Promise<Transaction[]>;
  refreshTransactions: () => Promise<Transaction[]>;
  fetchItems: (forceRefresh?: boolean) => Promise<Item[]>;
  refreshItems: () => Promise<Item[]>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// ── Helpers ─────────────────────────────────────────────────
const getFormattedDateTime = (daysAgo = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

const INIT_USERS: User[] = [];
const INIT_SUPPLIERS: Supplier[] = [];
const INIT_TRANSACTIONS: Transaction[] = [];
export const ALL_ITEMS: string[] = [];
export const INIT_CATEGORIES: Category[] = [];
export const INIT_ITEMS: Item[] = [];

// Helper to get current quantity of an item from a list of transactions
// Falls back to item.quantity from itemList (real DB stock), then 0.
export const getItemCurrentQty = (
  itemName: string,
  transactions: Transaction[],
  items?: Item[]
): number => {
  const latestTx = transactions.find((t) => t.item === itemName);
  if (latestTx) return latestTx.newQty ?? 0;
  if (items) {
    const item = items.find((i) => i.itemName === itemName);
    if (item) return item.quantity;
  }
  return 0;
};

const TTL_MS = 2 * 60 * 1000; // 2 Minutes TTL

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [userList, setUserList] = useState<User[]>([]);
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);
  const [transactionList, setTransactionList] = useState<Transaction[]>([]);
  const [itemList, setItemList] = useState<Item[]>([]);
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);

  // Dashboard API state
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const fetchDashboard = async (forceRefresh = false): Promise<DashboardData | null> => {
    // 1. Check if we have cached data to show immediately
    let hasCache = false;
    if (dashboardData) {
      hasCache = true;
    } else if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("dashboardData");
      if (cached) {
        try {
          const parsed: DashboardData = JSON.parse(cached);
          setDashboardData(parsed);
          hasCache = true;
        } catch {
          sessionStorage.removeItem("dashboardData");
        }
      }
    }

    // Only show global loading state if there is no cache at all to display
    if (!hasCache) {
      setDashboardLoading(true);
    }

    // 2. Fetch fresh data from API to revalidate in background and update screen
    try {
      const data = await apiFetch<DashboardData>("/dashboard/");
      setDashboardData(data);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("dashboardData", JSON.stringify(data));
      }
      return data;
    } catch (err) {
      console.error("Failed to fetch dashboard:", err);
      return dashboardData;
    } finally {
      setDashboardLoading(false);
    }
  };

  // Timestamps for TTL cache
  const [lastFetchedCatsTime, setLastFetchedCatsTime] = useState<number>(0);
  const [lastFetchedSuppsTime, setLastFetchedSuppsTime] = useState<number>(0);

  const fetchCategories = async (forceRefresh = false): Promise<Category[]> => {
    const now = Date.now();
    if (!forceRefresh && categoryList.length > 0 && now - lastFetchedCatsTime < TTL_MS) {
      return categoryList;
    }
    try {
      const catsData = await apiFetch<any[]>("/categories/");
      const mappedCats: Category[] = catsData.map((c: any) => ({
        id: c.category_id,
        name: c.category_name,
        description: c.description || "",
        active: c.is_active ?? true,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));
      setCategoryList(mappedCats);
      setLastFetchedCatsTime(now);
      return mappedCats;
    } catch (err) {
      console.error("Failed to fetch categories:", err);
      return categoryList;
    }
  };

  const fetchSuppliers = async (forceRefresh = false): Promise<Supplier[]> => {
    const now = Date.now();
    if (!forceRefresh && supplierList.length > 0 && now - lastFetchedSuppsTime < TTL_MS) {
      return supplierList;
    }
    try {
      const suppsData = await apiFetch<any[]>("/suppliers/");
      const mappedSupps: Supplier[] = suppsData.map((s: any) => ({
        id: s.supplier_id,
        supplierName: s.supplier_name,
        contactPerson: s.contact_person,
        phone: s.phone,
        email: s.email,
        address: s.address,
        active: s.is_active ?? true,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        notes: s.notes || "",
        totalSupplies: s.total_supplies || 0,
      }));
      setSupplierList(mappedSupps);
      setLastFetchedSuppsTime(now);
      return mappedSupps;
    } catch (err) {
      console.error("Failed to fetch suppliers:", err);
      return supplierList;
    }
  };

  const [lastFetchedTxsTime, setLastFetchedTxsTime] = useState<number>(0);

  const fetchTransactions = async (forceRefresh = false): Promise<Transaction[]> => {
    const now = Date.now();
    if (!forceRefresh && transactionList.length > 0 && now - lastFetchedTxsTime < TTL_MS) {
      return transactionList;
    }
    try {
      const txData = await apiFetch<any[]>("/transaction/");
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const pad = (n: number) => n.toString().padStart(2, "0");
      const formatDate = (iso: string) => {
        const d = new Date(iso);
        return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };

      const mapped: Transaction[] = txData.map((res: any) => {
        const isIn = res.transaction_type === "STOCK_IN";
        const matchedItem = itemList.find((i) => i.id === res.item_id);
        const itemName = res.item_name || matchedItem?.itemName || "Item";
        const userEntry = userList.find((u) => u.id === res.user_id);
        const userName = res.user_name || userEntry?.fullName || (res.user_id === loggedInUser?.id ? (loggedInUser?.fullName || "You") : "User");

        return {
          id: res.transaction_id,
          itemId: res.item_id,
          item: itemName,
          type: isIn ? "Stock in" : "Stock out",
          qty: isIn ? res.quantity : -res.quantity,
          user: userName,
          date: formatDate(res.transaction_date),
          prevQty: res.previous_quantity,
          newQty: res.new_quantity,
        };
      });

      setTransactionList(mapped);
      setLastFetchedTxsTime(now);
      return mapped;
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
      return transactionList;
    }
  };

  const [lastFetchedItemsTime, setLastFetchedItemsTime] = useState<number>(0);

  const fetchItems = async (forceRefresh = false): Promise<Item[]> => {
    const now = Date.now();
    if (!forceRefresh && itemList.length > 0 && now - lastFetchedItemsTime < TTL_MS) {
      return itemList;
    }
    try {
      const data = await apiFetch<any[]>("/items/");
      const mapped: Item[] = data.map((item: any) => ({
        id: item.item_id,
        sku: item.sku,
        itemName: item.item_name,
        description: item.description || "",
        category: item.category_name || "",
        supplier: item.supplier_name || "",
        quantity: item.quantity_in_stock,
        unit: item.unit,
        costPrice: item.cost_price ?? null,
        sellingPrice: item.selling_price,
        reorderLevel: item.reorder_level,
        reorderQuantity: item.reorder_quantity,
        active: item.is_active,
        healthStatus: item.health_status || (item.quantity_in_stock <= 0 ? "CRITICAL" : item.quantity_in_stock <= item.reorder_level ? "LOW_STOCK" : "HEALTHY"),
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));
      setItemList(mapped);
      setLastFetchedItemsTime(now);
      return mapped;
    } catch (err) {
      console.error("Failed to fetch items:", err);
      return itemList;
    }
  };

  const refreshCategories = () => fetchCategories(true);
  const refreshSuppliers = () => fetchSuppliers(true);
  const refreshTransactions = () => fetchTransactions(true);
  const refreshItems = () => fetchItems(true);

  // Operations
  const addUser = (u: any) => {
    const nu = {
      ...u,
      id: `USR-${1000 + userList.length}`,
      createdAt: getFormattedDateTime().replace("T", " "),
      updatedAt: getFormattedDateTime().replace("T", " "),
    } as User;
    setUserList((prev) => [nu, ...prev]);
  };

  const saveUserEdit = (updatedUser: any) => {
    updatedUser.updatedAt = getFormattedDateTime().replace("T", " ");
    const savedUser = updatedUser as User;
    setUserList((prev) =>
      prev.map((x) => (x.id === savedUser.id ? savedUser : x))
    );
  };

  const deleteUser = (id: string) => {
    setUserList((prev) => prev.filter((u) => u.id !== id));
  };

  const addSupplier = (s: any) => {
    const ns = {
      ...s,
      id: `SPL-${1000 + supplierList.length}`,
      createdAt: getFormattedDateTime().replace("T", " "),
      updatedAt: getFormattedDateTime().replace("T", " "),
    } as Supplier;
    setSupplierList((prev) => [ns, ...prev]);
  };

  const saveSupplierEdit = (updatedSupplier: any) => {
    updatedSupplier.updatedAt = getFormattedDateTime().replace("T", " ");
    const savedSupplier = updatedSupplier as Supplier;
    setSupplierList((prev) =>
      prev.map((x) => (x.id === savedSupplier.id ? savedSupplier : x))
    );
  };

  const deleteSupplier = (id: string) => {
    setSupplierList((prev) => prev.filter((s) => s.id !== id));
  };

  const addItem = (item: any) => {
    const ni = {
      ...item,
      id: `ITM-${1000 + itemList.length + 1}`,
      createdAt: getFormattedDateTime().replace("T", " "),
      updatedAt: getFormattedDateTime().replace("T", " "),
    } as Item;
    setItemList((prev) => [ni, ...prev]);
  };

  const saveItemEdit = (updatedItem: any) => {
    updatedItem.updatedAt = getFormattedDateTime().replace("T", " ");
    const savedItem = updatedItem as Item;
    setItemList((prev) =>
      prev.map((x) => (x.id === savedItem.id ? savedItem : x))
    );
  };

  const deleteItem = (id: string) => {
    setItemList((prev) => prev.filter((x) => x.id !== id));
  };

  const recordTransactions = async (
    txs: Array<{ item: string; type: "Stock in" | "Stock out"; qty: number; note?: string }>
  ): Promise<{ success: boolean; error?: string; completed: number }> => {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const pad = (n: number) => n.toString().padStart(2, "0");
    const formatDate = (iso: string) => {
      const d = new Date(iso);
      return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const newTxRecords: Transaction[] = [];
    let completed = 0;

    for (const tx of txs) {
      // Find item by name to get its UUID
      const matchedItem = itemList.find((i) => i.itemName === tx.item);
      if (!matchedItem) {
        return { success: false, error: `Item not found: "${tx.item}"`, completed };
      }

      try {
        const res = await apiFetch<any>("/transaction/", {
          method: "POST",
          body: JSON.stringify({
            item_id: matchedItem.id,
            transaction_type: tx.type === "Stock in" ? "STOCK_IN" : "STOCK_OUT",
            quantity: tx.qty,
            note: tx.note ?? null,
          }),
        });

        // Map response to Transaction
        const isIn = res.transaction_type === "STOCK_IN";
        const userEntry = userList.find((u) => u.id === res.user_id);
        const userName = res.user_name || userEntry?.fullName || loggedInUser?.fullName || "You";

        const newRecord: Transaction = {
          id: res.transaction_id,
          itemId: res.item_id,
          item: tx.item,
          type: isIn ? "Stock in" : "Stock out",
          qty: isIn ? res.quantity : -res.quantity,
          user: userName,
          date: formatDate(res.transaction_date),
          prevQty: res.previous_quantity,
          newQty: res.new_quantity,
        };

        newTxRecords.push(newRecord);
        // Also update the item's quantity in itemList so projected stock is correct within this batch
        setItemList((prev) =>
          prev.map((i) =>
            i.id === matchedItem.id ? { ...i, quantity: res.new_quantity } : i
          )
        );
        completed++;
      } catch (err: any) {
        const msg = err?.message || "Unknown error";
        return { success: false, error: `"${tx.item}": ${msg}`, completed };
      }
    }

    setTransactionList((prev) => [...newTxRecords.reverse(), ...prev]);
    fetchDashboard(true);
    return { success: true, completed };
  };

  return (
    <DataContext.Provider
      value={{
        userList,
        setUserList,
        supplierList,
        setSupplierList,
        transactionList,
        setTransactionList,
        itemList,
        setItemList,
        categoryList,
        setCategoryList,
        loggedInUser,
        setLoggedInUser,
        headerActions,
        setHeaderActions,
        dashboardData,
        dashboardLoading,
        fetchDashboard,
        addUser,
        saveUserEdit,
        deleteUser,
        addSupplier,
        saveSupplierEdit,
        deleteSupplier,
        addItem,
        saveItemEdit,
        deleteItem,
        recordTransactions,
        fetchCategories,
        fetchSuppliers,
        refreshCategories,
        refreshSuppliers,
        fetchTransactions,
        refreshTransactions,
        fetchItems,
        refreshItems,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
