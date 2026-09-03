/**
 * TelemetryGraph — Enterprise-grade observability monitor
 * Built on Apache ECharts for high-frequency time-series rendering.
 * Inspired by monitoring tools (Zabbix/Grafana) but with its own modern identity.
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Activity, Calendar as CalendarIcon, X, Loader2, Database,
  TrendingUp, ShieldAlert, Crosshair, BarChart3,
  Eye, EyeOff, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ── Palette ──────────────────────────────────────────────────────────────────
const SERIES_CONFIG = {
  cpu: { label: 'CPU Load', color: '#10b981', gradientTop: 'rgba(16,185,129,0.28)', gradientBot: 'rgba(16,185,129,0.01)' },
  ram: { label: 'RAM Usage', color: '#6366f1', gradientTop: 'rgba(99,102,241,0.22)', gradientBot: 'rgba(99,102,241,0.01)' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAxisTime(ts, rangeHours) {
  const d = new Date(ts);
  if (rangeHours <= 1) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (rangeHours <= 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: '2-digit' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function tooltipFormatter(params) {
  if (!params || !params.length) return '';
  const ts = new Date(params[0].value[0]);
  const timeStr = ts.toLocaleDateString([], { month: 'short', day: '2-digit' }) + ' · ' + ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  let rows = '';
  params.forEach(p => {
    const c = p.color?.colorStops ? p.color.colorStops[0].color : p.color;
    const val = typeof p.value[1] === 'number' ? p.value[1].toFixed(1) : '—';
    rows += `<div style="display:flex;align-items:center;gap:6px;padding:3px 0">`;
    rows += `<span style="width:6px;height:6px;border-radius:50%;background:${c}"></span>`;
    rows += `<span style="flex:1;font-size:11px;color:#64748b">${p.seriesName}</span>`;
    rows += `<span style="font-size:11px;font-weight:700;color:#1e293b;font-variant-numeric:tabular-nums">${val}%</span>`;
    rows += `</div>`;
  });

  return `<div style="font-family:'Inter',system-ui,sans-serif">`
    + `<div style="font-size:10px;color:#94a3b8;margin-bottom:4px">${timeStr}</div>`
    + rows + `</div>`;
}

// ── Toggle Button ────────────────────────────────────────────────────────────
const ToggleBtn = ({ active, onClick, icon: Icon, label, small }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 rounded-md border transition-all text-[10px] font-semibold uppercase tracking-wider
      ${small ? 'px-2 py-1' : 'px-2.5 py-1.5'}
      ${active
        ? 'bg-primary/10 border-primary/30 text-primary'
        : 'bg-transparent border-border/40 text-muted-foreground hover:text-foreground hover:border-border'
      }`}
  >
    {Icon && <Icon className="h-3 w-3" />}
    {label}
  </button>
);

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const TelemetryGraph = ({
  history = [],
  historyLoading = false,
  selectedRange,
  timeRanges = [],
  onRangeChange,
  isUsingCustom = false,
  customRange = {},
  onCustomRangeChange,
  onApplyCustomRange,
  onClearCustomRange,
  onManualSync,
  chartStart,
  chartEnd,
  lastUpdated,
}) => {
  const chartRef = useRef(null);

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [showCalendar, setShowCalendar] = useState(false);
  const [visible, setVisible] = useState({ cpu: true, ram: true });
  const [liveMode, setLiveMode] = useState(true);

  // Reset dataZoom when range changes
  useEffect(() => {
    const inst = chartRef.current?.getEchartsInstance?.();
    if (inst) inst.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
  }, [selectedRange, isUsingCustom]);

  // ── Build ECharts option ───────────────────────────────────────────────────
  const option = useMemo(() => {
    // Inject nulls for gaps > 3 minutes to break the line during reboots/offline periods.
    // Why 3 minutes? With semaphore=3 and 7+ VMs in batches, a complete cycle takes
    // 48-100 seconds. If one cycle times out, the gap between successful data points
    // can be 90-150 seconds. 180s (3 min) covers all normal variations while still
    // showing genuine outages.
    const GAP_THRESHOLD_MS = 180000; // 3 minutes
    const processWithGaps = (key) => {
      const data = [];
      for (let i = 0; i < history.length; i++) {
        if (i > 0 && history[i].timestamp - history[i - 1].timestamp > GAP_THRESHOLD_MS) {
          data.push([history[i - 1].timestamp + 1000, null]); // Break line
        }
        
        let val = history[i][key];
        
        // Apply a 1-minute (approx 2-3 points) moving average for CPU to match Zabbix's 1-min smoothing
        if (key === 'cpu') {
          let sum = val;
          let count = 1;
          // Look back at previous points within the last 60 seconds
          for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
            if (history[i].timestamp - history[j].timestamp <= 60000) {
              sum += history[j][key];
              count++;
            }
          }
          val = Math.round((sum / count) * 10) / 10; // Round to 1 decimal
        }
        
        data.push([history[i].timestamp, val]);
      }
      return data;
    };

    const cpuData = processWithGaps('cpu');
    const ramData = processWithGaps('ram');
    const rangeHours = selectedRange?.value || 1;

    const makeSeries = (key, data) => {
      const cfg = SERIES_CONFIG[key];
      return {
        name: cfg.label,
        type: 'line',
        smooth: 0.3,  // Slight smoothing for cleaner appearance with sparse data
        symbol: 'none',
        sampling: 'lttb',
        data,
        z: key === 'cpu' ? 3 : 2,
        itemStyle: { color: cfg.color },
        lineStyle: { color: cfg.color, width: 1.8 },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: cfg.gradientTop },
              { offset: 1, color: cfg.gradientBot },
            ],
          },
        },
        emphasis: { lineStyle: { width: 2.5 } },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: { 
            color: '#ef4444', 
            type: 'dotted', 
            width: 1, 
            opacity: 0.6 
          },
          data: [{ yAxis: 90 }]
        }
      };
    };

    const series = [];
    if (visible.cpu) series.push(makeSeries('cpu', cpuData));
    if (visible.ram) series.push(makeSeries('ram', ramData));

    return {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 600,
      grid: { top: 16, right: 24, bottom: 90, left: 48, containLabel: false },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: { color: 'rgba(16,185,129,0.35)', type: 'dashed', width: 1 },
          label: { show: false },
        },
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        borderRadius: 8,
        padding: [8, 10],
        extraCssText: 'box-shadow:0 2px 8px rgba(0,0,0,0.08);',
        formatter: tooltipFormatter,
      },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        min: chartStart,
        max: chartEnd,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 10, formatter: v => formatAxisTime(v, rangeHours) },
        splitLine: { show: true, lineStyle: { color: 'rgba(148,163,184,0.07)', type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 10, formatter: '{value}%' },
        splitLine: { show: true, lineStyle: { color: 'rgba(148,163,184,0.08)', type: 'dashed' } },
        splitNumber: 5,
      },
      dataZoom: [
        { type: 'inside', minValueSpan: 60000, zoomLock: false, filterMode: 'none' },
        {
          type: 'slider',
          filterMode: 'none',
          bottom: 8,
          height: 28,
          borderColor: 'rgba(148,163,184,0.12)',
          backgroundColor: 'rgba(148,163,184,0.03)',
          fillerColor: 'rgba(16,185,129,0.08)',
          dataBackground: {
            lineStyle: { color: 'rgba(16,185,129,0.25)', width: 1 },
            areaStyle: { color: 'rgba(16,185,129,0.06)' },
          },
          selectedDataBackground: {
            lineStyle: { color: 'rgba(16,185,129,0.5)' },
            areaStyle: { color: 'rgba(16,185,129,0.12)' },
          },
          handleStyle: { color: '#10b981', borderColor: '#10b981' },
          handleSize: '80%',
          textStyle: { color: '#94a3b8', fontSize: 9 },
          brushSelect: false,
          emphasis: { handleStyle: { color: '#34d399' } },
          labelFormatter: (value) => {
            const d = new Date(value);
            const date = d.toLocaleDateString([], { month: 'short', day: '2-digit' });
            const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return date + '\n' + time;
          },
        },
      ],
      series,
    };
  }, [history, visible, chartStart, chartEnd, selectedRange]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const sampleCount = history.length;

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      {/* ── Header Bar ────────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-3 flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col">
            <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
              <Activity className="h-4.5 w-4.5 text-emerald-500" />
              Telemetry Monitor
              {liveMode && (
                <span className="relative flex h-2 w-2 ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </h3>
            {isUsingCustom ? (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Custom Range</span>
                <button onClick={onClearCustomRange} className="text-muted-foreground hover:text-red-500 transition-colors"><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-0.5">High-fidelity resource telemetry · {selectedRange?.label} window</p>
            )}
          </div>

          {/* Time range pills */}
          <div className="flex items-center gap-1 bg-secondary/30 p-0.5 rounded-lg border border-border/40">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCalendar(!showCalendar)}
                className={`px-2.5 py-1.5 rounded-md flex items-center gap-1.5 border-r border-border/30 transition-colors text-[10px] font-semibold uppercase tracking-wider ${showCalendar || isUsingCustom ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <CalendarIcon className="h-3 w-3" />
              </button>
              {showCalendar && (
                <div className="absolute top-full left-0 mt-2 p-4 bg-card border border-border rounded-xl shadow-2xl z-30 w-72 animate-in fade-in zoom-in-95 duration-200">
                  <h4 className="text-xs font-bold uppercase mb-3 text-muted-foreground">Custom Time Window</h4>
                  <form onSubmit={(e) => { onApplyCustomRange(e); setShowCalendar(false); }} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">From</label>
                      <input type="datetime-local" value={customRange.start || ''} onChange={e => onCustomRangeChange(prev => ({ ...prev, start: e.target.value }))} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs focus:ring-1 ring-primary outline-none" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">To (Optional)</label>
                      <input type="datetime-local" value={customRange.end || ''} onChange={e => onCustomRangeChange(prev => ({ ...prev, end: e.target.value }))} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs focus:ring-1 ring-primary outline-none" />
                    </div>
                    <Button type="submit" size="sm" className="w-full">Load History</Button>
                  </form>
                </div>
              )}
            </div>
            {timeRanges.map(range => (
              <button
                key={range.label}
                onClick={() => onRangeChange(range)}
                className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-tight rounded-md transition-all whitespace-nowrap ${
                  selectedRange?.label === range.label && !isUsingCustom
                    ? 'bg-card text-primary shadow-sm ring-1 ring-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Feature toggles ────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(SERIES_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setVisible(prev => ({ ...prev, [key]: !prev[key] }))}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all ${
                visible[key] ? 'text-foreground' : 'text-muted-foreground/40 line-through'
              }`}
            >
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: visible[key] ? cfg.color : '#64748b' }} />
              {cfg.label}
              {visible[key] ? <Eye className="h-2.5 w-2.5 opacity-40" /> : <EyeOff className="h-2.5 w-2.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chart Area ────────────────────────────────────────────────────── */}
      <div className="relative px-2 pb-2">
        {historyLoading && (
          <div className="absolute inset-0 bg-card/70 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-lg">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-7 w-7 text-emerald-500 animate-spin" />
              <span className="text-[10px] font-semibold text-emerald-500 animate-pulse uppercase tracking-[3px]">Loading Telemetry</span>
            </div>
          </div>
        )}

        {!historyLoading && history.length === 0 ? (
          <div className="h-[420px] flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border/50 rounded-lg mx-3 my-3 bg-secondary/5">
            <Database className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No telemetry data for this time window</p>
            <p className="text-xs text-muted-foreground/70">Data will appear as the system collects metrics</p>
            <Button variant="ghost" size="sm" onClick={onManualSync} className="mt-1 text-xs gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Trigger Collection
            </Button>
          </div>
        ) : (
          <ReactECharts
            ref={chartRef}
            option={option}
            style={{ height: '420px', width: '100%' }}
            opts={{ renderer: 'canvas' }}
            notMerge={false}
            lazyUpdate={true}
          />
        )}
      </div>

      {/* ── Footer Status Bar ─────────────────────────────────────────────── */}
      <div className="px-5 py-2.5 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 bg-secondary/5">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-medium">
          <span className="flex items-center gap-1.5 bg-secondary/40 px-2 py-0.5 rounded border border-border/30">
            <BarChart3 className="h-3 w-3" />
            {sampleCount.toLocaleString()} samples
          </span>
          {lastUpdated && (
            <span className="hidden sm:flex items-center gap-1 opacity-70">
              Last pulse: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground/50 uppercase tracking-widest font-medium">
            Scroll to zoom · Drag to pan · Brush below to navigate
          </span>
        </div>
      </div>
    </div>
  );
};

export default TelemetryGraph;
