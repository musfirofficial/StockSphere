"use client";
import React, { useState, useEffect } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, Treemap, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { FileBarChart2, ChevronDown } from "lucide-react";
import { useTheme } from "../ThemeContext";
import { useData } from "../DataContext";

const REPORT_TYPES = [
  { id: "summary", label: "Overall Summary" },
  { id: "lowstock", label: "Low Stock Report" },
  { id: "transactions", label: "Transaction Report" },
  { id: "velocity", label: "Stock Velocity (ABC)" },
  { id: "category", label: "Category Report" },
  { id: "supplier", label: "Supplier Report" },
];

// ── shared helpers ──────────────────────────────────────────
function Card({ c, children, style = {} }: any) {
  return <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 14, padding: "18px 20px", ...style }}>{children}</div>;
}
function Sect({ c, title, sub }: any) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: c.textFaint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function Stat({ c, label, value, sub, color }: any) {
  return (
    <div style={{ background: c.surfaceMuted, borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 11.5, color: c.textFaint, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || c.text }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── mock data ───────────────────────────────────────────────
const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const trend12 = months.map((m,i) => ({ m, inv: 180000 - i*4000 + Math.sin(i)*8000, sales: 60000 + i*3500 + Math.cos(i)*5000 }));
const txMonthly = months.map((m,i) => ({ m, in: 120+i*8, out: 90+i*6 }));

const stockItems = [
  { name:"Steel Hex Bolts M8", qty:12, min:50, active:true, days:3 },
  { name:"Industrial Gloves L", qty:180, min:100, active:true, days:12 },
  { name:"Copper Wire 2.5mm", qty:8, min:30, active:true, days:2 },
  { name:"PVC Conduit 20mm", qty:700, min:200, active:true, days:45 },
  { name:"LED Panel 18W", qty:77, min:80, active:true, days:8 },
  { name:"Safety Helmets", qty:4, min:20, active:false, days:90 },
  { name:"Rubber Gaskets 50mm", qty:15, min:40, active:false, days:60 },
];

const abcItems = [
  { name:"Steel Hex Bolts", cls:"A", value:84000, size:84 },
  { name:"Copper Wire", cls:"A", value:61000, size:61 },
  { name:"LED Panel 18W", cls:"A", value:48000, size:48 },
  { name:"PVC Conduit", cls:"B", value:32000, size:32 },
  { name:"Industrial Gloves", cls:"B", value:24000, size:24 },
  { name:"Safety Helmets", cls:"B", value:18000, size:18 },
  { name:"Rubber Gaskets", cls:"C", value:9000, size:9 },
  { name:"Angle Grinder Discs", cls:"C", value:6000, size:6 },
];

const catData = [
  { name:"Steel & Metals", margin:42, space:28, value:84000, color:"#3B6E5E" },
  { name:"Electrical", margin:38, space:22, value:61000, color:"#6FAE97" },
  { name:"Safety Gear", margin:31, space:18, value:38000, color:"#A6792F" },
  { name:"Plastics", margin:27, space:14, value:29000, color:"#B3473C" },
  { name:"Packaging", margin:19, space:12, value:18000, color:"#73705F" },
  { name:"Lubricants", margin:24, space:6, value:14000, color:"#9A988F" },
];

const clsColor: any = { A:"#3B6E5E", B:"#A6792F", C:"#B3473C" };

// ── Report 1: Overall Summary ───────────────────────────────
function SummaryReport({ c }: any) {
  const { transactionList } = useData();
  const inTx = transactionList.filter(t => t.type === "Stock in").length;
  const outTx = transactionList.filter(t => t.type === "Stock out").length;
  const sellThru = outTx + inTx > 0 ? Math.round((outTx / (outTx + inTx)) * 100) : 0;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 }}>
        <Stat c={c} label="Total Items" value="8,420" sub="Units in stock" />
        <Stat c={c} label="Inventory Cost Worth" value="Rs 184,250" sub="Purchase price total" color={c.accent} />
        <Stat c={c} label="Selling Worth" value="Rs 312,400" sub="At market price" color="#3B6E5E" />
        <Stat c={c} label="Sell-Through Rate" value={`${sellThru}%`} sub="Of received stock sold" color={c.warn} />
        <Stat c={c} label="Active Items" value="6,840" sub="81% of total" color={c.accent} />
        <Stat c={c} label="Inactive Items" value="1,580" sub="19% of total" color={c.danger} />
      </div>
      <Card c={c}>
        <Sect c={c} title="Inventory Value vs Sales Value — Last 12 Months" sub="Monitor overstocking trends" />
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trend12} margin={{ left:-10, right:8, top:4, bottom:0 }}>
            <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="m" tick={{ fontSize:11, fill:c.textFaint }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize:11, fill:c.textFaint }} tickLine={false} axisLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background:c.surface, border:`1px solid ${c.border}`, borderRadius:8, fontSize:12 }} formatter={(v:any)=>`Rs ${v.toLocaleString()}`} />
            <Legend wrapperStyle={{ fontSize:12 }} />
            <Line type="monotone" dataKey="inv" name="Inventory Value" stroke={c.accent} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="sales" name="Sales Value" stroke={c.warn} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ── Report 2: Low Stock ─────────────────────────────────────
