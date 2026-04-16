import { useState, useEffect, useRef } from 'react';
import { adminAPI, firewallAPI, getErrorMessage } from '../../services/api';
import toast from 'react-hot-toast';
import { 
  RefreshCw, Server, Search, ChevronDown, CheckCircle2, 
  ShieldAlert, Shield, ShieldOff, Plus, Trash2, Power, Edit2
} from 'lucide-react';

// Reusable VM Selector (Single Select)
const VMSelector = ({ vms, selectedVM, setSelectedVM, loading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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

  const selectedVMObject = vms.find(v => v.id === selectedVM);

  return (
    <div className="relative mb-6" ref={dropdownRef}>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Target Server</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full md:w-96 flex items-center justify-between px-4 py-2.5 bg-white border border-gray-300 rounded-xl shadow-sm hover:border-primary-400"
      >
        <div className="flex items-center gap-2">
          <Server size={18} className={selectedVM ? 'text-primary-500' : 'text-gray-400'} />
          <span className={`text-sm font-medium ${selectedVM ? 'text-gray-900' : 'text-gray-500'}`}>
            {selectedVM ? `${selectedVMObject?.name} (${selectedVMObject?.ip_address})` : 'Choose a server...'}
          </span>
        </div>
        <ChevronDown size={18} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full md:w-96 bg-white border rounded-2xl shadow-xl">
          <div className="p-3 border-b bg-gray-50/50">
            <input
              autoFocus
              type="text"
              placeholder="Filter servers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border rounded-lg text-sm"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filteredVMs.map(vm => (
              <button
                key={vm.id}
                onClick={() => { setSelectedVM(vm.id); setIsOpen(false); }}
                className={`w-full flex flex-col p-2.5 rounded-xl text-left hover:bg-gray-100 transition-colors ${selectedVM === vm.id ? 'bg-primary-50 border-primary-100' : ''}`}
              >
                <span className="text-sm font-bold text-gray-900 leading-none">{vm.name}</span>
                <span className="text-[10px] text-gray-400 mt-1 font-mono tracking-tighter">{vm.ip_address}</span>
              </button>
            ))}
          </div>
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

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      
      if (editingRule) {
        // Pre-fill form from existing rule
        setRuleType(editingRule.PredefinedGroup ? 'Predefined' : (editingRule.Program !== 'Any' ? 'Program' : (editingRule.LocalPort !== 'Any' ? 'Port' : 'Custom')));
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
          icmp_code: editingRule.IcmpCode || 'Any'
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
        setActionMode(editingRule.Action === 'Allow' ? 'Allow' : 'Block');
      } else {
        // Reset for new rule
        setRuleType('Program');
        setFormData({
          rule_name: '', rule_description: '', direction: 'Inbound', rule_action: 'Allow',
          profile: 'Domain,Private,Public', protocol: 'TCP', local_port: 'Any', remote_port: 'Any',
          local_address: 'Any', remote_address: 'Any', program_path: 'Any', service_name: 'Any', 
          enabled: 'True', protocol_number: '', predefined_group: '', icmp_type: 'Any', icmp_code: 'Any',
          edge_traversal: 'Block', interface_types: 'Any'
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
      setFormData(prev => ({ ...prev, rule_action: 'Allow' }));
    } else if (actionMode === 'Block') {
      setFormData(prev => ({ ...prev, rule_action: 'Block' }));
    }
  }, [actionMode]);

  if (!isOpen) return null;

  const getSteps = () => {
    if (ruleType === 'Program') return ['Rule Type', 'Program', 'Action', 'Profile', 'Name'];
    if (ruleType === 'Port') return ['Rule Type', 'Protocol and Ports', 'Action', 'Profile', 'Name'];
    if (ruleType === 'Predefined') return ['Rule Type', 'Predefined', 'Action', 'Profile', 'Name'];
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
          <div className="space-y-8 text-left animate-in fade-in slide-in-from-right-4">
            <h4 className="text-sm font-bold text-gray-900 mb-8">What type of rule would you like to create?</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { id: 'Program', label: 'Program', desc: 'Rule that controls connections for a program.' },
                { id: 'Port', label: 'Port', desc: 'Rule that controls connections for a TCP or UDP port.' },
                { id: 'Predefined', label: 'Predefined', desc: 'Rule that controls connections for a Windows experience.' },
                { id: 'Custom', label: 'Custom', desc: 'Custom rule.' }
              ].map(opt => (
                <label key={opt.id} className={`flex items-start gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer ${ruleType === opt.id ? 'border-primary-500 bg-primary-50/20' : 'border-gray-50 bg-gray-50/30'} hover:border-primary-200`}>
                  <input type="radio" name="ruleType" className="mt-1.5 w-4 h-4 text-primary-600" checked={ruleType === opt.id} onChange={() => setRuleType(opt.id)} />
                  <div>
                    <span className="block font-bold text-gray-900 text-sm">{opt.label}</span>
                    <span className="text-[11px] text-gray-500 leading-tight mt-1 inline-block">{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        );

      case 'Program':
        return (
          <div className="space-y-8 text-left animate-in fade-in slide-in-from-right-4">
            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex items-start gap-3 mb-6">
              <Shield size={20} className="text-blue-500 mt-1 shrink-0" />
              <p className="text-xs text-blue-700 font-medium leading-relaxed">Rules for programs allow communication through any port, but only for the specified executable.</p>
            </div>
            <div className="space-y-8">
              <div className="flex flex-col gap-6">
                <label className="flex items-start gap-4 cursor-pointer group p-2">
                  <input type="radio" className="mt-1 w-4 h-4" checked={progType === 'All'} onChange={() => { setProgType('All'); setFormData({...formData, program_path: 'Any', service_name: 'Any'}); }} />
                  <div>
                    <span className="block text-sm font-bold text-gray-900">All programs</span>
                    <span className="block text-[10px] text-gray-400 font-medium">Applies to all connections that match other rule properties.</span>
                  </div>
                </label>
                <label className="flex items-start gap-4 cursor-pointer group p-2">
                  <input type="radio" className="mt-1 w-4 h-4" checked={progType === 'Specific'} onChange={() => setProgType('Specific')} />
                  <div className="flex-1">
                    <span className="block text-sm font-bold text-gray-900">This program path:</span>
                    {progType === 'Specific' && (
                      <div className="mt-3">
                        <input type="text" placeholder="e.g. %SystemDrive%\Path\to\exe" value={formData.program_path === 'Any' ? '' : formData.program_path} onChange={(e) => setFormData({...formData, program_path: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-primary-400 outline-none font-mono" />
                      </div>
                    )}
                  </div>
                </label>
                <div className="pt-6 border-t border-gray-100">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Service Settings</label>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" checked={formData.service_name === 'Any'} onChange={() => setFormData({...formData, service_name: 'Any'})} />
                      <span className="text-xs font-bold text-gray-700">Apply to all programs and services</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" checked={formData.service_name !== 'Any'} onChange={() => setFormData({...formData, service_name: ''})} />
                      <span className="text-xs font-bold text-gray-700">Apply to this service:</span>
                    </label>
                    {formData.service_name !== 'Any' && (
                      <input type="text" placeholder="Short name (e.g., WinRM)" value={formData.service_name} onChange={(e) => setFormData({...formData, service_name: e.target.value})} className="ml-7 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-primary-400 outline-none w-2/3" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'Predefined':
        return (
          <div className="space-y-8 text-left animate-in fade-in slide-in-from-right-4">
            <h4 className="text-sm font-bold text-gray-900 mb-6">Select the experience you want to allow.</h4>
            <div className="space-y-4">
              <select value={formData.predefined_group} onChange={(e) => setFormData({...formData, predefined_group: e.target.value, rule_name: e.target.value})} className="w-full px-4 py-3.5 border-2 border-gray-100 rounded-xl text-sm font-bold bg-white focus:border-primary-400 outline-none shadow-sm">
                <option value="">Choose a predefined group...</option>
                <optgroup label="Remote Access">
                  <option value="Remote Desktop">Remote Desktop</option>
                  <option value="Windows Remote Management">Windows Remote Management (WinRM)</option>
                  <option value="Remote Event Log Management">Remote Event Log Management</option>
                  <option value="Remote Service Management">Remote Service Management</option>
                  <option value="Remote Scheduled Tasks Management">Remote Scheduled Tasks Management</option>
                  <option value="Remote Volume Management">Remote Volume Management</option>
                  <option value="Windows Firewall Remote Management">Windows Firewall Remote Management</option>
                </optgroup>
                <optgroup label="Networking">
                  <option value="Core Networking">Core Networking</option>
                  <option value="Network Discovery">Network Discovery</option>
                  <option value="File and Printer Sharing">File and Printer Sharing</option>
                  <option value="BranchCache - Content Retrieval (Uses HTTP)">BranchCache — Content Retrieval</option>
                  <option value="BranchCache - Hosted Cache Server (Uses HTTPS)">BranchCache — Hosted Cache Server</option>
                  <option value="BranchCache - Peer Discovery (Uses WSD)">BranchCache — Peer Discovery</option>
                  <option value="Routing and Remote Access">Routing and Remote Access</option>
                </optgroup>
                <optgroup label="Web Services">
                  <option value="World Wide Web Services (HTTP)">World Wide Web Services (HTTP)</option>
                  <option value="Secure World Wide Web Services (HTTPS)">Secure World Wide Web Services (HTTPS)</option>
                </optgroup>
                <optgroup label="Management & Monitoring">
                  <option value="Windows Management Instrumentation (WMI)">Windows Management Instrumentation (WMI)</option>
                  <option value="Performance Logs and Alerts">Performance Logs and Alerts</option>
                  <option value="SNMP Service">SNMP Service</option>
                  <option value="Virtual Machine Monitoring">Virtual Machine Monitoring</option>
                  <option value="COM+ Network Access">COM+ Network Access</option>
                </optgroup>
                <optgroup label="Infrastructure">
                  <option value="Netlogon Service">Netlogon Service</option>
                  <option value="DFS Management">DFS Management</option>
                  <option value="Distributed Transaction Coordinator">Distributed Transaction Coordinator</option>
                  <option value="iSCSI Service">iSCSI Service</option>
                  <option value="Key Management Service">Key Management Service</option>
                </optgroup>
                <optgroup label="Hyper-V">
                  <option value="Hyper-V">Hyper-V</option>
                  <option value="Hyper-V Management Clients">Hyper-V Management Clients</option>
                  <option value="Hyper-V Replica HTTP">Hyper-V Replica HTTP</option>
                  <option value="Hyper-V Replica HTTPS">Hyper-V Replica HTTPS</option>
                </optgroup>
              </select>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-[10px] text-gray-500 font-medium leading-relaxed">Note: Predefined rules use Microsoft's recommended configurations for these features, including all necessary ports and protocols.</p>
              </div>
            </div>
          </div>
        );

      case 'Protocol and Ports':
        return (
          <div className="space-y-8 text-left animate-in fade-in slide-in-from-right-4">
            <h4 className="text-sm font-bold text-gray-900 mb-6">To which ports and protocols does this rule apply?</h4>
            <div className="space-y-10">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Protocol Type</label>
                <select value={formData.protocol} onChange={e => setFormData({...formData, protocol: e.target.value})} className="w-full md:w-2/3 px-4 py-3.5 border-2 border-gray-100 rounded-xl text-sm font-bold bg-white focus:border-primary-400 outline-none shadow-sm">
                  <option value="TCP">TCP (Transmission Control Protocol)</option>
                  <option value="UDP">UDP (User Datagram Protocol)</option>
                  <option value="ICMPv4">ICMPv4 (Internet Control Message Protocol v4)</option>
                  <option value="ICMPv6">ICMPv6 (Internet Control Message Protocol v6)</option>
                  <option value="Custom">Custom / Other</option>
                  <option value="Any">Any Protocol</option>
                </select>
              </div>

              {formData.protocol.startsWith('ICMP') && (
                <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 p-6 bg-gray-50/50 rounded-2xl border border-gray-100">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">ICMP Type</label>
                    <input type="text" value={formData.icmp_type} onChange={e => setFormData({...formData, icmp_type: e.target.value})} className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl text-sm font-bold bg-white focus:border-primary-400 outline-none" placeholder="Any or (e.g. 8)" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">ICMP Code</label>
                    <input type="text" value={formData.icmp_code} onChange={e => setFormData({...formData, icmp_code: e.target.value})} className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl text-sm font-bold bg-white focus:border-primary-400 outline-none" placeholder="Any or (e.g. 0)" />
                  </div>
                </div>
              )}

              {formData.protocol === 'Custom' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Protocol Number</label>
                  <input type="text" placeholder="e.g. 58 for ICMPv6" value={formData.protocol_number} onChange={(e) => setFormData({...formData, protocol: e.target.value, protocol_number: e.target.value})} className="w-48 px-4 py-3 border-2 border-gray-100 rounded-xl text-sm font-bold focus:border-primary-400 outline-none" />
                </div>
              )}

              {['TCP', 'UDP'].includes(formData.protocol) && (
                <div className="space-y-10 animate-in zoom-in-95 duration-300">
                  <div className="p-6 bg-gray-50/50 rounded-2xl border border-gray-100">
                    <label className="block text-[10px] font-black text-primary-500 uppercase tracking-[0.2em] mb-4">Local Ports</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label onClick={() => { setLocalPortType('All'); setFormData({...formData, local_port: 'Any'}); }} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${localPortType === 'All' ? 'border-primary-500 bg-white shadow-md' : 'border-transparent bg-white/50'}`}>
                        <input type="radio" checked={localPortType === 'All'} readOnly />
                        <span className="text-sm font-bold text-gray-700">All local ports</span>
                      </label>
                      <label onClick={() => setLocalPortType('Specific')} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${localPortType === 'Specific' ? 'border-primary-500 bg-white shadow-md' : 'border-transparent bg-white/50'}`}>
                        <input type="radio" checked={localPortType === 'Specific'} readOnly />
                        <span className="text-sm font-bold text-gray-700">Specific ports</span>
                      </label>
                    </div>
                    {localPortType === 'Specific' && (
                      <div className="mt-4 animate-in slide-in-from-top-2">
                        <input type="text" autoFocus value={formData.local_port === 'Any' ? '' : formData.local_port} onChange={e => setFormData({...formData, local_port: e.target.value})} placeholder="80, 443, 5000-5010" className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-mono focus:border-primary-400 placeholder:text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="p-6 bg-gray-50/50 rounded-2xl border border-gray-100">
                    <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-4">Remote Ports</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label onClick={() => { setRemotePortType('All'); setFormData({...formData, remote_port: 'Any'}); }} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${remotePortType === 'All' ? 'border-indigo-500 bg-white shadow-md' : 'border-transparent bg-white/50'}`}>
                        <input type="radio" checked={remotePortType === 'All'} readOnly />
                        <span className="text-sm font-bold text-gray-700">All remote ports</span>
                      </label>
                      <label onClick={() => setRemotePortType('Specific')} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${remotePortType === 'Specific' ? 'border-indigo-500 bg-white shadow-md' : 'border-transparent bg-white/50'}`}>
                        <input type="radio" checked={remotePortType === 'Specific'} readOnly />
                        <span className="text-sm font-bold text-gray-700">Specific ports</span>
                      </label>
                    </div>
                    {remotePortType === 'Specific' && (
                      <div className="mt-4 animate-in slide-in-from-top-2">
                        <input type="text" value={formData.remote_port === 'Any' ? '' : formData.remote_port} onChange={e => setFormData({...formData, remote_port: e.target.value})} placeholder="Any" className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-mono focus:border-primary-400 placeholder:text-gray-300" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'Scope':
        return (
          <div className="space-y-10 text-left animate-in fade-in slide-in-from-right-4">
            <h4 className="text-sm font-bold text-gray-900 mb-8">Which local and remote IP addresses does this rule apply to?</h4>
            <div className="space-y-12">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Local IP Scope</label>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" className="w-4 h-4" checked={localAddrType === 'Any'} onChange={() => { setLocalAddrType('Any'); setFormData({...formData, local_address: 'Any'}); }} />
                    <span className="text-sm font-bold text-gray-700">Any IP address</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" className="w-4 h-4" checked={localAddrType === 'Specific'} onChange={() => setLocalAddrType('Specific')} />
                    <span className="text-sm font-bold text-gray-700">These IP addresses:</span>
                  </label>
                  {localAddrType === 'Specific' && (
                    <div className="ml-7 mt-2 space-y-3">
                      <div className="flex gap-2 flex-wrap">
                        {['LocalSubnet', 'DefaultGateway', 'DNS', 'DHCP', 'WINS'].map(sc => (
                          <button key={sc} type="button" onClick={() => setFormData({...formData, local_address: sc})} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-[10px] font-bold text-gray-600 transition-colors">{sc}</button>
                        ))}
                      </div>
                      <input type="text" value={formData.local_address === 'Any' ? '' : formData.local_address} onChange={e => setFormData({...formData, local_address: e.target.value})} className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl text-sm font-mono focus:border-primary-400" placeholder="192.168.1.5, 10.0.0.0/24" />
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Remote IP Scope</label>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" className="w-4 h-4" checked={remoteAddrType === 'Any'} onChange={() => { setRemoteAddrType('Any'); setFormData({...formData, remote_address: 'Any'}); }} />
                    <span className="text-sm font-bold text-gray-700">Any IP address</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" className="w-4 h-4" checked={remoteAddrType === 'Specific'} onChange={() => setRemoteAddrType('Specific')} />
                    <span className="text-sm font-bold text-gray-700">These IP addresses:</span>
                  </label>
                  {remoteAddrType === 'Specific' && (
                    <div className="ml-7 mt-2 space-y-3">
                      <div className="flex gap-2 flex-wrap">
                        {['LocalSubnet', 'DefaultGateway', 'DNS', 'DHCP', 'WINS', 'Internet'].map(sc => (
                          <button key={sc} type="button" onClick={() => setFormData({...formData, remote_address: sc})} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-[10px] font-bold text-gray-600 transition-colors">{sc}</button>
                        ))}
                      </div>
                      <input type="text" value={formData.remote_address === 'Any' ? '' : formData.remote_address} onChange={e => setFormData({...formData, remote_address: e.target.value})} className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl text-sm font-mono focus:border-primary-400" placeholder="e.g. 192.168.0.1" />
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
            <h4 className="text-sm font-bold text-gray-900 mb-4">Specify the connection behavior and direction.</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Rule Action</label>
                <div className="space-y-3">
                  <label onClick={() => setActionMode('Allow')} className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${actionMode === 'Allow' ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-50 bg-gray-50/30'}`}>
                    <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${actionMode === 'Allow' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'}`}>
                      {actionMode === 'Allow' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">Allow the connection</span>
                      <span className="text-[10px] text-gray-400 mt-0.5 block">Allow all traffic matching this rule.</span>
                    </div>
                  </label>

                  <label onClick={() => setActionMode('Block')} className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${actionMode === 'Block' ? 'border-red-500 bg-red-50/30' : 'border-gray-50 bg-gray-50/30'}`}>
                    <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${actionMode === 'Block' ? 'border-red-500 bg-red-500' : 'border-gray-300'}`}>
                      {actionMode === 'Block' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">Block the connection</span>
                      <span className="text-[10px] text-gray-400 mt-0.5 block">Drop all traffic matching this rule.</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Direction</label>
                <div className="space-y-3">
                  {['Inbound', 'Outbound'].map(dir => (
                    <label key={dir} onClick={() => setFormData({...formData, direction: dir})} className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${formData.direction === dir ? 'border-primary-500 bg-primary-50/20' : 'border-gray-50 bg-gray-50/30'}`}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.direction === dir ? 'border-primary-500 bg-primary-500' : 'border-gray-300'}`}>
                        {formData.direction === dir && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="text-xs font-bold text-gray-700">{dir}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <label className="flex items-center gap-4 cursor-pointer">
                <div className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={formData.enabled === 'True'} onChange={e => setFormData({...formData, enabled: e.target.checked ? 'True' : 'False'})} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900">Enable Rule Immediately</span>
                  <span className="block text-[10px] text-gray-400 font-medium">Toggle this off to create the rule in a disabled state.</span>
                </div>
              </label>
            </div>



            {isCustom && (
              <div className="pt-6 border-t border-gray-100 space-y-4">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Edge Traversal</label>
                <p className="text-[10px] text-gray-400 font-medium -mt-2">Controls whether traffic routed through NAT devices can trigger this rule.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'Block', label: 'Block', desc: 'Default' },
                    { id: 'Allow', label: 'Allow', desc: 'Through NAT' },
                    { id: 'DeferToUser', label: 'Defer to User', desc: 'User decides' },
                    { id: 'DeferToApp', label: 'Defer to App', desc: 'App decides' }
                  ].map(opt => (
                    <label key={opt.id} onClick={() => setFormData({...formData, edge_traversal: opt.id})} className={`flex flex-col items-center gap-1 p-4 rounded-xl border-2 cursor-pointer transition-all text-center ${formData.edge_traversal === opt.id ? 'border-primary-500 bg-primary-50/20 shadow-md' : 'border-gray-50 bg-gray-50/30'}`}>
                      <span className="text-xs font-bold text-gray-900">{opt.label}</span>
                      <span className="text-[9px] text-gray-400 font-medium">{opt.desc}</span>
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
            <h4 className="text-sm font-bold text-gray-900 mb-8">When does this rule apply?</h4>
            <div className="grid grid-cols-1 gap-4">
              {[
                { id: 'domain', label: 'Domain', desc: 'Applies when a computer is connected to its corporate domain.' },
                { id: 'private', label: 'Private', desc: 'Applies when a computer is connected to a private network location.' },
                { id: 'public', label: 'Public', desc: 'Applies when a computer is connected to a public network location.' }
              ].map(prof => (
                <label key={prof.id} className={`flex items-start gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer ${localProfiles[prof.id] ? 'border-indigo-500 bg-indigo-50/20 shadow-md' : 'border-gray-50 bg-gray-50/30'}`}>
                  <input type="checkbox" className="mt-1.5 w-4 h-4 rounded text-indigo-600 border-gray-300" checked={localProfiles[prof.id]} onChange={e => setLocalProfiles({...localProfiles, [prof.id]: e.target.checked})} />
                  <div>
                    <span className="block text-sm font-bold text-gray-900">{prof.label}</span>
                    <span className="text-[11px] text-gray-500 font-medium leading-relaxed mt-1 block">{prof.desc}</span>
                  </div>
                </label>
              ))}
            </div>

            {isCustom && (
              <div className="pt-8 border-t border-gray-100 space-y-4">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Interface Types</label>
                <p className="text-[10px] text-gray-400 font-medium -mt-2">Restrict this rule to specific network adapter types.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'Any', label: 'All Types', desc: 'Default' },
                    { id: 'Lan', label: 'LAN', desc: 'Wired Ethernet' },
                    { id: 'Wireless', label: 'Wireless', desc: 'Wi-Fi adapters' },
                    { id: 'RemoteAccess', label: 'Remote Access', desc: 'VPN connections' }
                  ].map(opt => (
                    <label key={opt.id} onClick={() => setFormData({...formData, interface_types: opt.id})} className={`flex flex-col items-center gap-1 p-4 rounded-xl border-2 cursor-pointer transition-all text-center ${formData.interface_types === opt.id ? 'border-indigo-500 bg-indigo-50/20 shadow-md' : 'border-gray-50 bg-gray-50/30'}`}>
                      <span className="text-xs font-bold text-gray-900">{opt.label}</span>
                      <span className="text-[9px] text-gray-400 font-medium">{opt.desc}</span>
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
            <h4 className="text-sm font-bold text-gray-900 mb-8">Specify the name and description for this rule.</h4>
            <div className="space-y-8">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Rule Name</label>
                <input type="text" autoFocus value={formData.rule_name} onChange={e => setFormData({...formData, rule_name: e.target.value})} className="w-full px-5 py-4 border-2 border-gray-100 rounded-2xl text-base font-bold focus:border-emerald-500 focus:ring-0 shadow-sm placeholder:text-gray-300" placeholder="e.g. My Secure Web Application Rule" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Rule Description (Optional)</label>
                <textarea rows={6} value={formData.rule_description} onChange={e => setFormData({...formData, rule_description: e.target.value})} className="w-full px-5 py-4 border-2 border-gray-100 rounded-2xl text-sm font-medium focus:border-emerald-500 focus:ring-0 resize-none shadow-sm placeholder:text-gray-300" placeholder="Enter context, ticketing ID, or owner details here..." />
              </div>
            </div>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">{editingRule ? 'Edit Firewall Rule' : 'New Rule Wizard'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 text-2xl leading-none">&times;</button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-72 bg-gray-50/50 border-r border-gray-100 p-8">
            <nav className="space-y-3">
              {steps.map((s, idx) => (
                <div key={s} className="flex items-center gap-5">
                  <div className={`w-7 h-7 flex items-center justify-center rounded-xl text-[10px] font-black ${currentStepLabel === s ? 'bg-primary-600 text-white' : idx < step - 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-white border-2 border-gray-200'}`}>
                    {idx < step - 1 ? '✓' : idx + 1}
                  </div>
                  <span className={`text-[11px] font-bold uppercase ${currentStepLabel === s ? 'text-gray-900' : 'text-gray-400'}`}>{s}</span>
                </div>
              ))}
            </nav>
          </div>
          <div className="flex-1 p-10 overflow-y-auto">{renderStepContent()}</div>
        </div>
        <div className="px-10 py-6 border-t border-gray-100 flex justify-between">
          <button onClick={onClose} className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Abort</button>
          <div className="flex gap-4">
            {step > 1 && <button onClick={handleBack} className="px-8 py-3 text-[10px] font-bold uppercase tracking-[0.2em] border-2 rounded-2xl">Previous</button>}
            {step < steps.length ? (
              <button onClick={handleNext} className="px-12 py-3 bg-primary-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em]">Next Step</button>
            ) : (
              <button
                onClick={() => onAdd(formData)}
                disabled={adding || !formData.rule_name}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-lg shadow-primary-200"
              >
                {adding ? 'Processing...' : (editingRule ? 'Update Rule' : 'Deploy Rule')}
              </button>
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
  const [selectedVM, setSelectedVM] = useState('');
  const [rules, setRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [addingRule, setAddingRule] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchVMs(); }, []);
  useEffect(() => { 
    if (selectedVM) fetchRules(); 
    else setRules([]);
  }, [selectedVM]);

  const fetchVMs = async () => {
    try {
      setLoadingVMs(true);
      const res = await adminAPI.getVMs({ limit: 500 });
      setVms(res.vms || []);
    } catch (err) { toast.error(getErrorMessage(err)); } 
    finally { setLoadingVMs(false); }
  };

  const fetchRules = async () => {
    if (!selectedVM) return;
    try {
      setLoadingRules(true);
      const res = await firewallAPI.getRules(selectedVM);
      setRules(res.rules || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setRules([]);
    } finally { setLoadingRules(false); }
  };

  const handleAddRule = async (formData) => {
    try {
      setAddingRule(true);
      if (editingRule) {
        await firewallAPI.updateRule(selectedVM, editingRule.DisplayName, formData);
        toast.success('Firewall rule updated successfully');
      } else {
        await firewallAPI.createRule(selectedVM, formData);
        toast.success('Firewall rule created successfully');
      }
      setShowAddModal(false);
      setEditingRule(null);
      fetchRules();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAddingRule(false);
    }
  };

  const handleToggle = async (ruleName) => {
    if (!selectedVM) return;
    try {
      await firewallAPI.toggleRule(selectedVM, ruleName);
      toast.success(`Rule ${ruleName} toggled`);
      fetchRules();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async (ruleName) => {
    if (!selectedVM) return;
    if (!window.confirm(`Are you sure you want to delete '${ruleName}'?`)) return;
    try {
      await firewallAPI.deleteRule(selectedVM, ruleName);
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

  const primaryVM = vms.find(v => v.id === selectedVM);

  return (
    <div className="min-h-screen bg-gray-50/30 p-4 md:p-8 animate-in fade-in duration-500">
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-gray-100">
              <ShieldAlert className="text-primary-600" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Firewall Management</h1>
              <p className="text-gray-500 mt-1">Configure security rules across your infrastructure</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button
               onClick={() => setShowAddModal(true)}
               disabled={!selectedVM}
               className="px-6 py-2.5 bg-primary-600 text-white rounded-xl flex items-center gap-2 font-bold text-sm shadow-xl shadow-primary-200 hover:bg-primary-700 transition-all disabled:opacity-50 disabled:grayscale"
             >
               <Plus size={18} />
               New Rule Wizard
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <VMSelector 
              vms={vms} 
              selectedVM={selectedVM} 
              setSelectedVM={setSelectedVM} 
              loading={loadingVMs} 
            />
            
            {primaryVM && (
              <div className="mt-8 space-y-4 animate-in slide-in-from-left-4 duration-500">
                 <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                   <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Server Context</h4>
                   <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${primaryVM.health_status === 'healthy' ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-red-500 shadow-lg shadow-red-200'}`} />
                        <div>
                          <p className="text-sm font-bold text-gray-900 leading-none">{primaryVM.name}</p>
                          <p className="text-[11px] text-gray-400 mt-1 font-mono tracking-tight">{primaryVM.ip_address}</p>
                        </div>
                      </div>
                   </div>
                 </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl shadow-gray-200/50 overflow-hidden flex flex-col min-h-[600px]">
              <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-20">
                <div className="flex items-center gap-6">
                  <h3 className="text-sm font-semibold text-gray-700">Active Firewall Rules</h3>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary-100 w-64 transition-all"
                    />
                  </div>
                  <button onClick={fetchRules} disabled={!selectedVM || loadingRules} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all disabled:opacity-30">
                    <RefreshCw size={18} className={loadingRules ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50/50">
                      <th className="px-8 py-4 text-xs font-semibold text-gray-600 w-1/4">Rule Name</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-600">Profile</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-600">Action</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-600">Ports/Prot</th>
                      <th className="px-8 py-4 text-xs font-semibold text-gray-600 text-right">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50/50">
                    {loadingRules ? (
                      [...Array(6)].map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan="5" className="px-8 py-6"><div className="h-6 bg-gray-50 rounded-xl w-3/4 mx-auto" /></td>
                        </tr>
                      ))
                    ) : !selectedVM ? (
                      <tr>
                        <td colSpan="5" className="py-32 text-center text-gray-400">Select a server to manage rules.</td>
                      </tr>
                    ) : (
                      filteredRules.map(rule => (
                        <tr key={rule.Name} className="group hover:bg-gray-50/50 transition-all">
                          <td className="px-8 py-6">
                            <p className="text-sm font-bold text-gray-800">{rule.DisplayName}</p>
                          </td>
                          <td className="px-6 py-6">
                            <span className="text-[9px] font-black text-gray-400 px-2 py-0.5 bg-gray-100 rounded-md uppercase">{rule.Profile}</span>
                          </td>
                          <td className="px-6 py-6" title={rule.Direction}>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${rule.Action === 'Allow' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {rule.Action}
                            </span>
                          </td>
                          <td className="px-6 py-6">
                            <span className="text-xs font-bold text-gray-600">{rule.Protocol} / {rule.LocalPort}</span>
                          </td>
                          <td className="px-8 py-6 text-right">
                             <div className="flex items-center justify-end gap-3">
                               <button 
                                 onClick={() => { setEditingRule(rule); setShowAddModal(true); }}
                                 className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                                 title="Edit Rule"
                               >
                                 <Edit2 size={16} />
                               </button>
                               <button 
                                 onClick={() => handleToggle(rule.DisplayName)}
                                 className={`p-2 rounded-lg transition-all ${rule.Enabled === 'True' ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                                 title={rule.Enabled === 'True' ? 'Disable Rule' : 'Enable Rule'}
                               >
                                 <Power size={16} />
                               </button>
                               <button 
                                 onClick={() => handleDelete(rule.DisplayName)}
                                 className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                 title="Delete Rule"
                               >
                                 <Trash2 size={16} />
                               </button>
                             </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
