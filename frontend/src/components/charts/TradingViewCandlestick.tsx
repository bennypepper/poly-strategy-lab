"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  IChartApi,
  Time,
} from "lightweight-charts";

interface CandlestickDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  signal?: number;
}

interface Props {
  data: CandlestickDataPoint[];
  symbol: string;
  height?: number;
  buyThreshold?: number;
  sellThreshold?: number;
}

/**
 * Normalizes any valid ISO / date string to strict YYYY-MM-DD format for Lightweight Charts.
 */
function normalizeDate(rawDate: string): string | null {
  if (!rawDate) return null;
  const match = rawDate.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(rawDate);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split("T")[0];
}

export function TradingViewCandlestick({
  data,
  symbol,
  height = 380,
  buyThreshold = 35,
  sellThreshold = 70,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || !data || data.length === 0) return;

    // Clear previous chart if any
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const initialWidth = containerRef.current.clientWidth;
    const chart = createChart(containerRef.current, {
      width: initialWidth > 0 ? initialWidth : undefined,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#09090b" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "#18181b" },
        horzLines: { color: "#18181b" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "#27272a",
        visible: true,
      },
      timeScale: {
        borderColor: "#27272a",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Add Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    // Normalize dates, deduplicate by date, and sort strictly ascending
    // Lightweight Charts throws a fatal assertion if timestamps are duplicate or unordered
    const dateMap = new Map<string, CandlestickDataPoint>();
    for (const d of data) {
      const normalized = normalizeDate(d.date);
      if (normalized) {
        dateMap.set(normalized, { ...d, date: normalized });
      }
    }

    const sorted = Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    if (sorted.length === 0) {
      chart.remove();
      chartRef.current = null;
      return;
    }

    const formattedCandles = sorted.map((d) => ({
      time: d.date as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    candleSeries.setData(formattedCandles);

    // If signal data is available, add Signal Line on a separate left scale
    const hasSignal = sorted.some((d) => d.signal !== undefined && d.signal !== null);
    if (hasSignal) {
      chart.applyOptions({
        leftPriceScale: {
          visible: true,
          borderColor: "#27272a",
        },
      });

      const signalSeries = chart.addSeries(LineSeries, {
        priceScaleId: "left",
        color: "#06b6d4",
        lineWidth: 2,
        title: "Signal",
      });

      const formattedSignals = sorted.map((d) => ({
        time: d.date as Time,
        value: typeof d.signal === "number" && !isNaN(d.signal) ? d.signal : 50.0,
      }));

      signalSeries.setData(formattedSignals);

      // Add Buy & Sell threshold price lines
      signalSeries.createPriceLine({
        price: buyThreshold,
        color: "#10b981",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `Buy ≤ ${buyThreshold}`,
      });

      signalSeries.createPriceLine({
        price: sellThreshold,
        color: "#ef4444",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `Sell ≥ ${sellThreshold}`,
      });
    }

    chart.timeScale().fitContent();

    // Resize observer
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, height, buyThreshold, sellThreshold]);

  return (
    <div className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-white tracking-tight">{symbol} Candlesticks & Signal</h3>
          <span className="text-xs text-zinc-500 font-mono">60 FPS Canvas</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
            <span className="text-zinc-300">Price (Candles)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded bg-cyan-400"></span>
            <span className="text-zinc-300">Channel Signal [0–100]</span>
          </div>
        </div>
      </div>
      <div ref={containerRef} className="w-full" style={{ height }} />
    </div>
  );
}
