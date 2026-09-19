"use client";

import React, { useState } from "react";
import { SupportedChain } from "@/lib/types";
import { SUPPORTED_CHAINS, AGENT_PROFILES } from "@/lib/constants";
import { 
  Bot, 
  Cpu, 
  Server, 
  ShieldCheck, 
  Zap, 
  Flame, 
  Terminal, 
  Globe, 
  ChevronDown, 
  Sparkles,
  Layers,
  Database,
  RefreshCw
} from "lucide-react";

interface HeaderProps {
  selectedChain: SupportedChain;
  onSelectChain: (chain: SupportedChain) => void;
  onOpenTemplates: () => void;
  onNewSession: () => void;
  isProcessing: boolean;
  activeAgentName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  selectedChain,
  onSelectChain,
  onOpenTemplates,
  onNewSession,
  isProcessing,
  activeAgentName,
}) => {
  const [showChainDropdown, setShowChainDropdown] = useState(false);
  const [showAgentDetails, setShowAgentDetails] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);

  const chainConfig = SUPPORTED_CHAINS[selectedChain] || SUPPORTED_CHAINS["Base"];

  return (
    <header className="sticky top-0 z-50 bg-[#0b101b]/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Brand & Tag */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 p-[1px] shadow-lg shadow-blue-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
              <Bot className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full animate-ping" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent">
                AgentiChain
              </span>
              <span className="text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
                v2.4 Autonomous
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Multi-Agent Smart Contract Orchestration & Formal Verification Engine
            </p>
          </div>
        </div>

        {/* Center: Swarm Status Pills */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full">
          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-300 font-medium">Swarm:</span>
          </div>

          <div 
            onClick={() => setShowAgentDetails(!showAgentDetails)}
            className="flex items-center gap-1 text-xs font-mono text-cyan-300 cursor-pointer hover:text-cyan-200 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isProcessing ? (activeAgentName || "Orchestrating...") : "7 Agents Ready"}</span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </div>
        </div>

        {/* Right: Cloud Server Badge, Network Selector & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Oracle Cloud Host Badge */}
          <button
            onClick={() => setShowServerModal(!showServerModal)}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-xs text-slate-300 transition-colors"
            title="Oracle Always Free Cloud Host Telemetry"
          >
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-[11px] text-slate-300">Oracle Cloud</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </button>

          {/* Chain Selector */}
          <div className="relative">
            <button
              onClick={() => setShowChainDropdown(!showChainDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 transition-all shadow-sm"
            >
              <span>{chainConfig.icon}</span>
              <span className="font-semibold">{chainConfig.name}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showChainDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1 z-50">
                <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Select Target Chain
                </div>
                {Object.values(SUPPORTED_CHAINS).map((chain) => (
                  <button
                    key={chain.name}
                    onClick={() => {
                      onSelectChain(chain.name);
                      setShowChainDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                      selectedChain === chain.name
                        ? "bg-blue-600/30 text-cyan-300 font-semibold"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{chain.icon}</span>
                      <span>{chain.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">ID:{chain.chainId}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preset Templates */}
          <button
            onClick={onOpenTemplates}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Templates</span>
          </button>

          {/* New Session Button */}
          <button
            onClick={onNewSession}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span>New Prompt</span>
          </button>
        </div>
      </div>

      {/* Agents Swarm Overview Dropdown / Modal */}
      {showAgentDetails && (
        <div className="mt-2.5 p-3 max-w-7xl mx-auto bg-slate-900/95 border border-slate-800 rounded-xl grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 shadow-2xl">
          {AGENT_PROFILES.map((agent) => (
            <div key={agent.role} className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-base">{agent.avatar}</span>
                <span className="text-[11px] font-bold text-slate-200 truncate">{agent.role}</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight line-clamp-2">{agent.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Oracle Cloud Infrastructure Diagnostics Modal */}
      {showServerModal && (
        <div className="mt-2.5 p-4 max-w-7xl mx-auto bg-slate-900 border border-slate-800 rounded-xl shadow-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-bold text-slate-200">Oracle Always Free Cloud Server Diagnostics</h4>
            </div>
            <button onClick={() => setShowServerModal(false)} className="text-xs text-slate-400 hover:text-white">✕ Close</button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-slate-400 text-[11px]">Host Environment</div>
              <div className="font-mono font-bold text-slate-200 mt-1">Ubuntu 24.04 LTS (ARM64)</div>
              <div className="text-[10px] text-emerald-400 mt-0.5">● Status: Healthy (99.99%)</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-slate-400 text-[11px]">Toolchain Versions</div>
              <div className="font-mono font-bold text-cyan-300 mt-1">Solc 0.8.24 | Forge 0.2.0</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Slither v0.10.2 / Anvil EVM</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-slate-400 text-[11px]">Database Engine</div>
              <div className="font-mono font-bold text-indigo-300 mt-1">PostgreSQL 16 + Drizzle</div>
              <div className="text-[10px] text-emerald-400 mt-0.5">● Active Connections: OK</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-slate-400 text-[11px]">Agent Pipeline Engine</div>
              <div className="font-mono font-bold text-purple-300 mt-1">LangGraph Multi-Agent</div>
              <div className="text-[10px] text-cyan-400 mt-0.5">7 Subsystem Microagents</div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
