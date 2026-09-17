import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Poly Strategy Lab | Multi-Asset Quantitative Trading Laboratory",
  description:
    "Interactive quantitative strategy backtesting and parameter optimization platform across Bitcoin, Ethereum, Solana, and multi-asset universes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark bg-zinc-950 text-zinc-100">
      <body className={`${inter.className} min-h-screen bg-zinc-950 text-zinc-100 antialiased flex flex-col`}>
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-zinc-800/80 bg-zinc-950 py-8 text-xs text-zinc-500">
          <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>
              Poly Strategy Lab · Created by Benedict Michael Pepper.
            </p>
            <div className="flex items-center gap-6">
              <a href="/simulator" className="hover:text-zinc-300 transition-colors">Simulator</a>
              <a href="/optimizer" className="hover:text-zinc-300 transition-colors">Optimizer</a>
              <a href="/research" className="hover:text-zinc-300 transition-colors">Research</a>
              <a href="/docs" className="hover:text-zinc-300 transition-colors">Docs</a>
              <a href="https://github.com/bennypepper/poly-strategy-lab" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">GitHub</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
