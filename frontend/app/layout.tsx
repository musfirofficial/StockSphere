import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  src: [
    {
      path: "../public/fonts/InterVariable.woff2",
      style: "normal",
    },
    {
      path: "../public/fonts/InterVariable-Italic.woff2",
      style: "italic",
    }
  ],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "StockSphere - Inventory Management System",
  description: "StockSphere: Advanced inventory management dashboard for modern warehouses.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" }
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} style={{ height: "100%", width: "100%" }}>
      <body style={{ height: "100%", width: "100%", margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
