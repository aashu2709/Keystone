import { useState, useEffect, useRef } from 'react';
import { adminAPI, certificateAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { Download, RefreshCw, Server, AlertTriangle, ShieldAlert, Award, Search, ChevronDown, CheckCircle2, X } from 'lucide-react';

const VMSelector = ({ vms, selectedVM, setSelectedVM, loading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredVMs = vms.filter(vm => 
    vm.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    vm.ip_address.includes(searchTerm)
  );

  const handleSelect = (vm) => {
    setSelectedVM(vm.id);
    setIsOpen(false);
  };

  const selectedVMObj = vms.find(v => v.id === selectedVM);

  return (
    <div className="relative mb-6" ref={dropdownRef}>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Select Target Server</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full md:w-96 flex items-center justify-between px-4 py-2.5 bg-white border border-gray-300 rounded-xl shadow-sm text-left hover:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Server size={18} className={selectedVMObj ? 'text-primary-500' : 'text-gray-400'} />
          <span className={`truncate text-sm font-medium ${selectedVMObj ? 'text-gray-900' : 'text-gray-500'}`}>
            {selectedVMObj ? `${selectedVMObj.name} (${selectedVMObj.ip_address})` : 'Choose a server...'}
          </span>
        </div>
        <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full md:w-96 bg-white border border-gray-200 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="p-3 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                type="text"
                placeholder="Filter by name or IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
            {loading ? (
              <div className="p-4 text-center text-sm text-gray-500">Loading servers...</div>
            ) : filteredVMs.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">No servers found.</div>
            ) : (
              filteredVMs.map(vm => (
                <button
                  key={vm.id}
                  onClick={() => handleSelect(vm)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all ${
                    selectedVM === vm.id ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-bold text-gray-900">{vm.name}</span>
                    <span className="text-xs text-gray-500 font-mono mt-0.5">{vm.ip_address}</span>
                  </div>
                  {selectedVM === vm.id && <CheckCircle2 size={16} className="text-primary-600" />}
                </button>
              ))
            )}
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

  useEffect(() => {
    fetchVMs();
  }, []);

  useEffect(() => {
    if (selectedVM) {
      fetchCertificates();
    } else {
      setCertificates([]);
    }
  }, [selectedVM]);

  const fetchVMs = async () => {
    try {
      setLoadingVMs(true);
      const res = await adminAPI.getVMs({ limit: 500 });
      setVms(res.vms || []);
    } catch (err) {
      toast.error('Failed to load VMs');
    } finally {
      setLoadingVMs(false);
    }
  };

  const fetchCertificates = async () => {
    try {
      setLoadingCerts(true);
      const data = await certificateAPI.getCertificates(selectedVM);
      setCertificates(data.certificates || []);
    } catch (err) {
      toast.error(err.message || 'Failed to fetch certificates');
      setCertificates([]);
    } finally {
      setLoadingCerts(false);
    }
  };

  const filteredCerts = certificates.filter(c => 
    c.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.thumbprint.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Award className="text-primary-500" /> Certificate Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track IIS-bound SSL/TLS certificates and monitor upcoming expirations.</p>
        </div>
        <button 
          onClick={fetchCertificates}
          disabled={!selectedVM || loadingCerts}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
        >
          <RefreshCw size={16} className={loadingCerts ? "animate-spin text-primary-500" : "text-gray-400"} />
          {loadingCerts ? 'Scanning...' : 'Refresh'}
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <VMSelector vms={vms} selectedVM={selectedVM} setSelectedVM={setSelectedVM} loading={loadingVMs} />
        
        {selectedVM && !loadingCerts && certificates.length > 0 && (
          <div className="mb-4 relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Subject or Thumbprint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            />
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loadingCerts ? (
            <div className="p-12 text-center">
              <RefreshCw size={32} className="mx-auto text-primary-300 animate-spin mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Scanning IIS Site Bindings</h3>
              <p className="text-sm text-gray-500 mt-1">Querying HTTPS bindings from IIS websites...</p>
            </div>
          ) : !selectedVM ? (
            <div className="p-12 text-center">
              <Server size={32} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Server Selected</h3>
              <p className="text-sm text-gray-500 mt-1">Please select a target server from the dropdown above.</p>
            </div>
          ) : certificates.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No certificates found on this server.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50/80 text-gray-500 font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3">Subject / Issued To</th>
                    <th className="px-6 py-3">IIS Site</th>
                    <th className="px-6 py-3">Binding</th>
                    <th className="px-6 py-3">Valid From</th>
                    <th className="px-6 py-3">Expires On</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCerts.map((cert) => {
                    const isExpired = cert.days_remaining < 0;
                    const isWarning = cert.days_remaining >= 0 && cert.days_remaining <= 30;
                    
                    return (
                      <tr key={cert.thumbprint} className={`${isExpired ? 'bg-red-50/30' : isWarning ? 'bg-amber-50/30' : 'hover:bg-gray-50'}`}>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900 truncate max-w-xs" title={cert.subject}>{cert.subject}</div>
                          <div className="text-xs text-gray-500 font-mono mt-1" title={cert.thumbprint}>{cert.thumbprint.substring(0, 16)}...</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900 text-xs">{cert.site_name || 'N/A'}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {cert.site_state === 'Started' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span> Running</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-gray-400"><span className="w-1.5 h-1.5 bg-gray-400 rounded-full inline-block"></span> {cert.site_state || 'Unknown'}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-md font-mono">:{cert.binding_port || '443'}</span>
                          {cert.host_header && cert.host_header !== '(All Unassigned)' && (
                            <span className="text-xs text-gray-500 ml-1.5">{cert.host_header}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-500">{cert.not_before}</td>
                        <td className={`px-6 py-4 font-medium ${isExpired ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-gray-900'}`}>
                          {cert.not_after}
                        </td>
                        <td className="px-6 py-4">
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700">
                              <AlertTriangle size={14} /> Expired ({cert.days_remaining * -1} days ago)
                            </span>
                          ) : isWarning ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-700">
                              <ShieldAlert size={14} /> {cert.days_remaining} Days Left
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-700">
                              <CheckCircle2 size={14} /> Valid ({cert.days_remaining} Days)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCerts.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-gray-500">No certificates match your search.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageCertificates;
