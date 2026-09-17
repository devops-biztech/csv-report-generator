import type { Metadata } from "next";
import { Archivo, Bevan } from "next/font/google";
import { ToastProvider } from "@/contexts/ToastContext";
import "./globals.css";

// Matches the company site: Archivo for text, Bevan for the slab-serif display face.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const bevan = Bevan({
  variable: "--font-bevan",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Data Reporting",
  description: "Consolidated CSV-driven financial reporting across locations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="overflow-hidden">
      <body
        className={`${archivo.variable} ${bevan.variable} antialiased hide-scrollbar overflow-hidden`}
      >
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
