"use client";

import React, { useState } from "react";
import { ContractSpec } from "@/lib/types";
import { 
  Network, 
  Layers, 
  ShieldCheck, 
  Key, 
  Cpu, 
  ArrowDownRight, 
  ArrowRight, 
  ExternalLink,
  Sliders,
  CheckCircle2
} from "lucide-react";

interface ArchitectureGraphProps {
  spec: ContractSpec;
}

export const ArchitectureGraph: React.FC<ArchitectureGraphProps> = ({ spec }) => {
  const [selectedNode, setSelectedNode] = useState<string>("core");

  const nodes = [
    {
      id: "core",
      title: `${spec.name}.sol`,
      subtitle: "Main Execution Contract",
      badge: "Core Solidity 0.8.24",
      color: "border-cyan-500 bg-cyan-950/40 text-cyan-300",
      details: "Encapsulates business logic, custom errors, virtual share offsets, and state accounting.",
    },
    {
      id: "oz_erc4626",
      title: "OpenZeppelin ERC4626",
      subtitle: "Yield Vault Standard",
      badge: "EIP-4626 Standard",
      color: "border-blue-500 bg-blue-950/40 text-blue-300",
      details: "Provides deposit(), withdraw(), redeem(), totalAssets(), and decimal offset logic.",
    },
    {
      id: "oz_access",
      title: "AccessControlDefaultAdminRules",
      subtitle: "Timelocked Role Manager",
      badge: "OZ v5.0 Security",
      color: "border-amber-500 bg-amber-950/40 text-amber-300",
      details: "Enforces 3-day timelock on admin transfers and manages STRATEGIST_ROLE & PAUSER_ROLE.",
    },
    {
      id: "oz_guards",
      title: "ReentrancyGuard & Pausable",
      subtitle: "Defensive Execution Modifiers",
      badge: "Circuit Breakers",
      color: "border-emerald-500 bg-emerald-950/40 text-emerald-300",
      details: "Guards against reentrancy loops (SWC-107) and enables emergency circuit breaker pause.",
    },
    {
      id: "storage",
      title: "Storage Slot 0 Packed",
      subtitle: "performanceFeeBps | recipient | timestamp",
      badge: "Opcode Optimized",
      color: "border-purple-500 bg-purple-950/40 text-purple-300",
      details: "Packs uint16 (16b) + address (160b) + uint64 (64b) = 240b <= 256b into single SSTORE slot.",
    },
    {
      id: "external_asset",
      title: "Underlying Asset (IERC20)",
      subtitle: "SafeERC20 Asset Reserve",
      badge: "External Contract",
      color: "border-indigo-500 bg-indigo-950/40 text-indigo-300",
      details: "Underlying ERC20 asset held in vault custody and transferred using OpenZeppelin SafeERC20.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-purple-950 border border-purple-800 text-purple-300">
              Interactive Protocol Architecture & Dependency Graph
            </span>
          </div>
          <h2 className="text-xl font-bold text-white">Smart Contract Structural Topology</h2>
          <p className="text-xs text-slate-400 mt-1">
            Visual breakdown of contract inheritance, storage slot packing, defensive guards, and external token boundaries.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="px-2 py-1 rounded bg-slate-800 text-cyan-300">Target: {spec.targetChain}</span>
        </div>
      </div>

      {/* Visual Node Diagram */}
      <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-6 shadow-2xl relative overflow-hidden min-h-[460px]">
        {/* Background Grid Accent */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

        {/* Layout Nodes */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Base Libraries / Inheritance */}
          <div className="space-y-4">
            <div className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pb-2 border-b border-slate-800">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Base Standards & Controls</span>
            </div>

            {nodes.slice(1, 4).map((node) => (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer shadow-lg ${
                  selectedNode === node.id
                    ? `${node.color} ring-2 ring-cyan-500/40 scale-[1.02]`
                    : "bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-xs">{node.title}</h4>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950">
                    {node.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{node.subtitle}</p>
              </div>
            ))}
          </div>

          {/* Central Core Contract */}
          <div className="space-y-4 flex flex-col justify-center">
            <div className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pb-2 border-b border-slate-800">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Primary Execution Core</span>
            </div>

            <div
              onClick={() => setSelectedNode("core")}
              className={`p-6 rounded-2xl border transition-all cursor-pointer shadow-2xl ${
                selectedNode === "core"
                  ? "border-cyan-400 bg-cyan-950/50 text-cyan-200 ring-2 ring-cyan-400/50 scale-[1.03]"
                  : "bg-slate-900/90 border-slate-700 text-slate-200 hover:border-cyan-500/50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {spec.standard} Tokenized Core
                </span>
                <span className="text-xs font-mono text-emerald-400">● Verified</span>
              </div>

              <h3 className="text-base font-extrabold text-white mb-1">{spec.name}</h3>
              <p className="text-xs text-slate-300 mb-4">{spec.description}</p>

              <div className="space-y-1.5 pt-3 border-t border-slate-800 text-[11px] font-mono text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Solidity Pragma:</span>
                  <span className="text-cyan-300">0.8.24</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Decimals Offset:</span>
                  <span className="text-emerald-300">3 (Virtual Shares)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Reentrancy Protection:</span>
                  <span className="text-emerald-300">Transient Locked</span>
                </div>
              </div>
            </div>
          </div>

          {/* Storage & Integrations */}
          <div className="space-y-4">
            <div className="text-xs font-bold font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pb-2 border-b border-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>Storage & External Interfaces</span>
            </div>

            {nodes.slice(4).map((node) => (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer shadow-lg ${
                  selectedNode === node.id
                    ? `${node.color} ring-2 ring-cyan-500/40 scale-[1.02]`
                    : "bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-xs">{node.title}</h4>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950">
                    {node.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{node.subtitle}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Node Detail Inspector Bar */}
        {selectedNode && (
          <div className="mt-6 p-4 rounded-xl bg-slate-900/95 border border-slate-800 text-xs shadow-xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-slate-200">
                Selected Component: {nodes.find((n) => n.id === selectedNode)?.title}
              </span>
              <span className="text-[11px] font-mono text-cyan-400">
                {nodes.find((n) => n.id === selectedNode)?.badge}
              </span>
            </div>
            <p className="text-slate-400 leading-relaxed font-mono text-[11px]">
              {nodes.find((n) => n.id === selectedNode)?.details}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
