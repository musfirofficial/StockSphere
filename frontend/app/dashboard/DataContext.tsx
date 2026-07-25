"use client";

import React, { createContext, useContext, useState } from "react";
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
    txs: Array<{ item: string; type: "Stock in" | "Stock out"; qty: number; note?: string }>
  ) => Promise<{ success: boolean; error?: string; completed: number }>;
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

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [userList, setUserList] = useState<User[]>([]);
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);
  const [transactionList, setTransactionList] = useState<Transaction[]>([]);
  const [itemList, setItemList] = useState<Item[]>([]);
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);

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
        // Get logged-in user's name from userList
        const userEntry = userList.find((u) => u.id === res.user_id);
        const userName = userEntry?.fullName ?? "You";

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
