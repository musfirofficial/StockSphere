"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

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

  recordTransactions: (txs: Array<{ item: string; type: "Stock in" | "Stock out"; qty: number }>, currentUser: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// ── Mock Data Helper ────────────────────────────────────────
const getFormattedDateTime = (daysAgo = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const ROLES = ["Admin", "Manager", "Staff", "Auditor"];
const FIRSTS = [
  "Ravindu", "Nimasha", "Kasun", "Tharindu", "Dilani", "Sachini", "Chamod",
  "Imesha", "Lahiru", "Hashini", "Pasindu", "Aruni", "Sanjaya", "Dinithi",
  "Roshan", "Vidumini", "Thisara", "Nethmi", "Janith", "Kavindi", "Buddhika",
  "Senuri", "Madushan", "Oshadi", "Yohan"
];
const LASTS = [
  "Fernando", "Perera", "Jayawardena", "Silva", "Bandara", "Rathnayake",
  "Wickramasinghe", "Gunasekara", "Dissanayake", "Kumara", "Senanayake",
  "Wijesinghe", "Karunaratne", "Abeysekara", "Liyanage"
];

const INIT_USERS: User[] = Array.from({ length: 24 }, (_, i) => {
  const f = FIRSTS[i % FIRSTS.length],
    l = LASTS[(i * 3) % LASTS.length];
  const username = `${f.toLowerCase()}.${l.toLowerCase()}`;
  const birthYear = 1990 + (i % 12);
  const nic = `${birthYear}${(200000 + i * 4923).toString().substring(0, 8)}`;
  const phone = `+94 77 ${1000000 + i * 4293}`;

  return {
    id: `USR-${1000 + i}`,
    fullName: `${f} ${l}`,
    username: username,
    nic: nic,
    email: `${username}@stocksphere.com`,
    phone: phone,
    password: "password123",
    role: ROLES[i % ROLES.length],
    active: i % 5 !== 0,
    createdAt: getFormattedDateTime(20 - i).replace("T", " "),
    updatedAt: getFormattedDateTime(1).replace("T", " "),
  };
});

const INIT_SUPPLIERS: Supplier[] = [
  {
    id: "SPL-1001",
    supplierName: "Lanka Steel Supplies",
    contactPerson: "Amal Silva",
    phone: "+94 71 234 5678",
    email: "info@lankasteel.lk",
    address: "123, Kandy Road, Yakkala",
    active: true,
    createdAt: "2026-06-01 09:00",
    updatedAt: "2026-07-10 14:30",
    notes: "Primary steel and hardware parts supplier. Reliable delivery.",
    totalSupplies: 142,
  },
  {
    id: "SPL-1002",
    supplierName: "Ceylon Agro Industries",
    contactPerson: "Nimasha Perera",
    phone: "+94 77 987 6543",
    email: "sales@ceylonagro.com",
    address: "45, Galle Road, Colombo 03",
    active: true,
    createdAt: "2026-06-05 10:15",
    updatedAt: "2026-07-08 11:20",
    notes: "Packaging and raw agricultural products.",
    totalSupplies: 89,
  },
  {
    id: "SPL-1003",
    supplierName: "Colombo Logistics Partners",
    contactPerson: "Roshan Fernando",
    phone: "+94 11 234 9900",
    email: "contact@colombologistics.lk",
    address: "88, Harbor Rd, Colombo 13",
    active: false,
    createdAt: "2026-05-20 08:30",
    updatedAt: "2026-06-15 16:45",
    notes: "Logistics and shipping agent. Temporarily inactive.",
    totalSupplies: 45,
  },
  {
    id: "SPL-1004",
    supplierName: "Royal Packaging Ltd",
    contactPerson: "Kasun Jayawardena",
    phone: "+94 72 345 6789",
    email: "kasun@royalpkg.com",
    address: "Plot B4, EPZ, Biyagama",
    active: true,
    createdAt: "2026-06-10 11:00",
    updatedAt: "2026-07-09 09:10",
    notes: "Corrugated boxes and packing materials supplier.",
    totalSupplies: 210,
  },
  {
    id: "SPL-1005",
    supplierName: "Apex Tools & Hardware",
    contactPerson: "Tharindu Silva",
    phone: "+94 76 111 2222",
    email: "sales@apextools.lk",
    address: "310, Negombo Road, Wattala",
    active: true,
    createdAt: "2026-06-12 14:00",
    updatedAt: "2026-07-11 15:30",
    notes: "Hand tools, power tools and safety gear supplier.",
    totalSupplies: 76,
  },
  {
    id: "SPL-1006",
    supplierName: "Premier Electricals",
    contactPerson: "Dilani Rathnayake",
    phone: "+94 77 444 5555",
    email: "dilani@premierelectricals.lk",
    address: "15, First Lane, Colombo 05",
    active: true,
    createdAt: "2026-06-15 15:30",
    updatedAt: "2026-07-01 10:00",
    notes: "Cables, LED panels and wiring accessories.",
    totalSupplies: 115,
  },
  {
    id: "SPL-1007",
    supplierName: "Nippon Paint Lanka",
    contactPerson: "Sachini Kumara",
    phone: "+94 11 555 6666",
    email: "info@nipponlanka.lk",
    address: "56A, Industrial Zone, Kesbewa",
    active: true,
    createdAt: "2026-06-18 09:30",
    updatedAt: "2026-07-05 13:40",
    notes: "Industrial paints and coatings provider.",
    totalSupplies: 64,
  },
  {
    id: "SPL-1008",
    supplierName: "Global Chemical Distributors",
    contactPerson: "Chamod Senanayake",
    phone: "+94 77 777 8888",
    email: "contact@globalchem.com",
    address: "202, Baseline Road, Borella",
    active: false,
    createdAt: "2026-06-20 10:45",
    updatedAt: "2026-06-30 11:15",
    notes: "Chemical cleaning solutions and solvents supplier.",
    totalSupplies: 18,
  },
  {
    id: "SPL-1009",
    supplierName: "Precision Plastics",
    contactPerson: "Imesha Wijesinghe",
    phone: "+94 71 888 9999",
    email: "sales@precisionplastics.lk",
    address: "Industrial Estate, Horana",
    active: true,
    createdAt: "2026-06-22 13:00",
    updatedAt: "2026-07-02 14:00",
    notes: "Plastic bins, custom boxes, and injection molding.",
    totalSupplies: 52,
  },
  {
    id: "SPL-1010",
    supplierName: "Lanka Lubricants PLC",
    contactPerson: "Lahiru Karunaratne",
    phone: "+94 11 444 3333",
    email: "industrial@lankalubes.lk",
    address: "10, Galle Face Court, Colombo 03",
    active: true,
    createdAt: "2026-06-25 11:30",
    updatedAt: "2026-07-06 16:30",
    notes: "Machine oils, grease, and industrial lubricants.",
    totalSupplies: 94,
  },
  {
    id: "SPL-1011",
    supplierName: "Elite Office Systems",
    contactPerson: "Hashini Abeysekara",
    phone: "+94 75 222 3333",
    email: "support@eliteoffice.lk",
    address: "148, High Level Rd, Nugegoda",
    active: true,
    createdAt: "2026-06-28 09:00",
    updatedAt: "2026-06-28 09:00",
    notes: "Office furniture, paper shredders, and workplace items.",
    totalSupplies: 33,
  },
  {
    id: "SPL-1012",
    supplierName: "Vanguard Security Solutions",
    contactPerson: "Pasindu Liyanage",
    phone: "+94 77 333 4444",
    email: "pasindu@vanguardsec.com",
    address: "24, Union Place, Colombo 02",
    active: true,
    createdAt: "2026-07-01 10:20",
    updatedAt: "2026-07-10 11:45",
    notes: "Access control systems, CCTV hardware and safety locks.",
    totalSupplies: 27,
  },
];

const INIT_TRANSACTIONS: Transaction[] = [
  {
    id: "TX-2291",
    item: "Steel Hex Bolts M8",
    type: "Stock in",
    qty: 480,
    user: "R. Fernando",
    date: "Today 08:42",
    prevQty: 1020,
    newQty: 1500,
  },
  {
    id: "TX-2290",
    item: "Industrial Gloves L",
    type: "Stock out",
    qty: -60,
    user: "N. Perera",
    date: "Today 08:15",
    prevQty: 240,
    newQty: 180,
  },
  {
    id: "TX-2289",
    item: "Copper Wire 2.5mm",
    type: "Stock out",
    qty: -120,
    user: "S. Jayawardena",
    date: "Yesterday 17:03",
    prevQty: 300,
    newQty: 180,
  },
  {
    id: "TX-2288",
    item: "PVC Conduit 20mm",
    type: "Stock in",
    qty: 300,
    user: "R. Fernando",
    date: "Yesterday 14:50",
    prevQty: 400,
    newQty: 700,
  },
  {
    id: "TX-2287",
    item: "LED Panel 18W",
    type: "Stock out",
    qty: -8,
    user: "K. Silva",
    date: "Yesterday 11:22",
    prevQty: 85,
    newQty: 77,
  },
  {
    id: "TX-2286",
    item: "Copper Wire 2.5mm",
    type: "Stock in",
    qty: 500,
    user: "N. Perera",
    date: "10 Jul 16:40",
    prevQty: 300,
    newQty: 800,
  },
  {
    id: "TX-2285",
    item: "Safety Helmets",
    type: "Stock out",
    qty: -30,
    user: "K. Silva",
    date: "10 Jul 14:10",
    prevQty: 150,
    newQty: 120,
  },
  {
    id: "TX-2284",
    item: "PVC Conduit 20mm",
    type: "Stock out",
    qty: -90,
    user: "S. Jayawardena",
    date: "10 Jul 11:55",
    prevQty: 490,
    newQty: 400,
  },
  {
    id: "TX-2283",
    item: "Steel Hex Bolts M8",
    type: "Stock out",
    qty: -15,
    user: "R. Fernando",
    date: "10 Jul 09:30",
    prevQty: 1035,
    newQty: 1020,
  },
  {
    id: "TX-2282",
    item: "LED Panel 18W",
    type: "Stock in",
    qty: 200,
    user: "K. Silva",
    date: "10 Jul 08:00",
    prevQty: 100,
    newQty: 300,
  },
  {
    id: "TX-2281",
    item: "Industrial Gloves L",
    type: "Stock in",
    qty: 150,
    user: "N. Perera",
    date: "09 Jul 17:20",
    prevQty: 90,
    newQty: 240,
  },
  {
    id: "TX-2280",
    item: "Rubber Gaskets 50mm",
    type: "Stock out",
    qty: -70,
    user: "R. Fernando",
    date: "09 Jul 15:45",
    prevQty: 170,
    newQty: 100,
  },
  {
    id: "TX-2279",
    item: "Angle Grinder Discs",
    type: "Stock in",
    qty: 400,
    user: "S. Jayawardena",
    date: "09 Jul 13:10",
    prevQty: 200,
    newQty: 600,
  },
  {
    id: "TX-2278",
    item: "Safety Helmets",
    type: "Stock in",
    qty: 100,
    user: "K. Silva",
    date: "09 Jul 10:00",
    prevQty: 50,
    newQty: 150,
  },
  {
    id: "TX-2277",
    item: "Copper Wire 2.5mm",
    type: "Stock out",
    qty: -5,
    user: "N. Perera",
    date: "09 Jul 08:30",
    prevQty: 805,
    newQty: 800,
  },
  {
    id: "TX-2262",
    item: "Safety Helmets",
    type: "Stock in",
    qty: 80,
    user: "N. Perera",
    date: "06 Jul 08:10",
    prevQty: 200,
    newQty: 280,
  },
];

export const ALL_ITEMS = [
  "Steel Hex Bolts M8",
  "Industrial Gloves L",
  "Copper Wire 2.5mm",
  "PVC Conduit 20mm",
  "LED Panel 18W",
  "Safety Helmets",
  "Rubber Gaskets 50mm",
  "Angle Grinder Discs",
  "Steel Plates 10mm",
  "Threaded Rods 1m",
  "Bubble Wrap Roll 100m",
  "Jute Bags Large",
  "Cardboard Cartons",
  "Agricultural Twine",
  "Stretch Film Roll",
  "Packing Tape Clear"
];

export const INIT_CATEGORIES: Category[] = [
  { id: "CAT-1001", name: "Steel & Metals", description: "Primary steel and hardware parts.", active: true, createdAt: "2026-06-01 09:00", updatedAt: "2026-06-01 09:00" },
  { id: "CAT-1002", name: "Electrical", description: "Cables, wiring, LED panels, and accessories.", active: true, createdAt: "2026-06-01 09:00", updatedAt: "2026-06-01 09:00" },
  { id: "CAT-1003", name: "Safety Gear", description: "Helmets, gloves, glasses, and protective wear.", active: true, createdAt: "2026-06-01 09:00", updatedAt: "2026-06-01 09:00" },
  { id: "CAT-1004", name: "Plastics", description: "Plastic bins, custom boxes, packaging materials.", active: true, createdAt: "2026-06-01 09:00", updatedAt: "2026-06-01 09:00" },
  { id: "CAT-1005", name: "Packaging", description: "Corrugated boxes, bubble wraps, tapes.", active: true, createdAt: "2026-06-01 09:00", updatedAt: "2026-06-01 09:00" },
  { id: "CAT-1006", name: "Lubricants", description: "Grease, oils, and industrial lubricants.", active: true, createdAt: "2026-06-01 09:00", updatedAt: "2026-06-01 09:00" },
];

export const INIT_ITEMS: Item[] = [
  {
    id: "ITM-1001",
    sku: "SKU-BOLT-M8",
    itemName: "Steel Hex Bolts M8",
    description: "High tensile steel hex head bolts, size M8.",
    category: "Steel & Metals",
    supplier: "Lanka Steel Supplies",
    quantity: 1500,
    unit: "pcs",
    costPrice: 10,
    sellingPrice: 15,
    reorderLevel: 200,
    reorderQuantity: 500,
    active: true,
    createdAt: "2026-06-01 09:00",
    updatedAt: "2026-07-10 14:30"
  },
  {
    id: "ITM-1002",
    sku: "SKU-GLV-L",
    itemName: "Industrial Gloves L",
    description: "Heavy duty industrial safety gloves, size L.",
    category: "Safety Gear",
    supplier: "Apex Tools & Hardware",
    quantity: 180,
    unit: "pairs",
    costPrice: 200,
    sellingPrice: 350,
    reorderLevel: 50,
    reorderQuantity: 150,
    active: true,
    createdAt: "2026-06-02 10:00",
    updatedAt: "2026-07-09 11:20"
  },
  {
    id: "ITM-1003",
    sku: "SKU-WR-25",
    itemName: "Copper Wire 2.5mm",
    description: "Insulated copper wire, thickness 2.5mm.",
    category: "Electrical",
    supplier: "Premier Electricals",
    quantity: 180,
    unit: "meters",
    costPrice: 5000,
    sellingPrice: 8500,
    reorderLevel: 100,
    reorderQuantity: 300,
    active: true,
    createdAt: "2026-06-03 11:00",
    updatedAt: "2026-07-11 15:30"
  },
  {
    id: "ITM-1004",
    sku: "SKU-PVC-20",
    itemName: "PVC Conduit 20mm",
    description: "Polyvinyl chloride conduit pipes, diameter 20mm.",
    category: "Electrical",
    supplier: "Premier Electricals",
    quantity: 700,
    unit: "meters",
    costPrice: 250,
    sellingPrice: 450,
    reorderLevel: 150,
    reorderQuantity: 400,
    active: true,
    createdAt: "2026-06-04 12:00",
    updatedAt: "2026-07-08 09:10"
  },
  {
    id: "ITM-1005",
    sku: "SKU-LED-18",
    itemName: "LED Panel 18W",
    description: "Energy efficient LED ceiling light panel, 18W.",
    category: "Electrical",
    supplier: "Premier Electricals",
    quantity: 77,
    unit: "pcs",
    costPrice: 900,
    sellingPrice: 1400,
    reorderLevel: 20,
    reorderQuantity: 80,
    active: true,
    createdAt: "2026-06-05 13:00",
    updatedAt: "2026-07-01 10:00"
  },
  {
    id: "ITM-1006",
    sku: "SKU-HLM-SF",
    itemName: "Safety Helmets",
    description: "Standard industrial safety helmets, high-density polyethylene.",
    category: "Safety Gear",
    supplier: "Apex Tools & Hardware",
    quantity: 120,
    unit: "pcs",
    costPrice: 800,
    sellingPrice: 1200,
    reorderLevel: 30,
    reorderQuantity: 100,
    active: true,
    createdAt: "2026-06-06 14:00",
    updatedAt: "2026-07-05 13:40"
  },
  {
    id: "ITM-1007",
    sku: "SKU-GSK-50",
    itemName: "Rubber Gaskets 50mm",
    description: "Industrial grade rubber sealing gaskets, diameter 50mm.",
    category: "Plastics",
    supplier: "Precision Plastics",
    quantity: 100,
    unit: "pcs",
    costPrice: 50,
    sellingPrice: 90,
    reorderLevel: 40,
    reorderQuantity: 150,
    active: true,
    createdAt: "2026-06-07 15:00",
    updatedAt: "2026-07-02 14:00"
  },
  {
    id: "ITM-1008",
    sku: "SKU-DSC-AG",
    itemName: "Angle Grinder Discs",
    description: "Abrasive cutting discs for metal angle grinders.",
    category: "Steel & Metals",
    supplier: "Apex Tools & Hardware",
    quantity: 600,
    unit: "pcs",
    costPrice: 150,
    sellingPrice: 280,
    reorderLevel: 100,
    reorderQuantity: 300,
    active: true,
    createdAt: "2026-06-08 16:00",
    updatedAt: "2026-07-06 16:30"
  },
  {
    id: "ITM-1009",
    sku: "SKU-PLT-10",
    itemName: "Steel Plates 10mm",
    description: "Heavy metal structural steel plates, thickness 10mm.",
    category: "Steel & Metals",
    supplier: "Lanka Steel Supplies",
    quantity: 45,
    unit: "pcs",
    costPrice: 800,
    sellingPrice: 1200,
    reorderLevel: 10,
    reorderQuantity: 30,
    active: true,
    createdAt: "2026-06-09 17:00",
    updatedAt: "2026-06-28 09:00"
  },
  {
    id: "ITM-1010",
    sku: "SKU-ROD-1M",
    itemName: "Threaded Rods 1m",
    description: "Fully threaded zinc plated steel rods, length 1m.",
    category: "Steel & Metals",
    supplier: "Lanka Steel Supplies",
    quantity: 120,
    unit: "pcs",
    costPrice: 200,
    sellingPrice: 350,
    reorderLevel: 25,
    reorderQuantity: 80,
    active: true,
    createdAt: "2026-06-10 18:00",
    updatedAt: "2026-07-10 11:45"
  },
  {
    id: "ITM-1011",
    sku: "SKU-WRP-100",
    itemName: "Bubble Wrap Roll 100m",
    description: "Protective cushioning bubble wrap roll, length 100m.",
    category: "Packaging",
    supplier: "Royal Packaging Ltd",
    quantity: 15,
    unit: "rolls",
    costPrice: 1500,
    sellingPrice: 2500,
    reorderLevel: 5,
    reorderQuantity: 20,
    active: true,
    createdAt: "2026-06-11 09:30",
    updatedAt: "2026-07-12 08:35"
  },
  {
    id: "ITM-1012",
    sku: "SKU-BAG-LG",
    itemName: "Jute Bags Large",
    description: "Biodegradable large jute sacks for agricultural packing.",
    category: "Packaging",
    supplier: "Ceylon Agro Industries",
    quantity: 1000,
    unit: "pcs",
    costPrice: 40,
    sellingPrice: 80,
    reorderLevel: 200,
    reorderQuantity: 500,
    active: true,
    createdAt: "2026-06-12 10:15",
    updatedAt: "2026-07-09 09:00"
  },
  {
    id: "ITM-1013",
    sku: "SKU-CTN-CB",
    itemName: "Cardboard Cartons",
    description: "Corrugated cardboard boxes for packing and shipping.",
    category: "Packaging",
    supplier: "Ceylon Agro Industries",
    quantity: 450,
    unit: "pcs",
    costPrice: 25,
    sellingPrice: 45,
    reorderLevel: 100,
    reorderQuantity: 300,
    active: true,
    createdAt: "2026-06-13 11:30",
    updatedAt: "2026-06-25 11:30"
  },
  {
    id: "ITM-1014",
    sku: "SKU-TWN-AG",
    itemName: "Agricultural Twine",
    description: "Strong polypropylene twine roll for binding and packing.",
    category: "Packaging",
    supplier: "Ceylon Agro Industries",
    quantity: 300,
    unit: "rolls",
    costPrice: 80,
    sellingPrice: 150,
    reorderLevel: 50,
    reorderQuantity: 150,
    active: true,
    createdAt: "2026-06-14 12:45",
    updatedAt: "2026-06-28 09:00"
  },
  {
    id: "ITM-1015",
    sku: "SKU-FLM-ST",
    itemName: "Stretch Film Roll",
    description: "Industrial strength plastic pallet stretch wrap roll.",
    category: "Packaging",
    supplier: "Royal Packaging Ltd",
    quantity: 80,
    unit: "rolls",
    costPrice: 1100,
    sellingPrice: 1800,
    reorderLevel: 15,
    reorderQuantity: 50,
    active: true,
    createdAt: "2026-06-15 14:00",
    updatedAt: "2026-07-12 08:35"
  },
  {
    id: "ITM-1016",
    sku: "SKU-TAP-CL",
    itemName: "Packing Tape Clear",
    description: "Heavy duty clear adhesive packaging tape roll.",
    category: "Packaging",
    supplier: "Royal Packaging Ltd",
    quantity: 250,
    unit: "rolls",
    costPrice: 70,
    sellingPrice: 120,
    reorderLevel: 50,
    reorderQuantity: 200,
    active: true,
    createdAt: "2026-06-16 15:30",
    updatedAt: "2026-07-12 08:35"
  }
];

// Helper to get current quantity of an item from a list of transactions
export const getItemCurrentQty = (itemName: string, transactions: Transaction[]): number => {
  const latestTx = transactions.find(t => t.item === itemName);
  return latestTx ? (latestTx.newQty ?? 0) : 500; // baseline of 500 units if no transaction history
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

  // Load from local storage
  useEffect(() => {
    const savedUsers = localStorage.getItem("userList");
    const savedSuppliers = localStorage.getItem("supplierList");
    const savedTransactions = localStorage.getItem("transactionList");
    const savedItems = localStorage.getItem("itemList");
    const savedCategories = localStorage.getItem("categoryList");
    const savedLoggedIn = localStorage.getItem("user");

    setUserList(savedUsers ? JSON.parse(savedUsers) : INIT_USERS);
    setSupplierList(savedSuppliers ? JSON.parse(savedSuppliers) : INIT_SUPPLIERS);
    setTransactionList(savedTransactions ? JSON.parse(savedTransactions) : INIT_TRANSACTIONS);
    setItemList(savedItems ? JSON.parse(savedItems) : INIT_ITEMS);
    setCategoryList(savedCategories ? JSON.parse(savedCategories) : INIT_CATEGORIES);
    if (savedLoggedIn) setLoggedInUser(JSON.parse(savedLoggedIn));
    
    setLoaded(true);
  }, []);

  // Save changes to local storage
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("userList", JSON.stringify(userList));
  }, [userList, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("supplierList", JSON.stringify(supplierList));
  }, [supplierList, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("transactionList", JSON.stringify(transactionList));
  }, [transactionList, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("itemList", JSON.stringify(itemList));
  }, [itemList, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("categoryList", JSON.stringify(categoryList));
  }, [categoryList, loaded]);

  // Operations
  const addUser = (u: any) => {
    const nu = {
      ...u,
      id: `USR-${1000 + userList.length}`,
      createdAt: getFormattedDateTime().replace("T", " "),
      updatedAt: getFormattedDateTime().replace("T", " ")
    } as User;
    setUserList(prev => [nu, ...prev]);
  };

  const saveUserEdit = (updatedUser: any) => {
    updatedUser.updatedAt = getFormattedDateTime().replace("T", " ");
    const savedUser = updatedUser as User;
    setUserList(prev => prev.map(x => (x.id === savedUser.id ? savedUser : x)));
  };

  const deleteUser = (id: string) => {
    setUserList(prev => prev.filter(u => u.id !== id));
  };

  const addSupplier = (s: any) => {
    const ns = {
      ...s,
      id: `SPL-${1000 + supplierList.length}`,
      createdAt: getFormattedDateTime().replace("T", " "),
      updatedAt: getFormattedDateTime().replace("T", " ")
    } as Supplier;
    setSupplierList(prev => [ns, ...prev]);
  };

  const saveSupplierEdit = (updatedSupplier: any) => {
    updatedSupplier.updatedAt = getFormattedDateTime().replace("T", " ");
    const savedSupplier = updatedSupplier as Supplier;
    setSupplierList(prev => prev.map(x => (x.id === savedSupplier.id ? savedSupplier : x)));
  };

  const deleteSupplier = (id: string) => {
    setSupplierList(prev => prev.filter(s => s.id !== id));
  };

  const addItem = (item: any) => {
    const ni = {
      ...item,
      id: `ITM-${1000 + itemList.length + 1}`,
      createdAt: getFormattedDateTime().replace("T", " "),
      updatedAt: getFormattedDateTime().replace("T", " ")
    } as Item;
    setItemList(prev => [ni, ...prev]);
  };

  const saveItemEdit = (updatedItem: any) => {
    updatedItem.updatedAt = getFormattedDateTime().replace("T", " ");
    const savedItem = updatedItem as Item;
    setItemList(prev => prev.map(x => (x.id === savedItem.id ? savedItem : x)));
  };

  const deleteItem = (id: string) => {
    setItemList(prev => prev.filter(x => x.id !== id));
  };

  const recordTransactions = (
    txs: Array<{ item: string; type: "Stock in" | "Stock out"; qty: number }>,
    currentUser: string
  ) => {
    // Current Local time formatting: 12 Jul 14:10
    const now = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const pad = (n: number) => n.toString().padStart(2, "0");
    const dateStr = `${pad(now.getDate())} ${months[now.getMonth()]} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

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
        newQty
      };
      
      newTxRecords.push(newRecord);
      tempTransactions = [newRecord, ...tempTransactions];
    });

    setTransactionList(prev => [...newTxRecords, ...prev]);
  };

  if (!loaded) {
    return null;
  }

  return (
    <DataContext.Provider value={{
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
      recordTransactions
    }}>
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
