import { BacktestResponse, EquityPoint, TradeLog } from "@/types/api";

/**
 * Safely formats a numeric value to a fixed decimal string.
 * Prevents runtime TypeErrors if null, undefined, or NaN is encountered.
 */
function safeToFixed(
  val: number | null | undefined,
  decimals: number,
  fallback = "0.00"
): string {
  if (val === null || val === undefined || typeof val !== "number" || isNaN(val)) {
    return fallback;
  }
  return val.toFixed(decimals);
}

/**
 * Escapes a cell according to RFC 4180 standards and protects against CSV formula injection.
 */
function escapeCsvCell(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return "";
  let str = String(raw);

  // Mitigate CSV Formula Injection (DDE) if cell starts with =, +, -, @, \t, \r
  // Only apply when the cell is not a standard valid number
  const isPureNumber = !isNaN(Number(str)) && str.trim().length > 0;
  if (!isPureNumber && /^[\=\+\-\@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // If cell contains commas, quotes, or newlines, quote the entire field and escape quotes
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Safely triggers client-side file download via Blob and temporary link.
 * Guards against non-browser environments and prevents premature ObjectURL revocation.
 */
function triggerDownload(content: string, filename: string, mimeType: string): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Revoke after a short delay so browser download pipeline has time to consume the URL
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

    return true;
  } catch (err: unknown) {
    console.error("Failed to trigger file download:", err);
    return false;
  }
}

/**
 * Exports trade logs to CSV with strict RFC 4180 escaping and defensive formatting.
 */
export function exportTradesToCsv(symbol: string, trades: TradeLog[]): boolean {
  const headers = [
    "Date",
    "Type",
    "Price_USD",
    "Shares",
    "Cost_USD",
    "Cash_After_USD",
    "Portfolio_Value_USD",
  ];

  const safeTrades = trades || [];
  const rows = safeTrades.map((t) => [
    escapeCsvCell(t.date || ""),
    escapeCsvCell(t.type || ""),
    escapeCsvCell(safeToFixed(t.price, 2)),
    escapeCsvCell(safeToFixed(t.shares, 6)),
    escapeCsvCell(safeToFixed(t.cost, 2)),
    escapeCsvCell(safeToFixed(t.cash_after, 2)),
    escapeCsvCell(safeToFixed(t.port_value, 2)),
  ]);

  const csvContent = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\r\n");

  const sanitizedSymbol = (symbol || "asset").toLowerCase().replace(/[^a-z0-9]/g, "_");
  const filename = `poly_${sanitizedSymbol}_trades.csv`;
  return triggerDownload(csvContent, filename, "text/csv;charset=utf-8;");
}

/**
 * Exports equity curve points to CSV with defensive numeric formatting and escaping.
 */
export function exportEquityToCsv(symbol: string, equityCurve: EquityPoint[]): boolean {
  const headers = [
    "Date",
    "Strategy_Equity_USD",
    "Benchmark_Equity_USD",
    "Cash_USD",
    "Asset_Holdings",
    "Signal_Score",
    "Close_Price_USD",
  ];

  const safeCurve = equityCurve || [];
  const rows = safeCurve.map((e) => [
    escapeCsvCell(e.date || ""),
    escapeCsvCell(safeToFixed(e.equity, 2)),
    escapeCsvCell(safeToFixed(e.benchmark_equity, 2)),
    escapeCsvCell(safeToFixed(e.cash, 2)),
    escapeCsvCell(safeToFixed(e.asset_holdings, 6)),
    escapeCsvCell(safeToFixed(e.signal_val, 2)),
    escapeCsvCell(safeToFixed(e.close_price, 2)),
  ]);

  const csvContent = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\r\n");

  const sanitizedSymbol = (symbol || "asset").toLowerCase().replace(/[^a-z0-9]/g, "_");
  const filename = `poly_${sanitizedSymbol}_equity.csv`;
  return triggerDownload(csvContent, filename, "text/csv;charset=utf-8;");
}

/**
 * Exports complete backtest report in structured JSON format.
 */
export function exportFullReportJson(symbol: string, result: BacktestResponse): boolean {
  try {
    const jsonString = JSON.stringify(result, null, 2);
    const sanitizedSymbol = (symbol || "asset").toLowerCase().replace(/[^a-z0-9]/g, "_");
    const filename = `poly_${sanitizedSymbol}_report.json`;
    return triggerDownload(jsonString, filename, "application/json;charset=utf-8;");
  } catch (err: unknown) {
    console.error("Failed to serialize backtest report JSON:", err);
    return false;
  }
}

