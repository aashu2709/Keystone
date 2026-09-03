import { useState, useEffect, useRef } from 'react';
import { adminAPI, firewallAPI, getErrorMessage } from '../../services/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { 
  RefreshCw, Server, Search, ChevronDown, CheckCircle2, 
  ShieldAlert, Shield, ShieldOff, Plus, Trash2, Power, Edit2, Loader2, X, Layers, Check
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';


// Reusable VM Selector
const VMSelector = ({
  selected,
  setSelected,
  vms,
  loadingVMs,
  label = 'Select Target Servers'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredVMs = vms.filter(vm =>
    vm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vm.ip_address.includes(searchTerm)
  );

  const toggleVM = (vmId) => {
    setSelected(prev => prev.includes(vmId) ? prev.filter(id => id !== vmId) : [...prev, vmId]);
  };

  const selectAllVMs = () => setSelected(vms.map(vm => vm.id));
  const deselectAllVMs = () => setSelected([]);

  return (
    <div className="relative mb-6" ref={dropdownRef}>
      <label className="text-sm font-semibold text-foreground mb-2 block">{label}</label>

      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between font-normal text-left shadow-sm h-11 border-2 focus-visible:ring-primary/20"
        type="button"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Server className={cn("h-4 w-4 shrink-0", selected.length > 0 ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("truncate font-medium", selected.length > 0 ? "text-foreground" : "text-muted-foreground")}>
            {selected.length === 0
              ? 'Select Target Servers...'
              : `${selected.length} Server${selected.length > 1 ? 's' : ''} Selected`
            }
          </span>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform opacity-50", isOpen && "rotate-180")} />
      </Button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-2.5 border-b border-border bg-muted/50 rounded-t-lg">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Target Selection</span>
              <div className="flex gap-4">
                <button type="button" onClick={selectAllVMs} className="text-[11px] text-primary hover:text-primary/80 font-bold uppercase transition-colors">All</button>
                <button type="button" onClick={deselectAllVMs} className="text-[11px] text-muted-foreground hover:text-foreground font-bold uppercase transition-colors">None</button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                placeholder="Filter by name or IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-input rounded-md bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                onClick={(e) => e.stopPropagation()}
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"><X size={12} /></button>
              )}
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
            {loadingVMs ? (
              <div className="p-8 text-center text-muted-foreground"><Loader2 size={24} className="animate-spin mx-auto mb-2 text-primary" /></div>
            ) : filteredVMs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground"><span className="text-sm italic">No matching servers found</span></div>
            ) : (
              filteredVMs.map(vm => (
                <div key={vm.id} onClick={(e) => { e.stopPropagation(); toggleVM(vm.id); }}
                  className={cn("flex items-center gap-3 p-2.5 cursor-pointer rounded-md mb-1 last:mb-0 transition-colors text-sm", selected.includes(vm.id) ? "bg-primary/10 text-primary-foreground" : "hover:bg-muted/50 text-foreground")}>
                  <div className={cn("w-4 h-4 rounded-sm border flex items-center justify-center transition-colors shrink-0 outline-none", selected.includes(vm.id) ? "bg-primary border-primary text-primary-foreground" : "border-input shrink-0 opacity-50")}>
                    {selected.includes(vm.id) && <Check size={12} strokeWidth={4} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm truncate text-foreground">{vm.name}</span>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground opacity-80 uppercase">{vm.ip_address}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-2.5 border-t border-border bg-muted/50 flex justify-between items-center text-[11px] font-medium text-muted-foreground rounded-b-lg">
            <span>Showing {filteredVMs.length} Servers</span>
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="h-7 px-3 text-xs">Close</Button>
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {vms.filter(v => selected.includes(v.id)).slice(0, 5).map(v => (
            <span key={v.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-secondary text-secondary-foreground rounded-md text-xs font-semibold shadow-sm border border-border/50">
              {v.name}
              <button type="button" onClick={() => toggleVM(v.id)} className="hover:text-foreground opacity-70 hover:opacity-100"><X size={12} /></button>
            </span>
          ))}
          {selected.length > 5 && (
            <span className="text-xs text-muted-foreground font-bold self-center ml-1">+ {selected.length - 5} more</span>
          )}
        </div>
      )}
    </div>
  );
};


const AddRuleModal = ({ isOpen, onClose, onAdd, adding, editingRule = null }) => {
  const [ruleType, setRuleType] = useState('Program');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    rule_name: '', rule_description: '', direction: 'Inbound', rule_action: 'Allow',
    profile: 'Domain,Private,Public', protocol: 'TCP', local_port: 'Any', remote_port: 'Any',
    local_address: 'Any', remote_address: 'Any', program_path: 'Any', service_name: 'Any', 
    enabled: 'True', protocol_number: '', predefined_group: '', icmp_type: 'Any', icmp_code: 'Any',
    edge_traversal: 'Block', interface_types: 'Any'
  });

  const [localProfiles, setLocalProfiles] = useState({ domain: true, private: true, public: true });
  const [localPortType, setLocalPortType] = useState('All');
  const [remotePortType, setRemotePortType] = useState('All');
  const [localAddrType, setLocalAddrType] = useState('Any');
  const [remoteAddrType, setRemoteAddrType] = useState('Any');
  const [progType, setProgType] = useState('All');
  const [actionMode, setActionMode] = useState('Allow');
  const [showSecureCustomize, setShowSecureCustomize] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      
      if (editingRule) {
        // Pre-fill form from existing rule
        setRuleType(editingRule.Program !== 'Any' ? 'Program' : (editingRule.LocalPort !== 'Any' ? 'Port' : 'Custom'));
        setFormData({
          rule_name: editingRule.DisplayName || '',
          rule_description: editingRule.Description || '',
          direction: editingRule.Direction || 'Inbound',
          rule_action: editingRule.Action || 'Allow',
          profile: editingRule.Profile || 'Domain,Private,Public',
          protocol: editingRule.Protocol || 'TCP',
          local_port: editingRule.LocalPort || 'Any',
          remote_port: editingRule.RemotePort || 'Any',
          local_address: editingRule.LocalAddress || 'Any',
          remote_address: editingRule.RemoteAddress || 'Any',
          program_path: editingRule.Program || 'Any',
          service_name: editingRule.Service || 'Any',
          enabled: editingRule.Enabled || 'True',
          predefined_group: editingRule.PredefinedGroup || '',
          edge_traversal: editingRule.EdgeTraversalPolicy || 'Block',
          interface_types: editingRule.InterfaceType || 'Any',
          icmp_type: editingRule.IcmpType || 'Any',
          icmp_code: editingRule.IcmpCode || 'Any',
          authentication: editingRule.Authentication || 'NotRequired',
          encryption: editingRule.Encryption || 'NotRequired',
          override_block_rules: editingRule.OverrideBlockRules || 'False'
        });

        // Set helper states
        setLocalProfiles({
          domain: editingRule.Profile?.includes('Domain') ?? true,
          private: editingRule.Profile?.includes('Private') ?? true,
          public: editingRule.Profile?.includes('Public') ?? true
        });
        setLocalPortType(editingRule.LocalPort === 'Any' ? 'All' : 'Specific');
        setRemotePortType(editingRule.RemotePort === 'Any' ? 'All' : 'Specific');
        setLocalAddrType(editingRule.LocalAddress === 'Any' ? 'Any' : 'Specific');
        setRemoteAddrType(editingRule.RemoteAddress === 'Any' ? 'Any' : 'Specific');
        setProgType(editingRule.Program === 'Any' ? 'All' : 'Specific');
        setActionMode(
          editingRule.Action === 'Block' ? 'Block' :
          (editingRule.Authentication && editingRule.Authentication !== 'NotRequired') ? 'AllowSecure' : 'Allow'
        );
      } else {
        // Reset for new rule
        setRuleType('Program');
        setFormData({
          rule_name: '', rule_description: '', direction: 'Inbound', rule_action: 'Allow',
          profile: 'Domain,Private,Public', protocol: 'TCP', local_port: 'Any', remote_port: 'Any',
          local_address: 'Any', remote_address: 'Any', program_path: 'Any', service_name: 'Any', 
          enabled: 'True', protocol_number: '', predefined_group: '', icmp_type: 'Any', icmp_code: 'Any',
          edge_traversal: 'Block', interface_types: 'Any', authentication: 'NotRequired', encryption: 'NotRequired', override_block_rules: 'False'
        });
        setLocalProfiles({ domain: true, private: true, public: true });
        setLocalPortType('All'); setRemotePortType('All'); setLocalAddrType('Any'); setRemoteAddrType('Any'); setProgType('All'); setActionMode('Allow');
      }
    }
  }, [isOpen, editingRule]);

  useEffect(() => {
    const selected = [];
    if (localProfiles.domain) selected.push('Domain');
    if (localProfiles.private) selected.push('Private');
    if (localProfiles.public) selected.push('Public');
    setFormData(prev => ({ ...prev, profile: selected.join(',') }));
  }, [localProfiles]);

  useEffect(() => {
    if (actionMode === 'Allow') {
      setFormData(prev => ({ ...prev, rule_action: 'Allow', authentication: 'NotRequired', encryption: 'NotRequired', override_block_rules: 'False' }));
    } else if (actionMode === 'AllowSecure') {
      setFormData(prev => ({ ...prev, rule_action: 'Allow', authentication: prev.authentication === 'NotRequired' ? 'Required' : prev.authentication }));
    } else if (actionMode === 'Block') {
      setFormData(prev => ({ ...prev, rule_action: 'Block', authentication: 'NotRequired', encryption: 'NotRequired', override_block_rules: 'False' }));
    }
  }, [actionMode]);

  if (!isOpen) return null;

  const getSteps = () => {
    if (ruleType === 'Program') return ['Rule Type', 'Program', 'Action', 'Profile', 'Name'];
    if (ruleType === 'Port') return ['Rule Type', 'Protocol and Ports', 'Action', 'Profile', 'Name'];
    return ['Rule Type', 'Program', 'Protocol and Ports', 'Scope', 'Action', 'Profile', 'Name'];
  };

  const steps = getSteps();
  const currentStepLabel = steps[step - 1];
  const isCustom = ruleType === 'Custom';

  const handleNext = () => { if (step < steps.length) setStep(step + 1); };
  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const renderStepContent = () => {
    switch (currentStepLabel) {
      case 'Rule Type':
        return (
          <div className="space-y-6 text-left">
            <h4 className="text-sm font-semibold text-foreground">What type of rule would you like to create?</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { id: 'Program', label: 'Program', desc: 'Rule that controls connections for a program.' },
                { id: 'Port', label: 'Port', desc: 'Rule that controls connections for a TCP or UDP port.' },
                { id: 'Custom', label: 'Custom', desc: 'Custom rule.' }
              ].map(opt => (
                <label key={opt.id} className={cn("flex items-start gap-3 p-4 rounded-lg border-2 transition-all cursor-pointer", ruleType === opt.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30')}>
                  <input type="radio" name="ruleType" className="mt-1 w-4 h-4 text-primary accent-primary shrink-0" checked={ruleType === opt.id} onChange={() => setRuleType(opt.id)} />
                  <div className="w-full relative">
                    <span className="block font-semibold text-foreground text-sm mb-1">{opt.label}</span>
                    <span className="text-xs text-muted-foreground leading-tight block">{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        );

      case 'Program':
        return (
          <div className="space-y-8 text-left animate-in fade-in slide-in-from-right-4">
            <div className="bg-primary/10 p-4 rounded-xl border border-primary/20 flex items-start gap-3 mb-6">
              <Shield size={20} className="text-primary mt-1 shrink-0" />
              <p className="text-xs text-primary font-medium leading-relaxed">Rules for programs allow communication through any port, but only for the specified executable.</p>
            </div>
            <div className="space-y-8">
              <div className="flex flex-col gap-6">
                <label className="flex items-start gap-4 cursor-pointer group p-2">
                  <input type="radio" className="mt-1 w-4 h-4" checked={progType === 'All'} onChange={() => { setProgType('All'); setFormData({...formData, program_path: 'Any', service_name: 'Any'}); }} />
                  <div>
                    <span className="block text-sm font-semibold text-foreground">All programs</span>
                    <span className="block text-xs text-muted-foreground">Applies to all connections that match other rule properties.</span>
                  </div>
                </label>
                <label className="flex items-start gap-4 cursor-pointer group p-2">
                  <input type="radio" className="mt-1 w-4 h-4" checked={progType === 'Specific'} onChange={() => setProgType('Specific')} />
                  <div className="flex-1">
                    <span className="block text-sm font-semibold text-foreground">This program path:</span>
                    {progType === 'Specific' && (
                      <div className="mt-3">
                        <input type="text" placeholder="e.g. %SystemDrive%\Path\to\exe" value={formData.program_path === 'Any' ? '' : formData.program_path} onChange={(e) => setFormData({...formData, program_path: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono" />
                      </div>
                    )}
                  </div>
                </label>
                <div className="pt-6 border-t border-border">
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Service Settings</label>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" checked={formData.service_name === 'Any'} onChange={() => setFormData({...formData, service_name: 'Any'})} />
                      <span className="text-xs font-medium text-muted-foreground">Apply to all programs and services</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" checked={formData.service_name !== 'Any'} onChange={() => setFormData({...formData, service_name: ''})} />
                      <span className="text-xs font-medium text-muted-foreground">Apply to this service:</span>
                    </label>
                    {formData.service_name !== 'Any' && (
                      <input type="text" placeholder="Short name (e.g., WinRM)" value={formData.service_name} onChange={(e) => setFormData({...formData, service_name: e.target.value})} className="ml-7 flex h-9 w-2/3 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );



      case 'Protocol and Ports':
        return (
          <div className="space-y-8 text-left animate-in fade-in slide-in-from-right-4">
            <h4 className="text-sm font-semibold text-foreground mb-6">To which ports and protocols does this rule apply?</h4>
            <div className="space-y-10">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Protocol Type</label>
                <Select value={formData.protocol} onValueChange={(val) => setFormData({...formData, protocol: val})}>
                  <SelectTrigger className="flex h-11 w-full md:w-2/3 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium">
                    <SelectValue placeholder="Select a protocol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TCP">TCP (Transmission Control Protocol)</SelectItem>
                    <SelectItem value="UDP">UDP (User Datagram Protocol)</SelectItem>
                    <SelectItem value="ICMPv4">ICMPv4 (Internet Control Message Protocol v4)</SelectItem>
                    <SelectItem value="ICMPv6">ICMPv6 (Internet Control Message Protocol v6)</SelectItem>
                    <SelectItem value="Custom">Custom / Other</SelectItem>
                    <SelectItem value="Any">Any Protocol</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.protocol.startsWith('ICMP') && (
                <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 p-6 bg-card rounded-xl border border-border shadow-sm">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">ICMP Type</label>
                    <input type="text" value={formData.icmp_type} onChange={e => setFormData({...formData, icmp_type: e.target.value})} className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Any or (e.g. 8)" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">ICMP Code</label>
                    <input type="text" value={formData.icmp_code} onChange={e => setFormData({...formData, icmp_code: e.target.value})} className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Any or (e.g. 0)" />
                  </div>
                </div>
              )}

              {formData.protocol === 'Custom' && (
                <div className="animate-in fade-in slide-in-from-top-2 p-6 bg-card rounded-xl border border-border shadow-sm">
                  <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Protocol Number</label>
                  <input type="text" placeholder="e.g. 58 for ICMPv6" value={formData.protocol_number} onChange={(e) => setFormData({...formData, protocol: e.target.value, protocol_number: e.target.value})} className="flex h-10 w-64 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                </div>
              )}

              {['TCP', 'UDP'].includes(formData.protocol) && (
                <div className="space-y-10 animate-in zoom-in-95 duration-300">
                  <div className="p-6 bg-card rounded-xl border border-border shadow-sm">
                    <label className="block text-[11px] font-semibold text-primary uppercase tracking-wider mb-4">Local Ports</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label onClick={() => { setLocalPortType('All'); setFormData({...formData, local_port: 'Any'}); }} className={cn("flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer", localPortType === 'All' ? 'border-primary bg-primary/10 shadow-sm' : 'border-border hover:border-primary/50')}>
                        <input type="radio" checked={localPortType === 'All'} readOnly className="w-4 h-4 accent-primary" />
                        <span className="text-sm font-semibold text-foreground">All local ports</span>
                      </label>
                      <label onClick={() => setLocalPortType('Specific')} className={cn("flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer", localPortType === 'Specific' ? 'border-primary bg-primary/10 shadow-sm' : 'border-border hover:border-primary/50')}>
                        <input type="radio" checked={localPortType === 'Specific'} readOnly className="w-4 h-4 accent-primary" />
                        <span className="text-sm font-semibold text-foreground">Specific ports</span>
                      </label>
                    </div>
                    {localPortType === 'Specific' && (
                      <div className="mt-4 animate-in slide-in-from-top-2">
                        <input type="text" autoFocus value={formData.local_port === 'Any' ? '' : formData.local_port} onChange={e => setFormData({...formData, local_port: e.target.value})} placeholder="80, 443, 5000-5010" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono" />
                      </div>
                    )}
                  </div>
                  {isCustom && (
                    <div className="p-6 bg-card rounded-xl border border-border shadow-sm">
                      <label className="block text-[11px] font-semibold text-indigo-500 uppercase tracking-wider mb-4">Remote Ports</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label onClick={() => { setRemotePortType('All'); setFormData({...formData, remote_port: 'Any'}); }} className={cn("flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer", remotePortType === 'All' ? 'border-indigo-500 bg-indigo-500/10 shadow-sm' : 'border-border hover:border-indigo-500/50')}>
                          <input type="radio" checked={remotePortType === 'All'} readOnly className="w-4 h-4 accent-indigo-500" />
                          <span className="text-sm font-semibold text-foreground">All remote ports</span>
                        </label>
                        <label onClick={() => setRemotePortType('Specific')} className={cn("flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer", remotePortType === 'Specific' ? 'border-indigo-500 bg-indigo-500/10 shadow-sm' : 'border-border hover:border-indigo-500/50')}>
                          <input type="radio" checked={remotePortType === 'Specific'} readOnly className="w-4 h-4 accent-indigo-500" />
                          <span className="text-sm font-semibold text-foreground">Specific ports</span>
                        </label>
                      </div>
                      {remotePortType === 'Specific' && (
                        <div className="mt-4 animate-in slide-in-from-top-2">
                          <input type="text" value={formData.remote_port === 'Any' ? '' : formData.remote_port} onChange={e => setFormData({...formData, remote_port: e.target.value})} placeholder="Any" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      case 'Scope':
        return (
          <div className="space-y-10 text-left animate-in fade-in slide-in-from-right-4">
            <h4 className="text-sm font-semibold text-foreground mb-8">Which local and remote IP addresses does this rule apply to?</h4>
            <div className="space-y-12">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Local IP Scope</label>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" className="w-4 h-4 accent-primary" checked={localAddrType === 'Any'} onChange={() => { setLocalAddrType('Any'); setFormData({...formData, local_address: 'Any'}); }} />
                    <span className="text-sm font-semibold text-foreground">Any IP address</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" className="w-4 h-4 accent-primary" checked={localAddrType === 'Specific'} onChange={() => setLocalAddrType('Specific')} />
                    <span className="text-sm font-semibold text-foreground">These IP addresses:</span>
                  </label>
                  {localAddrType === 'Specific' && (
                    <div className="ml-7 mt-2 space-y-3">
                      <div className="flex gap-2 flex-wrap">
                        {['LocalSubnet', 'DefaultGateway', 'DNS', 'DHCP', 'WINS'].map(sc => (
                          <button key={sc} type="button" onClick={() => setFormData({...formData, local_address: sc})} className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 rounded border border-border text-[10px] font-semibold text-foreground transition-colors">{sc}</button>
                        ))}
                      </div>
                      <input type="text" value={formData.local_address === 'Any' ? '' : formData.local_address} onChange={e => setFormData({...formData, local_address: e.target.value})} className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono" placeholder="192.168.1.5, 10.0.0.0/24" />
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Remote IP Scope</label>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" className="w-4 h-4 accent-primary" checked={remoteAddrType === 'Any'} onChange={() => { setRemoteAddrType('Any'); setFormData({...formData, remote_address: 'Any'}); }} />
                    <span className="text-sm font-semibold text-foreground">Any IP address</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" className="w-4 h-4 accent-primary" checked={remoteAddrType === 'Specific'} onChange={() => setRemoteAddrType('Specific')} />
                    <span className="text-sm font-semibold text-foreground">These IP addresses:</span>
                  </label>
                  {remoteAddrType === 'Specific' && (
                    <div className="ml-7 mt-2 space-y-3">
                      <div className="flex gap-2 flex-wrap">
                        {['LocalSubnet', 'DefaultGateway', 'DNS', 'DHCP', 'WINS', 'Internet'].map(sc => (
                          <button key={sc} type="button" onClick={() => setFormData({...formData, remote_address: sc})} className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 rounded border border-border text-[10px] font-semibold text-foreground transition-colors">{sc}</button>
                        ))}
                      </div>
                      <input type="text" value={formData.remote_address === 'Any' ? '' : formData.remote_address} onChange={e => setFormData({...formData, remote_address: e.target.value})} className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono" placeholder="e.g. 192.168.0.1" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 'Action':
        return (
          <div className="space-y-10 text-left animate-in fade-in slide-in-from-right-4">
            <h4 className="text-sm font-semibold text-foreground mb-4">Specify the connection behavior and direction.</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Rule Action</label>
                <div className="space-y-3">
                  <label onClick={() => setActionMode('Allow')} className={cn("flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer", actionMode === 'Allow' ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50')}>
                    <div className={cn("mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0", actionMode === 'Allow' ? 'border-primary bg-primary' : 'border-input')}>
                      {actionMode === 'Allow' && <div className="w-1.5 h-1.5 rounded-full bg-background" />}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-foreground block">Allow the connection</span>
                      <span className="text-xs text-muted-foreground block mt-1">This includes connections that are protected with IPsec as well as those are not.</span>
                    </div>
                  </label>

                  <label onClick={() => setActionMode('AllowSecure')} className={cn("flex flex-col gap-3 p-4 rounded-xl border transition-all cursor-pointer", actionMode === 'AllowSecure' ? 'border-amber-500 bg-amber-500/10' : 'border-border bg-card hover:border-amber-500/50')}>
                    <div className="flex items-start gap-3">
                      <div className={cn("mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0", actionMode === 'AllowSecure' ? 'border-amber-500 bg-amber-500' : 'border-input')}>
                        {actionMode === 'AllowSecure' && <div className="w-1.5 h-1.5 rounded-full bg-background" />}
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-foreground block">Allow the connection if it is secure</span>
                        <span className="text-xs text-muted-foreground block mt-1">This includes only connections that have been authenticated by using IPsec.</span>
                      </div>
                    </div>
                    {actionMode === 'AllowSecure' && (
                      <div className="ml-7">
                        <Button type="button" onClick={(e) => { e.stopPropagation(); setShowSecureCustomize(true); }} variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 bg-background">
                          Customize...
                        </Button>
                      </div>
                    )}
                  </label>

                  {showSecureCustomize && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/50 backdrop-blur-sm p-4">
                      <div className="bg-card rounded-lg border border-border shadow-2xl w-full max-w-[450px] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-muted/50">
                          <h3 className="text-sm font-semibold text-foreground">Customize Allow if Secure Settings</h3>
                          <button type="button" onClick={() => setShowSecureCustomize(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
                        </div>
                        <div className="p-5 space-y-5">
                          <p className="text-xs text-muted-foreground">Select one of these options to determine which action Windows Defender Firewall with Advanced Security will take for the packets that match the firewall rule criteria.</p>
                          
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input type="radio" checked={formData.authentication === 'Required' && formData.encryption === 'NotRequired'} onChange={() => setFormData({...formData, authentication: 'Required', encryption: 'NotRequired'})} className="mt-0.5 accent-amber-500" />
                            <div>
                              <span className="text-sm font-medium text-foreground block">Allow the connection if it is authenticated and integrity-protected</span>
                              <span className="text-xs text-muted-foreground block mt-1">Allow only connections that are both authenticated and integrity-protected by using IPsec. Compatible with Windows Vista and later.</span>
                            </div>
                          </label>
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input type="radio" checked={formData.authentication === 'Required' && (formData.encryption === 'Required' || formData.encryption === 'Dynamic')} onChange={() => setFormData({...formData, authentication: 'Required', encryption: 'Required'})} className="mt-0.5 accent-amber-500" />
                            <div>
                              <span className="text-sm font-medium text-foreground block">Require the connections to be encrypted</span>
                              <span className="text-xs text-muted-foreground block mt-1">Require privacy in addition to integrity and authentication</span>
                              {formData.authentication === 'Required' && (formData.encryption === 'Required' || formData.encryption === 'Dynamic') && (
                                <label className="flex items-center gap-2 mt-2 cursor-pointer ml-1">
                                  <input type="checkbox" checked={formData.encryption === 'Dynamic'} onChange={(e) => setFormData({...formData, encryption: e.target.checked ? 'Dynamic' : 'Required'})} className="accent-amber-500" />
                                  <span className="text-xs text-foreground">Allow the computers to dynamically negotiate encryption</span>
                                </label>
                              )}
                            </div>
                          </label>
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input type="radio" checked={formData.authentication === 'NoEncap'} onChange={() => setFormData({...formData, authentication: 'NoEncap', encryption: 'NotRequired'})} className="mt-0.5 accent-amber-500" />
                            <div>
                              <span className="text-sm font-medium text-foreground block">Allow the connection to use null encapsulation</span>
                              <span className="text-xs text-muted-foreground block mt-1">Null encapsulation allows you to require that the connection be authenticated, but does not provide integrity or privacy protection for the packet payload.</span>
                            </div>
                          </label>
                          <div className="pt-4 border-t border-border">
                            <label className="flex items-start gap-3 cursor-pointer">
                              <input type="checkbox" checked={formData.override_block_rules === 'True'} onChange={(e) => setFormData({...formData, override_block_rules: e.target.checked ? 'True' : 'False'})} className="mt-0.5 accent-amber-500" />
                              <div>
                                <span className="text-sm font-medium text-foreground block">Override block rules</span>
                                <span className="text-xs text-muted-foreground block mt-1">Useful for tools that must always be available, such as remote administration tools.</span>
                              </div>
                            </label>
                          </div>
                        </div>
                        <div className="px-5 py-3 border-t border-border flex justify-end gap-2 bg-muted/20">
                          <Button type="button" size="sm" onClick={() => setShowSecureCustomize(false)}>OK</Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <label onClick={() => setActionMode('Block')} className={cn("flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer", actionMode === 'Block' ? 'border-destructive bg-destructive/10' : 'border-border bg-card hover:border-destructive/50')}>
                    <div className={cn("mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0", actionMode === 'Block' ? 'border-destructive bg-destructive' : 'border-input')}>
                      {actionMode === 'Block' && <div className="w-1.5 h-1.5 rounded-full bg-background" />}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-foreground block">Block the connection</span>
                      <span className="text-xs text-muted-foreground block mt-1">Drop all traffic matching this rule.</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Direction</label>
                <div className="space-y-3">
                  {['Inbound', 'Outbound'].map(dir => (
                    <label key={dir} onClick={() => setFormData({...formData, direction: dir})} className={cn("flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer", formData.direction === dir ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50')}>
                      <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", formData.direction === dir ? 'border-primary bg-primary' : 'border-input')}>
                        {formData.direction === dir && <div className="w-1.5 h-1.5 rounded-full bg-background" />}
                      </div>
                      <span className="text-sm font-semibold text-foreground">{dir}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-border">
              <label className="flex items-center gap-4 cursor-pointer">
                <div className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={formData.enabled === 'True'} onChange={e => setFormData({...formData, enabled: e.target.checked ? 'True' : 'False'})} className="sr-only peer" />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </div>
                <div>
                  <span className="text-sm font-semibold text-foreground block mb-0.5">Enable Rule Immediately</span>
                  <span className="block text-xs text-muted-foreground">Toggle this off to create the rule in a disabled state.</span>
                </div>
              </label>
            </div>



            {isCustom && (
              <div className="pt-6 border-t border-border space-y-4">
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Edge Traversal</label>
                <p className="text-xs text-muted-foreground -mt-2">Controls whether traffic routed through NAT devices can trigger this rule.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'Block', label: 'Block', desc: 'Default' },
                    { id: 'Allow', label: 'Allow', desc: 'Through NAT' },
                    { id: 'DeferToUser', label: 'Defer to User', desc: 'User decides' },
                    { id: 'DeferToApp', label: 'Defer to App', desc: 'App decides' }
                  ].map(opt => (
                    <label key={opt.id} onClick={() => setFormData({...formData, edge_traversal: opt.id})} className={cn("flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border transition-all cursor-pointer text-center", formData.edge_traversal === opt.id ? 'border-primary bg-primary/10 shadow-sm' : 'border-border bg-card hover:border-primary/50')}>
                      <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'Profile':
        return (
          <div className="space-y-10 text-left animate-in fade-in slide-in-from-right-4">
            <h4 className="text-sm font-semibold text-foreground mb-8">When does this rule apply?</h4>
            <div className="grid grid-cols-1 gap-4">
              {[
                { id: 'domain', label: 'Domain', desc: 'Applies when a computer is connected to its corporate domain.' },
                { id: 'private', label: 'Private', desc: 'Applies when a computer is connected to a private network location.' },
                { id: 'public', label: 'Public', desc: 'Applies when a computer is connected to a public network location.' }
              ].map(prof => (
                <label key={prof.id} className={cn("flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer", localProfiles[prof.id] ? 'border-primary bg-primary/10 shadow-sm' : 'border-border bg-card hover:border-primary/50')}>
                  <input type="checkbox" className="mt-1 w-4 h-4 rounded text-primary accent-primary border-input focus:ring-primary" checked={localProfiles[prof.id]} onChange={e => setLocalProfiles({...localProfiles, [prof.id]: e.target.checked})} />
                  <div>
                    <span className="block text-sm font-semibold text-foreground">{prof.label}</span>
                    <span className="text-xs text-muted-foreground mt-1 block">{prof.desc}</span>
                  </div>
                </label>
              ))}
            </div>

            {isCustom && (
              <div className="pt-8 border-t border-border space-y-4">
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Interface Types</label>
                <p className="text-xs text-muted-foreground -mt-2">Restrict this rule to specific network adapter types.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'Any', label: 'All Types', desc: 'Default' },
                    { id: 'Lan', label: 'LAN', desc: 'Wired Ethernet' },
                    { id: 'Wireless', label: 'Wireless', desc: 'Wi-Fi adapters' },
                    { id: 'RemoteAccess', label: 'Remote Access', desc: 'VPN connections' }
                  ].map(opt => (
                    <label key={opt.id} onClick={() => setFormData({...formData, interface_types: opt.id})} className={`flex flex-col items-center gap-1 p-4 rounded-xl border-2 cursor-pointer transition-all text-center ${formData.interface_types === opt.id ? 'border-indigo-500 bg-indigo-50/20 shadow-md' : 'border-gray-50 bg-gray-50/30'}`}>
                      <span className="text-xs font-bold text-gray-900">{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'Name':
        return (
          <div className="space-y-10 text-left animate-in fade-in slide-in-from-right-4">
            <h4 className="text-sm font-semibold text-foreground mb-8">Specify the name and description for this rule.</h4>
            <div className="space-y-8">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Rule Name <span className="text-destructive">*</span></label>
                <input type="text" required autoFocus value={formData.rule_name} onChange={e => setFormData({...formData, rule_name: e.target.value})} className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium" placeholder="e.g. My Secure Web Application Rule" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Rule Description (Optional)</label>
                <textarea rows={6} value={formData.rule_description} onChange={e => setFormData({...formData, rule_description: e.target.value})} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none font-medium" placeholder="Enter context, ticketing ID, or owner details here..." />
              </div>
            </div>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card rounded-xl border border-border shadow-lg w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{editingRule ? 'Edit Firewall Rule' : 'New Rule Wizard'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 bg-muted/30 border-r border-border p-6">
            <nav className="space-y-2">
              {steps.map((s, idx) => (
                <div key={s} className="flex items-center gap-3">
                  <div className={cn("w-7 h-7 flex items-center justify-center rounded-md text-xs font-semibold", currentStepLabel === s ? 'bg-primary text-primary-foreground' : idx < step - 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-background border border-border text-muted-foreground')}>
                    {idx < step - 1 ? '✓' : idx + 1}
                  </div>
                  <span className={cn("text-xs font-medium", currentStepLabel === s ? 'text-foreground' : 'text-muted-foreground')}>{s}</span>
                </div>
              ))}
            </nav>
          </div>
          <div className="flex-1 p-8 overflow-y-auto">{renderStepContent()}</div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-between">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <div className="flex gap-2">
            {step > 1 && <Button variant="outline" size="sm" onClick={handleBack}>Previous</Button>}
            {step < steps.length ? (
              <Button size="sm" onClick={handleNext}>Next Step</Button>
            ) : (
              <Button size="sm" onClick={() => onAdd(formData)} disabled={adding || !formData.rule_name}>
                {adding ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : (editingRule ? 'Update Rule' : 'Deploy Rule')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ManageFirewall = () => {
  const [vms, setVms] = useState([]);
  const [loadingVMs, setLoadingVMs] = useState(true);
  const [selectedVMs, setSelectedVMs] = useState([]);
  const [rules, setRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [addingRule, setAddingRule] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  
  
  

  useEffect(() => { fetchVMs(); }, []);
  useEffect(() => { 
    if (selectedVMs.length === 1) fetchRules(); 
    else setRules([]);
  }, [selectedVMs]);



  const fetchVMs = async () => {
    try {
      setLoadingVMs(true);
      const res = await adminAPI.getVMs({ limit: 500 });
      setVms(res.vms || []);
    } catch (err) { toast.error(getErrorMessage(err)); } 
    finally { setLoadingVMs(false); }
  };

  const fetchRules = async () => {
    if (selectedVMs.length !== 1) return;
    try {
      setLoadingRules(true);
      const res = await firewallAPI.getRules(selectedVMs[0]);
      setRules(res.rules || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setRules([]);
    } finally { setLoadingRules(false); }
  };

  const handleAddRule = async (formData) => {
    if (selectedVMs.length === 0) {
      toast.error('Please select at least one target server.');
      return;
    }
    try {
      setAddingRule(true);
      if (editingRule) {
        await firewallAPI.updateRule(selectedVMs[0], editingRule.DisplayName, formData);
        toast.success('Firewall rule updated successfully');
      } else {
        if (selectedVMs.length === 1) {
          await firewallAPI.createRule(selectedVMs[0], formData);
          toast.success('Firewall rule created successfully');
        } else {
          const data = { rule_data: formData, vm_ids: selectedVMs };
          const response = await firewallAPI.createBulkRule(data);
          if (response.failure_count === 0) {
            toast.success(`Rule deployed successfully to ${response.success_count} servers`);
          } else {
            toast.error(`Deployed with ${response.failure_count} errors. Check results.`);
          }
        }
      }
      setShowAddModal(false);
      setEditingRule(null);
      if (selectedVMs.length === 1) {
         fetchRules();
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAddingRule(false);
    }
  };

  const handleToggle = async (ruleName) => {
    if (selectedVMs.length !== 1) return;
    try {
      await firewallAPI.toggleRule(selectedVMs[0], ruleName);
      toast.success(`Rule ${ruleName} toggled`);
      fetchRules();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async (ruleName) => {
    if (selectedVMs.length !== 1) return;
    if (!window.confirm(`Are you sure you want to delete '${ruleName}'?`)) return;
    try {
      await firewallAPI.deleteRule(selectedVMs[0], ruleName);
      toast.success(`Rule deleted`);
      fetchRules();
    } catch (err) {
      toast.error(err.message || 'Failed to delete rule');
    }
  };

  const filteredRules = rules.filter(r => 
    (r.DisplayName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (r.Name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const primaryVM = selectedVMs.length === 1 ? vms.find(v => v.id === selectedVMs[0]) : null;

  return (
    <div className="space-y-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-card rounded-2xl shadow-lg flex items-center justify-center border border-border">
              <ShieldAlert className="text-primary" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Firewall Management</h1>
              <p className="text-sm text-muted-foreground mt-1">Configure security rules across your infrastructure</p>
            </div>
          </div>

          <div className="flex items-center gap-3">

             <Button
               onClick={() => setShowAddModal(true)}
               disabled={selectedVMs.length === 0}
               className="gap-2 shadow-sm font-medium"
               size="default"
             >
               <Plus className="h-4 w-4" />
               New Rule Wizard
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <VMSelector 
              vms={vms} 
              selected={selectedVMs} 
              setSelected={setSelectedVMs} 
              loading={loadingVMs} 
            />
            
            {primaryVM && (
              <Card className="mt-4">
                <CardContent className="pt-5">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Server Context</p>
                  <div className="flex items-center gap-3">
                    <div className={cn("w-2.5 h-2.5 rounded-full", primaryVM.health_status === 'healthy' ? 'bg-emerald-500' : 'bg-destructive')} />
                    <div>
                      <p className="text-sm font-semibold text-foreground leading-none">{primaryVM.name}</p>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">{primaryVM.ip_address}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-3">
            <Card className="overflow-hidden flex flex-col min-h-[600px]">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-card sticky top-0 z-20">
                <h3 className="text-sm font-semibold text-foreground">Active Firewall Rules</h3>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex h-9 rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-56" />
                  </div>
                  <Button variant="outline" size="icon" onClick={fetchRules} disabled={selectedVMs.length === 0 || loadingRules}>
                    <RefreshCw className={cn("h-4 w-4", loadingRules && "animate-spin")} />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-1/4">Rule Name</TableHead>
                      <TableHead>Profile</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Ports/Protocol</TableHead>
                      <TableHead className="text-right">Controls</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingRules ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={5}><Skeleton className="h-5 w-3/4" /></TableCell>
                        </TableRow>
                      ))
                    ) : selectedVMs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-48 text-center pt-24">
                          <div className="rounded-full bg-muted p-4 w-fit mx-auto mb-3"><Server className="h-8 w-8 text-muted-foreground" /></div>
                          <p className="text-sm text-muted-foreground">Select a server to manage rules.</p>
                        </TableCell>
                      </TableRow>
                    ) : selectedVMs.length > 1 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-48 text-center pt-24">
                          <div className="rounded-full bg-muted p-4 w-fit mx-auto mb-3"><Layers className="h-8 w-8 text-muted-foreground" /></div>
                          <p className="text-sm text-muted-foreground">Multiple servers selected.</p>
                          <p className="text-xs text-muted-foreground mt-1">Viewing rules is only available when a single server is selected.</p>
                          <p className="text-xs text-muted-foreground">You can still deploy new rules to all selected servers.</p>
                        </TableCell>
                      </TableRow>
                    ) : filteredRules.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-48 text-center">
                          <p className="text-sm text-muted-foreground">No rules found{searchQuery ? ' matching your search.' : '.'}</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRules.map(rule => (
                        <TableRow key={rule.Name}>
                          <TableCell>
                            <p className="text-sm font-medium text-foreground">{rule.DisplayName}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">{rule.Profile}</Badge>
                          </TableCell>
                          <TableCell title={rule.Direction}>
                            <Badge variant={rule.Action === 'Allow' ? 'success' : 'destructive'}>{rule.Action}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-medium text-muted-foreground">{rule.Protocol} / {rule.LocalPort}</span>
                          </TableCell>
                          <TableCell className="text-right">
                             <div className="flex items-center justify-end gap-1">
                               <Button variant="ghost" size="icon" onClick={() => { setEditingRule(rule); setShowAddModal(true); }} className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-accent" title="Edit">
                                 <Edit2 className="h-4 w-4" />
                               </Button>
                               <Button variant="ghost" size="icon" onClick={() => handleToggle(rule.DisplayName)}
                                 className={cn("h-8 w-8", rule.Enabled === 'True' ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-100' : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-100')}
                                 title={rule.Enabled === 'True' ? 'Disable' : 'Enable'}>
                                 <Power className="h-4 w-4" />
                               </Button>
                               <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.DisplayName)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Delete">
                                 <Trash2 className="h-4 w-4" />
                               </Button>
                             </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <AddRuleModal 
        isOpen={showAddModal} 
        onClose={() => { setShowAddModal(false); setEditingRule(null); }} 
        onAdd={handleAddRule}
        adding={addingRule}
        editingRule={editingRule}
      />
      
    </div>
  );
};

export default ManageFirewall;