function LowStockReport({ c }: any) {
  const getLevel = (item: any) => {
    const ratio = item.qty / item.min;
    if (ratio < 0.25) return { label:"Critical", bg:c.dangerSoft, fg:c.danger };
    if (ratio < 0.75) return { label:"Low", bg:c.warnSoft, fg:c.warn };
    return { label:"OK", bg:c.accentSoft, fg:c.accent };
  };
  const active = stockItems.filter(i => i.active);
  const inactive = stockItems.filter(i => !i.active);
  const renderTable = (items: any[], title: string) => (
    <Card c={c}>
      <Sect c={c} title={title} sub={`${items.length} items`} />
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5 }}>
        <thead>
          <tr style={{ background:c.surfaceMuted }}>
            {["Item","Current Qty","Min Required","Alert Level","Days Supply"].map(h=>(
              <th key={h} style={{ padding:"8px 14px", textAlign:"left", fontWeight:500, fontSize:11, color:c.textFaint }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const lvl = getLevel(item);
            return (
              <tr key={item.name} style={{ borderTop:`1px solid ${c.border}` }}>
                <td style={{ padding:"9px 14px", fontWeight:600 }}>{item.name}</td>
                <td style={{ padding:"9px 14px", color: item.qty < item.min ? c.danger : c.text, fontWeight:600 }}>{item.qty}</td>
                <td style={{ padding:"9px 14px", color:c.textMuted }}>{item.min}</td>
                <td style={{ padding:"9px 14px" }}>
                  <span style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:999, background:lvl.bg, color:lvl.fg }}>{lvl.label}</span>
                </td>
                <td style={{ padding:"9px 14px", color:c.textMuted }}>{item.days}d</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {renderTable(active, "Active Items — Stock Alerts")}
      {renderTable(inactive, "Deactivated Items — Stock Status")}
    </div>
  );
}

// ── Report 3: Transaction Report ────────────────────────────
function TransactionReport({ c }: any) {
  const { transactionList } = useData();
  const inCount = transactionList.filter(t=>t.type==="Stock in").length;
  const outCount = transactionList.filter(t=>t.type==="Stock out").length;
  const total = inCount + outCount;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        <Stat c={c} label="Stock-In Transactions" value={inCount} sub={`${total?Math.round(inCount/total*100):0}% of total`} color={c.accent} />
        <Stat c={c} label="Stock-Out Transactions" value={outCount} sub={`${total?Math.round(outCount/total*100):0}% of total`} color={c.danger} />
        <Stat c={c} label="Total Transactions" value={total} sub="All recorded" />
      </div>
      <Card c={c}>
        <Sect c={c} title="Stock In vs Out — Monthly Trend" />
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={txMonthly} margin={{ left:-10, right:8, top:4, bottom:0 }}>
            <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="m" tick={{ fontSize:11, fill:c.textFaint }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize:11, fill:c.textFaint }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background:c.surface, border:`1px solid ${c.border}`, borderRadius:8, fontSize:12 }} />
            <Legend wrapperStyle={{ fontSize:12 }} />
            <Bar dataKey="in" name="Stock In" fill={c.accent} radius={[4,4,0,0]} barSize={10} />
            <Bar dataKey="out" name="Stock Out" fill={c.danger} radius={[4,4,0,0]} barSize={10} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ── Report 4: Stock Velocity ────────────────────────────────
