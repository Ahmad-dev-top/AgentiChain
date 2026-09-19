"use client";

import React, { useState } from "react";
import { ContractFile } from "@/lib/types";
import { 
  Code2, 
  Copy, 
  Check, 
  FileCode, 
  Download, 
  Play, 
  Sparkles, 
  ShieldCheck, 
  Sliders, 
  Terminal,
  ExternalLink,
  Cpu
} from "lucide-react";

interface CodeEditorWorkspaceProps {
  contracts: ContractFile[];
  onUpdateContractCode?: (contractId: string, newCode: string) => void;
  onRunAudit: () => void;
  onRunSimulation: () => void;
}

export const CodeEditorWorkspace: React.FC<CodeEditorWorkspaceProps> = ({
  contracts,
  onUpdateContractCode,
  onRunAudit,
  onRunSimulation,
}) => {
  const [activeFileId, setActiveFileId] = useState<string>(contracts[0]?.id || "");
  const [copied, setCopied] = useState(false);
  const [showAst, setShowAst] = useState(false);

  const activeContract = contracts.find((c) => c.id === activeFileId) || contracts[0];

  const handleCopy = () => {
    if (!activeContract) return;
    navigator.clipboard.writeText(activeContract.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = (activeContract?.code || "").split("\n");

  return (
    <div className="space-y-4">
      {/* IDE Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-2xl shadow-xl">
        {/* File Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {contracts.map((file) => {
            const isActive = file.id === (activeContract?.id || "");
            return (
              <button
                key={file.id}
                onClick={() => setActiveFileId(file.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono transition-all shrink-0 ${
                  isActive
                    ? "bg-slate-800 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <FileCode className={`w-3.5 h-3.5 ${isActive ? "text-cyan-400" : "text-slate-500"}`} />
                <span>{file.name}</span>
                <span className="text-[10px] text-slate-500 uppercase px-1 rounded bg-slate-950">
                  {file.contractType}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowAst(!showAst)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 transition-colors"
          >
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>{showAst ? "Solidity Code" : "Inspect AST"}</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          <button
            onClick={onRunAudit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-800 text-emerald-300 text-xs font-semibold transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Run Slither Audit</span>
          </button>

          <button
            onClick={onRunSimulation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-800 text-cyan-300 text-xs font-semibold transition-colors"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Forge Test</span>
          </button>
        </div>
      </div>

      {/* Compiler Metadata Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Path: {activeContract?.filePath}</span>
          </span>
          <span className="hidden md:inline text-slate-600">|</span>
          <span className="hidden md:inline">Solc 0.8.24 (Cancun EVM)</span>
          <span className="hidden md:inline text-slate-600">|</span>
          <span className="hidden md:inline text-cyan-400">via-ir: true (runs: 200)</span>
        </div>
        <div>
          <span>{lines.length} lines • OpenZeppelin v5.0 compliant</span>
        </div>
      </div>

      {/* Code Editor Window */}
      {showAst ? (
        <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-purple-300 overflow-x-auto max-h-[650px] shadow-2xl">
          <div className="text-slate-400 mb-2 pb-2 border-b border-slate-800 text-[11px]">
            Solidity Abstract Syntax Tree (AST) & Storage Map Breakdown
          </div>
          <pre>
            {JSON.stringify(
              {
                contract: activeContract?.name,
                sourceLocation: activeContract?.filePath,
                linearizedBaseContracts: ["ERC4626", "ERC20", "AccessControlDefaultAdminRules", "Pausable", "ReentrancyGuard"],
                storageSlots: [
                  { slot: 0, offset: 0, bytes: 2, type: "uint16", name: "performanceFeeBps" },
                  { slot: 0, offset: 2, bytes: 20, type: "address", name: "feeRecipient" },
                  { slot: 0, offset: 22, bytes: 8, type: "uint64", name: "lastHarvestTimestamp" },
                  { slot: 1, offset: 0, bytes: 32, type: "uint256", name: "_status (ReentrancyGuard)" },
                ],
                optimizationFlags: ["cancun_transient_storage", "yul_via_ir_inlining"],
              },
              null,
              2
            )}
          </pre>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#080d1a] border border-slate-800/90 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto max-h-[700px] flex">
            {/* Line numbers */}
            <div className="select-none py-4 px-3 bg-slate-950/90 text-slate-600 font-mono text-xs text-right border-r border-slate-800/80 leading-relaxed">
              {lines.map((_, idx) => (
                <div key={idx}>{idx + 1}</div>
              ))}
            </div>

            {/* Code Content */}
            <pre className="p-4 font-mono text-xs text-slate-200 leading-relaxed overflow-x-auto flex-1">
              <code>{activeContract?.code}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
