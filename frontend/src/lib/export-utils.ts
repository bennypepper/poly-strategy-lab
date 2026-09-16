import { BacktestResponse, EquityPoint, TradeLog } from "@/types/api";

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportTradesToCsv(symbol: string, trades: TradeLog[]): void {
  if (!trades || trades.length === 0) return;

  const headers = ["Date", "Type", "Price_USD", "Shares", "Cost_USD", "Cash_After_USD", "Portfolio_Value_USD"];
  const rows = trades.map((t) => [
    t.date,
    t.type,
    t.price.toFixed(2),
    t.shares.toFixed(6),
    t.cost.toFixed(2),
    t.cash_after.toFixed(2),
    t.port_value.toFixed(2),
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const filename = `poly_${symbol.toLowerCase().replace(/[^a-z0-9]/g, "_")}_trades.csv`;
  triggerDownload(csvContent, filename, "text/csv;charset=utf-8;");
}

export function exportEquityToCsv(symbol: string, equityCurve: EquityPoint[]): void {
  if (!equityCurve || equityCurve.length === 0) return;

  const headers = [
    "Date",
    "Strategy_Equity_USD",
    "Benchmark_Equity_USD",
    "Cash_USD",
    "Asset_Holdings",
    "Signal_Score",
    "Close_Price_USD",
  ];
  const rows = equityCurve.map((e) => [
    e.date,
    e.equity.toFixed(2),
    e.benchmark_equity.toFixed(2),
    e.cash.toFixed(2),
    e.asset_holdings.toFixed(6),
    e.signal_val.toFixed(2),
    e.close_price.toFixed(2),
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const filename = `poly_${symbol.toLowerCase().replace(/[^a-z0-9]/g, "_")}_equity.csv`;
  triggerDownload(csvContent, filename, "text/csv;charset=utf-8;");
}

export function exportFullReportJson(symbol: string, result: BacktestResponse): void {
  const jsonString = JSON.stringify(result, null, 2);
  const filename = `poly_${symbol.toLowerCase().replace(/[^a-z0-9]/g, "_")}_report.json`;
  triggerDownload(jsonString, filename, "application/json;charset=utf-8;");
}