function VelocityReport({ c }: any) {
  const deadStockValue = 15000;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        <Stat c={c} label="Class A Items (Fast)" value="3" sub="High value, fast-moving" color={c.accent} />
        <Stat c={c} label="Class B Items (Medium)" value="3" sub="Moderate velocity" color={c.warn} />
        <Stat c={c} label="Class C / Dead Stock" value="2" sub={`Rs ${deadStockValue.toLocaleString()} tied up`} color={c.danger} />
      </div>
      <Card c={c}>
        <Sect c={c} title="ABC Analysis — Treemap" sub="Larger boxes = faster moving / higher value items" />
        <ResponsiveContainer width="100%" height={260}>
          <Treemap data={abcItems} dataKey="size" aspectRatio={4/2} stroke={c.bg}
            content={({ x,y,width,height,name,cls }: any) => (
              <g>
                <rect x={x} y={y} width={width} height={height} fill={clsColor[cls]||c.accent} rx={4} />
                {width > 60 && height > 30 && (
                  <>
                    <text x={x+8} y={y+18} fill="#fff" fontSize={12} fontWeight={600}>{name}</text>
                    <text x={x+8} y={y+32} fill="rgba(255,255,255,0.7)" fontSize={10}>Class {cls}</text>
                  </>
                )}
              </g>
            )} />
        </ResponsiveContainer>
        <div style={{ display:"flex", gap:16, marginTop:10 }}>
          {["A","B","C"].map(cls => (
            <div key={cls} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12 }}>
              <div style={{ width:10, height:10, borderRadius:2, background:clsColor[cls] }} />
              <span style={{ color:c.textMuted }}>Class {cls} — {cls==="A"?"Fast-moving":cls==="B"?"Medium":"Slow / Dead"}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card c={c}>
        <Sect c={c} title="Dead Stock Alert" sub="Items with no movement in 90+ days" />
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5 }}>
          <thead>
            <tr style={{ background:c.surfaceMuted }}>
              {["Item","Class","Stock Value","Days Inactive"].map(h=>(
                <th key={h} style={{ padding:"8px 14px", textAlign:"left", fontWeight:500, fontSize:11, color:c.textFaint }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {abcItems.filter(i=>i.cls==="C").map(item=>(
              <tr key={item.name} style={{ borderTop:`1px solid ${c.border}` }}>
                <td style={{ padding:"9px 14px", fontWeight:600 }}>{item.name}</td>
                <td style={{ padding:"9px 14px" }}><span style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:999, background:c.dangerSoft, color:c.danger }}>Class C</span></td>
                <td style={{ padding:"9px 14px", color:c.danger, fontWeight:600 }}>Rs {item.value.toLocaleString()}</td>
                <td style={{ padding:"9px 14px", color:c.textMuted }}>90+</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── Report 5: Category Report ───────────────────────────────
function CategoryReport({ c }: any) {
  const COLORS = catData.map(d => d.color);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <Card c={c}>
          <Sect c={c} title="Contribution Margin by Category" sub="Profit margin %" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={catData} layout="vertical" margin={{ left:0, right:16, top:0, bottom:0 }}>
              <CartesianGrid stroke={c.border} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize:11, fill:c.textFaint }} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize:11, fill:c.textMuted }} axisLine={false} tickLine={false} width={100} />
              <Tooltip contentStyle={{ background:c.surface, border:`1px solid ${c.border}`, borderRadius:8, fontSize:12 }} formatter={(v:any)=>`${v}%`} />
              <Bar dataKey="margin" name="Margin %" radius={[0,5,5,0]} barSize={14}>
                {catData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card c={c}>
          <Sect c={c} title="Warehouse Space by Category" sub="% of physical space occupied" />
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={catData} dataKey="space" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ payload }: any) => `${payload?.space}%`} labelLine={false}>
                {catData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background:c.surface, border:`1px solid ${c.border}`, borderRadius:8, fontSize:12 }} formatter={(v:any)=>`${v}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:8 }}>
            {catData.map((d,i) => (
              <div key={d.name} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:c.textMuted }}>
                <div style={{ width:8, height:8, borderRadius:2, background:COLORS[i] }} />
                {d.name}
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card c={c}>
        <Sect c={c} title="Category Value Overview" />
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5 }}>
          <thead>
            <tr style={{ background:c.surfaceMuted }}>
              {["Category","Stock Value","Margin %","Space Used"].map(h=>(
                <th key={h} style={{ padding:"8px 14px", textAlign:"left", fontWeight:500, fontSize:11, color:c.textFaint }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {catData.map((d,i) => (
              <tr key={d.name} style={{ borderTop:`1px solid ${c.border}` }}>
                <td style={{ padding:"9px 14px", display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:COLORS[i] }} />
                  <span style={{ fontWeight:600 }}>{d.name}</span>
                </td>
                <td style={{ padding:"9px 14px", color:c.accent, fontWeight:600 }}>Rs {d.value.toLocaleString()}</td>
                <td style={{ padding:"9px 14px", color:c.textMuted }}>{d.margin}%</td>
                <td style={{ padding:"9px 14px", color:c.textMuted }}>{d.space}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── Report 6: Supplier Report ───────────────────────────────
function SupplierReport({ c }: any) {
  const { supplierList } = useData();
  const active = supplierList.filter(s => s.active).length;
  const inactive = supplierList.length - active;
  const top10 = [...supplierList].sort((a,b) => b.totalSupplies - a.totalSupplies).slice(0,10);
  const pieData = [
    { name:"Active", value:active, color:c.accent },
    { name:"Inactive", value:inactive, color:c.danger },
  ];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <Card c={c}>
          <Sect c={c} title="Top 10 Suppliers by Total Supplies" />
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5 }}>
            <thead>
              <tr style={{ background:c.surfaceMuted }}>
                {["#","Supplier","Total Supplies","Status"].map(h=>(
                  <th key={h} style={{ padding:"7px 12px", textAlign:"left", fontWeight:500, fontSize:11, color:c.textFaint }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top10.map((s,i) => (
                <tr key={s.id} style={{ borderTop:`1px solid ${c.border}` }}>
                  <td style={{ padding:"8px 12px", color:c.textFaint, fontWeight:600 }}>{i+1}</td>
                  <td style={{ padding:"8px 12px", fontWeight:600 }}>{s.supplierName}</td>
                  <td style={{ padding:"8px 12px", color:c.accent, fontWeight:600 }}>{s.totalSupplies}</td>
                  <td style={{ padding:"8px 12px" }}>
                    <span style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:999, background:s.active?c.accentSoft:c.dangerSoft, color:s.active?c.accent:c.danger }}>{s.active?"Active":"Inactive"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card c={c}>
          <Sect c={c} title="Active vs Inactive Suppliers" sub={`${supplierList.length} total suppliers`} />
          <div style={{ display:"flex", justifyContent:"center" }}>
            <PieChart width={220} height={220}>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={90}>
                {pieData.map((d,i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background:c.surface, border:`1px solid ${c.border}`, borderRadius:8, fontSize:12 }} />
            </PieChart>
          </div>
          <div style={{ display:"flex", justifyContent:"center", gap:24, marginTop:4 }}>
            {pieData.map(d => (
              <div key={d.name} style={{ display:"flex", alignItems:"center", gap:7, fontSize:12.5 }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:d.color }} />
                <span style={{ color:c.textMuted }}>{d.name}</span>
                <span style={{ fontWeight:700, color:c.text }}>{d.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function ReportsPage() {
  const { c } = useTheme();
  const { setHeaderActions } = useData();
  const [activeReport, setActiveReport] = useState("summary");
  const [dropOpen, setDropOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const curr = REPORT_TYPES.find(r => r.id === activeReport);
    setHeaderActions(
      <div style={{ display:"flex", alignItems:"center", gap:8, position:"relative" }}>
        <div style={{ position:"relative" }}>
          <button onClick={() => setDropOpen(p => !p)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:8, border:`1px solid ${c.border}`, background:c.surface, color:c.text, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
            {curr?.label} <ChevronDown size={14} />
          </button>
          {dropOpen && (
            <div style={{ position:"absolute", top:"calc(100% + 6px)", right:0, background:c.surface, border:`1px solid ${c.border}`, borderRadius:10, minWidth:200, zIndex:200, boxShadow:"0 8px 24px rgba(0,0,0,0.12)", overflow:"hidden" }}>
              {REPORT_TYPES.map(r => (
                <div key={r.id} onClick={() => { setActiveReport(r.id); setDropOpen(false); }}
                  style={{ padding:"10px 14px", fontSize:13, cursor:"pointer", background: r.id===activeReport ? c.accentSoft : "transparent", color: r.id===activeReport ? c.accent : c.text, fontWeight: r.id===activeReport ? 600 : 400 }}
                  onMouseEnter={e => { if(r.id!==activeReport) e.currentTarget.style.background = c.surfaceMuted; }}
                  onMouseLeave={e => { if(r.id!==activeReport) e.currentTarget.style.background = "transparent"; }}>
                  {r.label}
                </div>
              ))}
            </div>
          )}
        </div>
        <button style={{ display:"flex", alignItems:"center", gap:6, background:c.accent, color:"#fff", border:"none", padding:"8px 14px", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
          <FileBarChart2 size={14} /> Generate Report
        </button>
      </div>
    );
    return () => setHeaderActions(null);
  }, [c, activeReport, dropOpen, setHeaderActions]);

  if (!mounted) return null;

  return (
    <div>
      {activeReport === "summary" && <SummaryReport c={c} />}
      {activeReport === "lowstock" && <LowStockReport c={c} />}
      {activeReport === "transactions" && <TransactionReport c={c} />}
      {activeReport === "velocity" && <VelocityReport c={c} />}
      {activeReport === "category" && <CategoryReport c={c} />}
      {activeReport === "supplier" && <SupplierReport c={c} />}
    </div>
  );
}
