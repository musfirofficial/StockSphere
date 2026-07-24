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
  const [loaded, setLoaded] = useState(false);

  // Fetch initial data from FastAPI backend
  const fetchAllBackendData = async () => {
    try {
      const [items, categories, suppliers, users, transactions] = await Promise.allSettled([
        apiFetch<any[]>("/items/"),
        apiFetch<any[]>("/categories/"),
        apiFetch<any[]>("/suppliers/"),
        apiFetch<any[]>("/users/"),
        apiFetch<any[]>("/transaction/"),
      ]);

      let formattedCategories: Category[] = [];
      if (categories.status === "fulfilled") {
        formattedCategories = categories.value.map((c: any) => ({
          id: c.category_id,
          name: c.category_name,
          description: c.description || "",
          active: true,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        }));
        setCategoryList(formattedCategories);
      }

      let formattedSuppliers: Supplier[] = [];
      if (suppliers.status === "fulfilled") {
        formattedSuppliers = suppliers.value.map((s: any) => ({
          id: s.supplier_id,
          supplierName: s.supplier_name,
          contactPerson: s.contact_person || "",
          phone: s.phone || "",
          email: s.email || "",
          address: s.address || "",
          active: s.is_active ?? true,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          notes: s.notes || "",
          totalSupplies: s.total_supplies || 0,
        }));
        setSupplierList(formattedSuppliers);
      }

      // ── Users ──
      let userMap = new Map<string, string>(); // user_id -> full_name
      if (users.status === "fulfilled") {
        const formattedUsers: User[] = users.value.map((u: any) => ({
          id: u.user_id,
          fullName: u.full_name,
          username: u.user_name,
          nic: u.nic,
          email: u.email,
          phone: u.phone,
          password: "",
          role: u.role,
          active: u.is_active,
          createdAt: u.created_at,
          updatedAt: u.updated_at,
        }));
        setUserList(formattedUsers);
        userMap = new Map(formattedUsers.map((u) => [u.id, u.fullName]));
      }

      // ── Items ──
      let formattedItems: Item[] = [];
      if (items.status === "fulfilled") {
        const catMap = new Map(formattedCategories.map((c) => [c.id, c.name]));
        const suppMap = new Map(formattedSuppliers.map((s) => [s.id, s.supplierName]));

        formattedItems = items.value.map((i: any) => {
          const categoryName = catMap.get(i.category_id) || i.category_name || i.category_id;
          const supplierName = suppMap.get(i.supplier_id) || i.supplier_name || i.supplier_id;

          return {
            id: i.item_id,
            sku: i.sku,
            itemName: i.item_name,
            description: i.description || "",
            category: categoryName,
            supplier: supplierName,
            quantity: i.quantity_in_stock,
            unit: i.unit,
            costPrice: i.cost_price,
            sellingPrice: i.selling_price,
            reorderLevel: i.reorder_level,
            reorderQuantity: i.reorder_quantity,
            active: i.is_active,
            createdAt: i.created_at,
            updatedAt: i.updated_at,
          };
        });
        setItemList(formattedItems);
      }

      // ── Transactions ──
      if (transactions.status === "fulfilled") {
        const itemIdMap = new Map(formattedItems.map((i) => [i.id, i.itemName]));
        const formatDate = (iso: string) => {
          const d = new Date(iso);
          const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          const pad = (n: number) => n.toString().padStart(2, "0");
          return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };
        const formattedTransactions: Transaction[] = transactions.value.map((t: any) => {
          const isIn = t.transaction_type === "STOCK_IN";
          const itemName = itemIdMap.get(t.item_id) || t.item_id;
          const userName = userMap.get(t.user_id) || "Unknown";
          return {
            id: t.transaction_id,
            itemId: t.item_id,
            item: itemName,
            type: isIn ? "Stock in" : "Stock out",
            qty: isIn ? t.quantity : -t.quantity,
            user: userName,
            date: formatDate(t.transaction_date),
            prevQty: t.previous_quantity,
            newQty: t.new_quantity,
          };
        });
        // Sort newest first using raw ISO dates
        const rawDates = new Map<string, string>(
          transactions.value.map((t: any) => [t.transaction_id, t.transaction_date])
        );
        formattedTransactions.sort(
          (a, b) => new Date(rawDates.get(b.id) ?? 0).getTime() - new Date(rawDates.get(a.id) ?? 0).getTime()
        );
        setTransactionList(formattedTransactions);
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
