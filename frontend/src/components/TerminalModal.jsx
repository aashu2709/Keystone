import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { X, Maximize, Minimize } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { getErrorMessage } from '../services/api';

const TerminalModal = ({ isOpen, onClose, vmId, vmName }) => {
  const terminalRef = useRef(null);
  const termInstanceRef = useRef(null);
  const wsRef = useRef(null);
  const fitAddonRef = useRef(null);
  const resizeObserverRef = useRef(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    // Initialize Terminal
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"Fira Code", monospace',
      fontSize: 14,
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    termInstanceRef.current = term;
    fitAddonRef.current = fitAddon;

    if (terminalRef.current) {
      term.open(terminalRef.current);
      // Need a small delay for DOM to be ready for fit
      setTimeout(() => fitAddon.fit(), 50);
    }

    // Connect WebSocket
    const token = localStorage.getItem('access_token');
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';
    const wsBaseUrl = apiBaseUrl.replace('http', 'ws');
    const wsUrl = `${wsBaseUrl}/admin/terminal/${vmId}?token=${token}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError('');
      term.focus();
      
      // Send initial resize
      if (term.cols && term.rows) {
        ws.send(JSON.stringify({ cols: term.cols, rows: term.rows }));
      }
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
      setError('Connection error. Is the backend running?');
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      if (event.code === 1008) {
        setError('Unauthorized: Admin access required.');
      } else if (event.code !== 1000 && !error) {
        term.write('\r\n\x1b[31m[Session Disconnected]\x1b[0m\r\n');
      }
    };

    // Handle user input
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Handle terminal resize events
    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ cols, rows }));
      }
    });

    // Watch for container resizes
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && termInstanceRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (e) {
          console.error("Fit error", e);
        }
      }
    });
    
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }
    resizeObserverRef.current = resizeObserver;

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (termInstanceRef.current) {
        termInstanceRef.current.dispose();
      }
    };
  }, [isOpen, vmId]);

  // Handle Fullscreen toggle
  useEffect(() => {
    if (fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current.fit(), 100);
    }
  }, [isFullscreen]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm transition-all duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div 
        className={`bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen ? 'w-full h-full' : 'w-full max-w-5xl h-[70vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
            </div>
            <div className="h-4 w-[1px] bg-zinc-700 mx-1"></div>
            <span className="text-sm font-mono text-zinc-300 font-medium">
              {vmName} <span className="text-zinc-500">~ Remote PowerShell</span>
            </span>
            <div className="flex items-center gap-2 ml-4">
              <span className="relative flex h-2.5 w-2.5">
                {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
              </span>
              <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
              title="Close Terminal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border-b border-red-500/20 text-red-400 px-4 py-2 text-xs font-mono">
            {error}
          </div>
        )}

        {/* Terminal Container */}
        <div className="flex-1 w-full h-full bg-[#1e1e1e] p-2 overflow-hidden">
          <div ref={terminalRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
};

export default TerminalModal;
