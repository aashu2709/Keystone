/**
 * Admin: Manage Certificates — Shadcn UI Redesign
 */

import { useState, useEffect, useRef } from 'react';
import { adminAPI, certificateAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { RefreshCw, Server, AlertTriangle, ShieldAlert, Award, Search, ChevronDown, CheckCircle2, Loader2 } from 'lucide-react';

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
        className="w-full flex items-center justify-between px-3 py-2 border border-input rounded-md bg-transparent text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring overflow-hidden"
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

const ManageCertificates = () => {
  const [vms, setVms] = useState([]);
  const [loadingVMs, setLoadingVMs] = useState(true);
  const [selectedVM, setSelectedVM] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchVMs(); }, []);
  useEffect(() => { if (selectedVM) fetchCertificates(); else setCertificates([]); }, [selectedVM]);

  const fetchVMs = async () => {
    try { setLoadingVMs(true); const res = await adminAPI.getVMs({ limit: 500 }); setVms(res.vms || []); }
    catch { toast.error('Failed to load VMs'); } finally { setLoadingVMs(false); }
  };

  const fetchCertificates = async () => {
    try { setLoadingCerts(true); const data = await certificateAPI.getCertificates(selectedVM); setCertificates(data.certificates || []); }
    catch (err) { toast.error(err.message || 'Failed to fetch certificates'); setCertificates([]); }
    finally { setLoadingCerts(false); }
  };

  const filteredCerts = certificates.filter(c =>
    c.subject.toLowerCase().includes(searchQuery.toLowerCase()) || c.thumbprint.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Certificate Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Track IIS-bound SSL/TLS certificates and monitor expirations.</p>
        </div>
        <Button variant="outline" onClick={fetchCertificates} disabled={!selectedVM || loadingCerts}>
          <RefreshCw className={cn("h-4 w-4", loadingCerts && "animate-spin")} />
          {loadingCerts ? 'Scanning...' : 'Refresh'}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <VMSelector vms={vms} selectedVM={selectedVM} setSelectedVM={setSelectedVM} loading={loadingVMs} />

          {selectedVM && !loadingCerts && certificates.length > 0 && (
            <div className="mb-4 relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Search by Subject or Thumbprint..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
          )}

          <div className="rounded-lg border border-border overflow-hidden">
            {loadingCerts ? (
              <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                <h3 className="text-base font-semibold text-foreground">Scanning IIS Bindings</h3>
                <p className="text-sm text-muted-foreground mt-1">Querying HTTPS bindings...</p>
              </div>
            ) : !selectedVM ? (
              <div className="p-12 text-center">
                <div className="rounded-full bg-muted p-4 w-fit mx-auto mb-4"><Server className="h-8 w-8 text-muted-foreground" /></div>
                <h3 className="text-base font-semibold text-foreground">No Server Selected</h3>
                <p className="text-sm text-muted-foreground mt-1">Select a target server from the dropdown above.</p>
              </div>
            ) : certificates.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm text-muted-foreground">No certificates found on this server.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Subject</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-xs">IIS Site</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Binding</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Valid From</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Expires</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredCerts.map((cert) => {
                      const isExpired = cert.days_remaining < 0;
                      const isWarning = cert.days_remaining >= 0 && cert.days_remaining <= 30;
                      return (
                        <tr key={cert.thumbprint} className={cn("transition-colors", isExpired ? "bg-destructive/5" : isWarning ? "bg-amber-50/50" : "hover:bg-muted/50")}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground truncate max-w-[200px]" title={cert.subject}>{cert.subject}</div>
                            <div className="text-[11px] text-muted-foreground font-mono mt-0.5" title={cert.thumbprint}>{cert.thumbprint.substring(0, 16)}...</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground text-xs">{cert.site_name || 'N/A'}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {cert.site_state === 'Started'
                                ? <span className="inline-flex items-center gap-1 text-emerald-600"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />Running</span>
                                : <span className="inline-flex items-center gap-1 text-muted-foreground"><span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full" />{cert.site_state || 'Unknown'}</span>
                              }
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="info" className="font-mono">:{cert.binding_port || '443'}</Badge>
                            {cert.host_header && cert.host_header !== '(All Unassigned)' && <span className="text-xs text-muted-foreground ml-1">{cert.host_header}</span>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{cert.not_before}</td>
                          <td className={cn("px-4 py-3 text-xs font-medium", isExpired ? "text-destructive" : isWarning ? "text-amber-600" : "text-foreground")}>{cert.not_after}</td>
                          <td className="px-4 py-3">
                            {isExpired
                              ? <Badge variant="danger"><AlertTriangle className="h-3 w-3 mr-1" />Expired ({cert.days_remaining * -1}d ago)</Badge>
                              : isWarning
                                ? <Badge variant="warning"><ShieldAlert className="h-3 w-3 mr-1" />{cert.days_remaining} Days Left</Badge>
                                : <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" />Valid ({cert.days_remaining}d)</Badge>
                            }
                          </td>
                        </tr>
                      );
                    })}
                    {filteredCerts.length === 0 && (
                      <tr><td colSpan="6" className="px-4 py-8 text-center text-sm text-muted-foreground">No certificates match your search.</td></tr>
                    )}
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

export default ManageCertificates;
