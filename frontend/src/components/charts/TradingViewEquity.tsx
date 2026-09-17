"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  AreaSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  PriceScaleMode,
  IChartApi,
  Time,
} from "lightweight-charts";
import { EquityPoint } from "@/types/api";

interface Props {
  data: EquityPoint[];
  height?: number;
}

function normalizeDate(rawDate: string): string | null {
  if (!rawDate) return null;
  const match = rawDate.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(rawDate);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split("T")[0];
}

export function TradingViewEquity({ data, height = 280 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [scaleMode, setScaleMode] = useState<"logarithmic" | "normal">("logarithmic");
  const [showBenchmark, setShowBenchmark] = useState(true);

  useEffect(() => {
    if (!containerRef.current || !data || data.length === 0) return;

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
        mode: scaleMode === "logarithmic" ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
      },
      timeScale: {
        borderColor: "#27272a",
        timeVisible: true,
      },
      localization: {
        priceFormatter: (price: number) =>
          "$" + Math.round(price).toLocaleString("en-US"),
      },
    });

    chartRef.current = chart;

    // Deduplicate and strictly sort ascending by date
    const dateMap = new Map<string, EquityPoint>();
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

    // Benchmark Series (Buy & Hold) - conditional on showBenchmark
    if (showBenchmark) {
      const benchmarkSeries = chart.addSeries(LineSeries, {
        color: "#71717a",
        lineWidth: 1,
        lineStyle: 2,
        title: "Buy & Hold",
      });

      const benchPoints = sorted.map((d) => ({
        time: d.date as Time,
        value: typeof d.benchmark_equity === "number" && !isNaN(d.benchmark_equity) ? d.benchmark_equity : 0,
      }));
      benchmarkSeries.setData(benchPoints);
    }

    // Strategy Series (Area)
    const strategySeries = chart.addSeries(AreaSeries, {
      topColor: "rgba(16, 185, 129, 0.4)",
      bottomColor: "rgba(16, 185, 129, 0.0)",
      lineColor: "#10b981",
      lineWidth: 2,
      title: "Strategy",
    });

    const stratPoints = sorted.map((d) => ({
      time: d.date as Time,
      value: typeof d.equity === "number" && !isNaN(d.equity) ? d.equity : 0,
    }));
    strategySeries.setData(stratPoints);

    chart.timeScale().fitContent();

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
  }, [data, height, scaleMode, showBenchmark]);

  return (
    <div className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-white tracking-tight">Cumulative Portfolio Equity</h3>
          <span className="text-[11px] text-zinc-500 font-mono">
            {scaleMode === "logarithmic" ? "Log Scale" : "Linear Scale"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Legend and Benchmark Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
              <span className="text-zinc-300">Strategy</span>
            </div>

            <button
              onClick={() => setShowBenchmark(!showBenchmark)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-colors ${
                showBenchmark
                  ? "border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white"
                  : "border-zinc-800/60 bg-zinc-950 text-zinc-600 line-through"
              }`}
              title="Toggle Buy & Hold Benchmark"
            >
              <span className="h-1.5 w-3 rounded bg-zinc-500"></span>
              <span>Buy & Hold</span>
            </button>
          </div>

          {/* Scale Mode Switcher */}
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/80 p-0.5">
            <button
              onClick={() => setScaleMode("logarithmic")}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                scaleMode === "logarithmic"
                  ? "bg-emerald-500 text-zinc-950 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Log
            </button>
            <button
              onClick={() => setScaleMode("normal")}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                scaleMode === "normal"
                  ? "bg-emerald-500 text-zinc-950 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Linear
            </button>
          </div>
        </div>
      </div>
      <div ref={containerRef} className="w-full" style={{ height }} />
    </div>
  );
}
