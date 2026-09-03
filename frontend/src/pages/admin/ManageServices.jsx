/**
 * Admin: Manage Services — Shadcn UI Redesign
 */

import { useState, useEffect, useRef } from 'react';
import { adminAPI, serviceAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { RefreshCw, Server, Search, ChevronDown, CheckCircle2, Loader2, Play, Square, RotateCw, Activity } from 'lucide-react';

const VMSelector = ({ vms, selectedVM, setSelectedVM, loading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredVMs = vms.filter(vm => vm.name.toLowerCase().includes(searchTerm.toLowerCase()) || vm.ip_address.includes(searchTerm));
  const selectedVMObj = vms.find(v => v.id === selectedVM);

  return (
    <div className="relative mb-5" ref={dropdownRef}>
      <label className="text-sm font-medium text-foreground mb-1.5 block">Select Target Server</label>
      <button type="button" onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 border border-input rounded-md bg-transparent text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring overflow-hidden"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Server className={cn("h-4 w-4 shrink-0", selectedVMObj ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("truncate font-medium", selectedVMObj ? "text-foreground" : "text-muted-foreground")}>
            {selectedVMObj ? `${selectedVMObj.name} (${selectedVMObj.ip_address})` : 'Choose a server...'}
          </span>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-md overflow-hidden">
          <div className="p-2.5 border-b border-border bg-muted/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input autoFocus type="text" placeholder="Filter by name or IP..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {loading ? <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
            : filteredVMs.length === 0 ? <div className="p-4 text-center text-sm text-muted-foreground">No servers found.</div>
            : filteredVMs.map(vm => (
              <button key={vm.id} onClick={() => { setSelectedVM(vm.id); setIsOpen(false); }}
                className={cn("w-full flex items-center justify-between p-2.5 rounded-md transition-colors text-sm",
                  selectedVM === vm.id ? "bg-accent" : "hover:bg-muted/50"
                )}>
                <div className="flex flex-col text-left">
                  <span className="font-medium text-foreground">{vm.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{vm.ip_address}</span>
                </div>
                {selectedVM === vm.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ManageServices = () => {
  const [vms, setVms] = useState([]);
  const [loadingVMs, setLoadingVMs] = useState(true);
  const [selectedVM, setSelectedVM] = useState(null);
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // Traces { serviceName: 'start'|'stop' }

  useEffect(() => { fetchVMs(); }, []);
  useEffect(() => { if (selectedVM) fetchServices(); else setServices([]); }, [selectedVM]);

  const fetchVMs = async () => {
    try { setLoadingVMs(true); const res = await adminAPI.getVMs({ limit: 500 }); setVms(res.vms || []); }
    catch { toast.error('Failed to load VMs'); } finally { setLoadingVMs(false); }
  };

  const fetchServices = async () => {
    try { setLoadingServices(true); const data = await serviceAPI.getServices(selectedVM); setServices(data || []); }
    catch (err) { toast.error(err.message || 'Failed to fetch services'); setServices([]); }
    finally { setLoadingServices(false); }
  };

  const handleStateChange = async (serviceName, action) => {
    try {
      setActionLoading({ name: serviceName, action });
      const res = await serviceAPI.changeState(selectedVM, serviceName, action);
      toast.success(res.message || `Service ${action}ed`);
      setServices(prev => prev.map(s => s.Name === serviceName ? { ...s, Status: res.Status || s.Status } : s));
      // Re-fetch to ensure sync after action, though manual tracking above helps UI feel snappy
      await fetchServices();
    } catch (err) {
      toast.error(err.message || `Failed to ${action} service`);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredServices = services.filter(s =>
    (s.Name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.DisplayName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
             <Activity className="h-6 w-6 text-primary"/> Windows Services
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and monitor Windows Services on target VMs via WinRM.</p>
        </div>
        <Button variant="outline" onClick={fetchServices} disabled={!selectedVM || loadingServices}>
          <RefreshCw className={cn("h-4 w-4", loadingServices && "animate-spin")} />
          {loadingServices ? 'Scanning...' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <VMSelector vms={vms} selectedVM={selectedVM} setSelectedVM={setSelectedVM} loading={loadingVMs} />

          {selectedVM && !loadingServices && services.length > 0 && (
            <div className="mb-4 relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Search by Name or Display Name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
          )}

          <div className="rounded-lg border border-border overflow-hidden">
             {loadingServices ? (
              <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                <h3 className="text-base font-semibold text-foreground">Loading Services</h3>
                <p className="text-sm text-muted-foreground mt-1">Querying server for all available services...</p>
              </div>
            ) : !selectedVM ? (
              <div className="p-12 text-center">
                <div className="rounded-full bg-muted p-4 w-fit mx-auto mb-4"><Server className="h-8 w-8 text-muted-foreground" /></div>
                <h3 className="text-base font-semibold text-foreground">No Server Selected</h3>
                <p className="text-sm text-muted-foreground mt-1">Select a target server from the dropdown above to manage its services.</p>
              </div>
            ) : services.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm text-muted-foreground">No services found on this server.</p>
              </div>
            ) : (
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative custom-scrollbar">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur shadow-sm">
                    <tr>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Name</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Display Name</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-center">Status</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Start Type</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-right">Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {filteredServices.map((svc) => {
                      const isRunning = svc.Status === 'Running';
                      const isLoadingStart = actionLoading?.name === svc.Name && actionLoading.action === 'start';
                      const isLoadingStop = actionLoading?.name === svc.Name && actionLoading.action === 'stop';
                      const isLoadingRestart = actionLoading?.name === svc.Name && actionLoading.action === 'restart';
                      const isAnyLoading = isLoadingStart || isLoadingStop || isLoadingRestart;

                      return (
                        <tr key={svc.Name} className="hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs font-semibold">{svc.Name}</td>
                          <td className="px-4 py-3 max-w-[300px] truncate" title={svc.DisplayName}>{svc.DisplayName}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={isRunning ? "success" : "secondary"} className={cn(
                                "font-mono font-medium shadow-sm transition-colors", 
                                isRunning ? "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0] dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" : ""
                            )}>
                              {isAnyLoading ? 'Working...' : svc.Status}
                            </Badge>
                          </td>
                           <td className="px-4 py-3 text-muted-foreground capitalize">{svc.StartType.toLowerCase()}</td>
                           <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                 {isRunning ? (
                                    <Button 
                                       variant="outline" 
                                       size="icon"
                                       className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30" 
                                       title="Stop Service"
                                       disabled={isAnyLoading}
                                       onClick={() => handleStateChange(svc.Name, 'stop')}
                                    >
                                       {isLoadingStop ? <Loader2 className="h-4 w-4 animate-spin"/> : <Square className="h-4 w-4 fill-current"/>}
                                    </Button>
                                 ) : (
                                    <Button 
                                       variant="outline" 
                                       size="icon" 
                                       className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400"
                                       title="Start Service"
                                       disabled={isAnyLoading}
                                       onClick={() => handleStateChange(svc.Name, 'start')}
                                    >
                                       {isLoadingStart ? <Loader2 className="h-4 w-4 animate-spin"/> : <Play className="h-4 w-4 fill-current"/>}
                                    </Button>
                                 )}
                                  <Button 
                                       variant="outline" 
                                       size="icon" 
                                       className="h-8 w-8"
                                       title="Restart Service"
                                       disabled={isAnyLoading || !isRunning}
                                       onClick={() => handleStateChange(svc.Name, 'restart')}
                                    >
                                       {isLoadingRestart ? <Loader2 className="h-4 w-4 animate-spin"/> : <RotateCw className="h-4 w-4"/>}
                                    </Button>
                              </div>
                           </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManageServices;
