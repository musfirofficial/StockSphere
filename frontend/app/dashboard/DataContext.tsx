"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

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
    txs: Array<{ item: string; type: "Stock in" | "Stock out"; qty: number }>,
    currentUser: string
  ) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// ── Mock Data Helper ────────────────────────────────────────
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
export const getItemCurrentQty = (
  itemName: string,
  transactions: Transaction[]
): number => {
  const latestTx = transactions.find((t) => t.item === itemName);
  return latestTx ? latestTx.newQty ?? 0 : 500; // baseline of 500 units if no transaction history
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [userList, setUserList] = useState<User[]>([]);
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);
  const [transactionList, setTransactionList] = useState<Transaction[]>([]);
  const [itemList, setItemList] = useState<Item[]>([]);
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Fetch initial data from FastAPI backend
  const fetchAllBackendData = async () => {
    try {
      const [items, categories, suppliers] = await Promise.allSettled([
        apiFetch<any[]>("/items/"),
        apiFetch<any[]>("/categories/"),
        apiFetch<any[]>("/suppliers/"),
      ]);

      if (items.status === "fulfilled") {
        const formattedItems: Item[] = items.value.map((i: any) => ({
          id: i.item_id,
          sku: i.sku,
          itemName: i.item_name,
          description: i.description || "",
          category: i.category_id,
          supplier: i.supplier_id,
          quantity: i.quantity_in_stock,
          unit: i.unit,
          costPrice: i.cost_price,
          sellingPrice: i.selling_price,
          reorderLevel: i.reorder_level,
          reorderQuantity: i.reorder_quantity,
          active: i.is_active,
          createdAt: i.created_at,
          updatedAt: i.updated_at,
        }));
        setItemList(formattedItems);
      }

      if (categories.status === "fulfilled") {
        const formattedCategories: Category[] = categories.value.map((c: any) => ({
          id: c.category_id,
          name: c.category_name,
          description: c.description || "",
          active: true,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        }));
        setCategoryList(formattedCategories);
      }

      if (suppliers.status === "fulfilled") {
        const formattedSuppliers: Supplier[] = suppliers.value.map((s: any) => ({
          id: s.supplier_id,
          supplierName: s.supplier_name,
          contactPerson: s.contact_person || "",
          phone: s.phone || "",
          email: s.email || "",
          address: s.address || "",
          active: s.is_active,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          notes: s.notes || "",
          totalSupplies: 0,
        }));
        setSupplierList(formattedSuppliers);
      }
    } catch (e) {
      console.error("Failed fetching background data:", e);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    fetchAllBackendData();
  }, []);

  // Save changes to local storage
  useEffect(() => {
    if (!loaded) return;
    sessionStorage.setItem("userList", JSON.stringify(userList));
  }, [userList, loaded]);

  useEffect(() => {
    if (!loaded) return;
    sessionStorage.setItem("supplierList", JSON.stringify(supplierList));
  }, [supplierList, loaded]);

  useEffect(() => {
    if (!loaded) return;
    sessionStorage.setItem("transactionList", JSON.stringify(transactionList));
  }, [transactionList, loaded]);

  useEffect(() => {
    if (!loaded) return;
    sessionStorage.setItem("itemList", JSON.stringify(itemList));
  }, [itemList, loaded]);

  useEffect(() => {
    if (!loaded) return;
    sessionStorage.setItem("categoryList", JSON.stringify(categoryList));
  }, [categoryList, loaded]);

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

  const recordTransactions = (
    txs: Array<{ item: string; type: "Stock in" | "Stock out"; qty: number }>,
    currentUser: string
  ) => {
    // Current Local time formatting: 12 Jul 14:10
    const now = new Date();
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const pad = (n: number) => n.toString().padStart(2, "0");
    const dateStr = `${pad(now.getDate())} ${months[now.getMonth()]} ${pad(
      now.getHours()
    )}:${pad(now.getMinutes())}`;

    // Note: We need to calculate each sequentially because one transaction might affect the next if they're for the same item.
    // However, to keep it simple, we retrieve the start states, apply cumulative changes per item.
    let tempTransactions = [...transactionList];
    const newTxRecords: Transaction[] = [];

    txs.forEach((tx, idx) => {
      const prevQty = getItemCurrentQty(tx.item, tempTransactions);
      const qtyChange = tx.type === "Stock in" ? tx.qty : -tx.qty;
      const newQty = prevQty + qtyChange;

      const newRecord: Transaction = {
        id: `TX-${2292 + tempTransactions.length}`,
        item: tx.item,
        type: tx.type,
        qty: qtyChange,
        user: currentUser || "R. Fernando",
        date: dateStr,
        prevQty,
        newQty,
      };

      newTxRecords.push(newRecord);
      tempTransactions = [newRecord, ...tempTransactions];
    });

    setTransactionList((prev) => [...newTxRecords, ...prev]);
  };

  if (!loaded) {
    return null;
  }

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
