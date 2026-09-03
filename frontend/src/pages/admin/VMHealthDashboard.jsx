/**
 * VM Health Dashboard
 * Real-time performance monitoring with persistent history, time-range filtering,
 * and custom date range selection.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { vmHealthAPI, adminAPI, getErrorMessage } from '../../services/api';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import TelemetryGraph from '@/components/TelemetryGraph';
import { format } from 'date-fns';
import {
  Server,
  Cpu,
  Database,
  HardDrive,
  Clock,
  Settings,
  RefreshCcw,
  ChevronLeft,
  Info,
  Activity,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  X,
  Users,
  ArrowUp,
  ArrowDown,
  Calendar,
  History,
  Trash2,
  TerminalSquare
} from 'lucide-react';
import ConfirmActionDialog from '../../components/ConfirmActionDialog';
import TerminalModal from '../../components/TerminalModal';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer
} from 'recharts';

// --- Presets ---
const TIME_RANGES = [
  { label: '15m', value: 0.25 },
  { label: '1h', value: 1 },
  { label: '3h', value: 3 },
  { label: '6h', value: 6 },
  { label: '24h', value: 24 },
  { label: '3d', value: 72 },
  { label: '7d', value: 168 },
  { label: '30d', value: 720 },
];

// --- Colors ---
const COLORS = {
  CPU: '#10b981', // Emerald Green
  RAM: '#3b82f6', // Electric Blue
};

// --- Helper Components ---

const GaugeCard = ({ title, value, unit, color, icon: Icon, description }) => {
  const data = [
    { value: value },
    { value: Math.max(0, 100 - value) }
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon size={80} />
      </div>

      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</h3>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-bold text-foreground">{value}</span>
            <span className="text-sm font-medium text-muted-foreground">{unit}</span>
          </div>
        </div>
      </div>

      <div className="h-32 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="80%"
              startAngle={180}
              endAngle={0}
              innerRadius={50}
              outerRadius={70}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
              animationDuration={1000}
            >
              <Cell fill={color === 'CPU' ? COLORS.CPU : (color === 'RAM' ? COLORS.RAM : `hsl(var(--${color}))`)} />
              <Cell fill="hsl(var(--secondary))" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {description && <p className="text-xs text-muted-foreground mt-2">{description}</p>}
    </div>
  );
};

const MetricRow = ({ label, value, subValue, icon: Icon }) => (
  <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-md bg-secondary/50 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
    <div className="text-right">
      <p className="text-sm font-semibold text-foreground">{value}</p>
      {subValue && <p className="text-[10px] text-muted-foreground uppercase">{subValue}</p>}
    </div>
  </div>
);

const DiskUsage = ({ disk }) => {
  const isHealthy = disk.UsedPercent < 85;
  const isCritical = disk.UsedPercent > 95;

  return (
    <div className="space-y-2 p-4 border border-border rounded-lg bg-secondary/20">
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-muted-foreground" />
          <span className="font-bold">{disk.DeviceID}</span>
        </div>
        <span className="text-muted-foreground">{disk.UsedGB} GB / {disk.SizeGB} GB</span>
      </div>
      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${disk.UsedPercent}%`, backgroundColor: isCritical ? '#ef4444' : (isHealthy ? 'hsl(var(--primary))' : '#f59e0b') }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground font-medium uppercase">
        <span>{disk.UsedPercent}% Used</span>
        <span>{disk.FreeGB} GB Free</span>
      </div>
    </div>
  );
};

const VMHealthDashboard = () => {
  const { vmId } = useParams();
  const navigate = useNavigate();
  const [vm, setVm] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [allHistory, setAllHistory] = useState([]); // ALL data from DB + live
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedRange, setSelectedRange] = useState(TIME_RANGES[1]); // Default 1h

  const [actionLoading, setActionLoading] = useState(null);

  // Range / Calendar state
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [isUsingCustom, setIsUsingCustom] = useState(false);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  const pollTimerRef = useRef(null);

  const handlePowerActionClick = (action) => {
    setPendingAction(action);
    setIsConfirmOpen(true);
  };

  const handlePowerActionConfirm = async (password) => {
    const action = pendingAction;
    if (!action) return;

    setActionLoading(`power_${action}`);
    try {
      await vmHealthAPI.powerAction(vmId, action, password);
      alert(`VM is now ${action === 'reboot' ? 'rebooting' : 'shutting down'}.`);
      if (action === 'shutdown') navigate('/admin/vms');
    } catch (err) {
      alert(`Failed to ${action} VM: ` + getErrorMessage(err));
    } finally {
      setActionLoading(null);
      setPendingAction(null);
    }
  };

  const handleSessionAction = async (sessionId, username, action) => {
    if (!window.confirm(`Are you sure you want to ${action} ${username} (Session ${sessionId})?`)) return;
    setActionLoading(`session_${sessionId}`);
    try {
      await vmHealthAPI.rdpSessionAction(vmId, sessionId, action);
      fetchLiveTelemetry(false); // refresh immediately
    } catch (err) {
      alert(`Failed to ${action} session: ` + getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };

  // Fetch history from DB — smart routing (raw ≤24h, compressed >24h)
  // Re-runs when the selected time range changes so the right collection is queried.
  const fetchAllHistory = useCallback(async (hours) => {
    setHistoryLoading(true);
    try {
      // If hours is not provided, we should ideally use a ref, but since we always 
      // pass it from handleRangeChange, we can safely just use it.
      // For the initial load and visibility change, we use a hack to bypass the dependency loop.
      const rangeVal = hours || document.getElementById('range-val-hack')?.value || 1;
      const data = await vmHealthAPI.getHistory(vmId, rangeVal);
      setAllHistory(data);
    } catch (err) {
      console.error('History fetch failed:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [vmId]);

  // Live polling — appends new points to allHistory
  const fetchLiveTelemetry = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    else setPolling(true);

    setError('');
    try {
      if (isInitial) {
        const vmData = await adminAPI.getVM(vmId);
        setVm(vmData);

      }

      const data = await vmHealthAPI.getTelemetry(vmId);
      setTelemetry(data);
      const now = new Date();
      setLastUpdated(now);

      const newPoint = {
        timestamp: now.getTime(),
        cpu: data.cpu.loadPercent,
        ram: data.memory.usedPercent
      };

      setAllHistory(prev => {
        // Avoid duplicate if same second
        if (prev.length > 0 && Math.abs(prev[prev.length - 1].timestamp - newPoint.timestamp) < 1000) {
          return prev;
        }
        return [...prev, newPoint];
      });

    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      if (isInitial) setLoading(false);
      setPolling(false);
    }
  }, [vmId]);

  // Initial load: fetch history once + start smart polling loop
  // Fix 4: Poll every 10s ONLY when the browser tab is visible.
  //         When tab is hidden, skip the network call but keep the timer alive.
  //         When admin comes back → tab becomes visible → next tick fetches immediately.
  useEffect(() => {
    let isCancelled = false;
    let timer = null;

    const poll = async () => {
      if (isCancelled) return;

      // Fix 4: Skip fetch when tab is hidden — saves backend load
      if (!document.hidden) {
        await fetchLiveTelemetry(false);
      }

      if (!isCancelled) {
        timer = setTimeout(poll, 10000); // always reschedule
      }
    };

    const init = async () => {
      // Fetch history for the currently selected range
      await fetchAllHistory(selectedRange.value);
      await fetchLiveTelemetry(true);
      if (!isCancelled) {
        timer = setTimeout(poll, 10000);
      }
    };

    init();

    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [vmId, fetchAllHistory, fetchLiveTelemetry]);

  // Handle tab visibility changes to fill gaps when returning to the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab became visible again. Fetch full history to fill any gaps
        // that occurred while background polling was paused.
        fetchAllHistory();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [fetchAllHistory]);

  const applyCustomRange = (e) => {
    e.preventDefault();
    if (!customRange.start) return;
    setIsUsingCustom(true);
  };

  // When time range changes, re-fetch history from the correct collection
  const handleRangeChange = (range) => {
    setIsUsingCustom(false);
    setSelectedRange(range);
    fetchAllHistory(range.value);  // Fix 4/6: re-query with new hours value
  };

  const clearCustomRange = () => {
    setIsUsingCustom(false);
    setCustomRange({ start: '', end: '' });
  };

  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor(seconds % (3600 * 24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    return `${d}d ${h}h ${m}m`;
  };

  // ---- VIEW LAYER: Filters just compute the visible window ----
  const chartEnd = isUsingCustom && customRange.end
    ? new Date(customRange.end).getTime()
    : Math.max(lastUpdated ? lastUpdated.getTime() : Date.now(), allHistory.length > 0 ? allHistory[allHistory.length - 1].timestamp : 0);

  const rangeMs = selectedRange.value * 3600 * 1000;
  const standardStart = chartEnd - rangeMs;

  const chartStart = isUsingCustom && customRange.start
    ? new Date(customRange.start).getTime()
    : standardStart;

  // Filter allHistory to only points within the visible window
  const history = allHistory.filter(p => p.timestamp >= chartStart && p.timestamp <= chartEnd);


  if (loading) {

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <Activity className="h-6 w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-50" />
        </div>
        <p className="text-muted-foreground animate-pulse font-medium">Gathering telemetry history dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <input type="hidden" id="range-val-hack" value={selectedRange.value} />
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full bg-secondary/50 hover:bg-secondary border-border"
            onClick={() => navigate('/admin/vms')}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Server className="h-6 w-6 text-primary" />
              {vm?.name || 'VM Health Monitor'}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                {vm?.ip_address}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                <div className={`h-2 w-2 rounded-full ${vm?.health_status === 'healthy' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                {vm?.health_status || 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-2 mr-4 border-r border-border pr-4">
            <Button
              variant="outline"
              size="sm"
              className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 text-xs"
              onClick={() => setIsTerminalOpen(true)}
            >
              <TerminalSquare className="h-3 w-3 mr-1" />
              Terminal
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10 text-xs"
              onClick={() => handlePowerActionClick('reboot')}
              disabled={actionLoading}
            >
              {actionLoading === 'power_reboot' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCcw className="h-3 w-3 mr-1" />}
              Reboot
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs"
              onClick={() => handlePowerActionClick('shutdown')}
              disabled={actionLoading}
            >
              {actionLoading === 'power_shutdown' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Settings className="h-3 w-3 mr-1" />}
              Shutdown
            </Button>
          </div>
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-[10px] text-muted-foreground uppercase font-bold text-emerald-500">Telemetry Active</span>
            {lastUpdated && (
              <span className="text-[11px] text-muted-foreground">Pulse: {lastUpdated.toLocaleTimeString()}</span>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="gap-2 bg-primary/5 hover:bg-primary/10 text-primary border-primary/20"
            onClick={() => fetchLiveTelemetry(false)}
            disabled={polling}
          >
            <RefreshCcw className={`h-4 w-4 ${polling ? 'animate-spin' : ''}`} />
            Sync Now
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="border-red-500/50 bg-red-500/5">
          <AlertTriangle className="h-4 w-4" />
          <div className="flex flex-col">
            <span className="font-bold">Connection Warning</span>
            <span className="text-sm">{error}</span>
          </div>
        </Alert>
      )}

      {telemetry && (
        <>
          {/* Top Row: Gauges */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <GaugeCard
              title="CPU Load"
              value={telemetry.cpu.loadPercent}
              unit="%"
              color="emerald-500"
              icon={Cpu}
              description="Real-time processor utilization pulse."
            />
            <GaugeCard
              title="RAM Usage"
              value={Math.round(telemetry.memory.usedPercent)}
              unit="%"
              color="blue-500"
              icon={Database}
              description={`${telemetry.memory.usedGB} GB of ${telemetry.memory.totalGB} GB utilized.`}
            />

            {/* System Info Panel */}
            <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-border bg-secondary/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold uppercase tracking-wider">System Hardware</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-2 py-0.5 rounded bg-secondary text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    Build {telemetry.os.build}
                  </div>
                </div>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 flex-grow">
                <MetricRow
                  label="Processor"
                  value={telemetry.cpu.model || 'Unknown'}
                  subValue={`${telemetry.cpu.cores} Cores / ${telemetry.cpu.threads} Threads`}
                  icon={Cpu}
                />
                <MetricRow
                  label="Memory (RAM)"
                  value={`${telemetry.memory.totalGB} GB`}
                  subValue="ECC Hardware Memory"
                  icon={Database}
                />
                <MetricRow
                  label="Active Uptime"
                  value={formatUptime(telemetry.os.uptimeSeconds)}
                  subValue={`Boot: ${telemetry.os.lastBoot}`}
                  icon={Clock}
                />
                <MetricRow
                  label="OS Family"
                  value={telemetry.os.caption.replace('Microsoft ', '')}
                  icon={Settings}
                />
              </div>

            </div>
          </div>

          {/* ── Telemetry Monitor ── */}
          <TelemetryGraph
            history={history}
            historyLoading={historyLoading}
            selectedRange={selectedRange}
            timeRanges={TIME_RANGES}
            onRangeChange={handleRangeChange}
            isUsingCustom={isUsingCustom}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
            onApplyCustomRange={applyCustomRange}
            onClearCustomRange={clearCustomRange}
            onManualSync={() => fetchLiveTelemetry(false)}
            chartStart={chartStart}
            chartEnd={chartEnd}
            lastUpdated={lastUpdated}
          />

          {/* Storage Topology */}
          <div className="bg-card border border-border rounded-xl shadow-sm p-6 flex flex-col">
            <div className="flex flex-col mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-foreground">
                <HardDrive className="h-5 w-5 text-emerald-500" />
                Storage Topology
              </h3>
              <p className="text-xs text-muted-foreground">Volume status and free space availability</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
              {telemetry.disks.map((disk) => (
                <DiskUsage key={disk.DeviceID} disk={disk} />
              ))}
            </div>
          </div>

          {/* ── Additional Analytics (I/O & Sessions) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">

            {/* Modern Disk I/O Panel */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-border flex items-center justify-between bg-gradient-to-r from-secondary/40 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Activity className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold uppercase tracking-wider text-foreground">Disk I/O Pipeline</span>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Real-time throughput</span>
                  </div>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5 flex-grow bg-secondary/5">
                {/* Read Widget */}
                <div className="relative overflow-hidden flex flex-col p-5 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-widest">
                      <ArrowUp className="h-4 w-4" /> Read Transfer
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5 my-2">
                    <span className="text-4xl font-black tracking-tighter text-foreground">
                      {telemetry.disk_io ? (telemetry.disk_io.readBytesPerSec / 1024 / 1024).toFixed(1) : '0.0'}
                    </span>
                    <span className="text-sm font-bold text-muted-foreground uppercase">MB/s</span>
                  </div>
                  <div className="mt-auto pt-4 border-t border-blue-500/10 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Operations</span>
                    <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                      {telemetry.disk_io?.readsPerSec || 0} IOPS
                    </span>
                  </div>
                </div>

                {/* Write Widget */}
                <div className="relative overflow-hidden flex flex-col p-5 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-widest">
                      <ArrowDown className="h-4 w-4" /> Write Transfer
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5 my-2">
                    <span className="text-4xl font-black tracking-tighter text-foreground">
                      {telemetry.disk_io ? (telemetry.disk_io.writeBytesPerSec / 1024 / 1024).toFixed(1) : '0.0'}
                    </span>
                    <span className="text-sm font-bold text-muted-foreground uppercase">MB/s</span>
                  </div>
                  <div className="mt-auto pt-4 border-t border-emerald-500/10 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Operations</span>
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      {telemetry.disk_io?.writesPerSec || 0} IOPS
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modern Network I/O Panel */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-border flex items-center justify-between bg-gradient-to-r from-secondary/40 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Activity className="h-5 w-5 text-purple-500" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold uppercase tracking-wider text-foreground">Network I/O Pipeline</span>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Real-time bandwidth</span>
                  </div>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5 flex-grow bg-secondary/5">
                {/* Receive Widget */}
                <div className="relative overflow-hidden flex flex-col p-5 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest">
                      <ArrowDown className="h-4 w-4" /> Receive Traffic
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5 my-2">
                    <span className="text-4xl font-black tracking-tighter text-foreground">
                      {telemetry.network_io ? (telemetry.network_io.bytesReceivedPerSec * 8 / 1024 / 1024).toFixed(1) : '0.0'}
                    </span>
                    <span className="text-sm font-bold text-muted-foreground uppercase">Mbps</span>
                  </div>
                </div>

                {/* Send Widget */}
                <div className="relative overflow-hidden flex flex-col p-5 rounded-2xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-pink-500/5 to-transparent shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1.5 text-pink-600 dark:text-pink-400 text-xs font-bold uppercase tracking-widest">
                      <ArrowUp className="h-4 w-4" /> Send Traffic
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5 my-2">
                    <span className="text-4xl font-black tracking-tighter text-foreground">
                      {telemetry.network_io ? (telemetry.network_io.bytesSentPerSec * 8 / 1024 / 1024).toFixed(1) : '0.0'}
                    </span>
                    <span className="text-sm font-bold text-muted-foreground uppercase">Mbps</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modern RDP Sessions Panel */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-border flex items-center justify-between bg-gradient-to-r from-secondary/40 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <Users className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold uppercase tracking-wider text-foreground">Active RDP Sessions</span>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Remote Access Log</span>
                  </div>
                </div>
                {telemetry.active_users && telemetry.active_users.length > 0 && (
                  <span className="text-xs font-bold bg-indigo-500 text-white px-3 py-1 rounded-full shadow-sm">
                    {telemetry.active_users.length} Active
                  </span>
                )}
              </div>
              <div className="p-0 flex-grow overflow-y-auto max-h-[250px] no-scrollbar bg-card">
                {telemetry.active_users && telemetry.active_users.length > 0 ? (
                  <div className="flex flex-col divide-y divide-border/40">
                    {telemetry.active_users.map((user, idx) => {
                      const isIdle = user.idleTime && user.idleTime !== '.' && user.idleTime !== 'none';
                      const avatarColors = ['bg-blue-500/10 text-blue-600', 'bg-rose-500/10 text-rose-600', 'bg-amber-500/10 text-amber-600', 'bg-emerald-500/10 text-emerald-600'];
                      const avatarColor = avatarColors[idx % avatarColors.length];

                      return (
                        <div key={idx} className="flex items-center justify-between p-4 hover:bg-secondary/40 transition-all duration-300 group">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className={`h-11 w-11 rounded-2xl flex items-center justify-center font-bold text-sm shadow-sm ${avatarColor}`}>
                                {user.username.substring(0, 2).toUpperCase()}
                              </div>
                              {/* Status dot */}
                              <div className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-card ${user.state === 'Disc' ? 'bg-zinc-400' : (isIdle ? 'bg-amber-400' : 'bg-emerald-500')}`}></div>
                            </div>
                            <div className="flex flex-col">
                              <p className="text-sm font-bold text-foreground group-hover:text-indigo-500 transition-colors">{user.username}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                                  <Clock className="h-3 w-3 opacity-70" /> {user.logonTime}
                                </p>
                                {(user.cpuPercent !== undefined || user.memoryMB !== undefined) && (
                                  <>
                                    <span className="text-muted-foreground opacity-30 text-[10px]">|</span>
                                    <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                      <Cpu className="h-3 w-3" /> {user.cpuPercent || 0}%
                                    </p>
                                    <span className="text-muted-foreground opacity-30 text-[10px]">|</span>
                                    <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                      <Database className="h-3 w-3" /> {user.memoryMB ? user.memoryMB.toLocaleString() : 0} MB
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            {user.state === 'Disc' ? (
                              <span className="text-[10px] font-bold text-zinc-500 bg-zinc-500/15 px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400"></span> Disconnected
                              </span>
                            ) : isIdle ? (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-500/15 px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span> Idle {user.idleTime}
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 rounded-lg">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span>
                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Online</span>
                              </div>
                            )}
                            <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px] bg-secondary/50 hover:bg-rose-500/10 hover:text-rose-500"
                                onClick={() => handleSessionAction(user.sessionId, user.username, 'logoff')}
                                disabled={actionLoading}
                              >
                                {actionLoading === `session_${user.sessionId}` ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Logoff'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px] bg-secondary/50 hover:bg-amber-500/10 hover:text-amber-500"
                                onClick={() => handleSessionAction(user.sessionId, user.username, 'disconnect')}
                                disabled={actionLoading}
                              >
                                Disconnect
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[200px] p-8 text-muted-foreground bg-secondary/10">
                    <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mb-3">
                      <Users className="h-6 w-6 opacity-40" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">No Active Sessions</p>
                    <p className="text-xs mt-1 text-center max-w-[200px]">No users are currently connected via Remote Desktop.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}



      <ConfirmActionDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handlePowerActionConfirm}
        title={`Confirm VM ${pendingAction === 'reboot' ? 'Reboot' : 'Shutdown'}`}
        description={vm ? `You are about to ${pendingAction} ${vm.name} (${vm.ip_address}). This will disconnect all users and may interrupt ongoing tasks. Enter your PassPortal password to authorize this action.` : `Are you sure you want to ${pendingAction} this VM? This will disconnect all active users and potentially interrupt ongoing tasks. Enter your PassPortal password to authorize this action.`}
        actionLabel={pendingAction === 'reboot' ? 'Reboot VM' : 'Shutdown VM'}
        variant={pendingAction === 'reboot' ? 'primary' : 'destructive'}
        isLoading={actionLoading !== null}
      />

      <style dangerouslySetInnerHTML={{
        __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
      <TerminalModal 
        isOpen={isTerminalOpen} 
        onClose={() => setIsTerminalOpen(false)} 
        vmId={vmId} 
        vmName={vm?.name} 
      />
    </div>
  );
};

export default VMHealthDashboard;
