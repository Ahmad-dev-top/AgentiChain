"use client";

import React, { useState } from "react";
import { AgentTraceItem, ProjectDetail, SupportedChain } from "@/lib/types";
import { 
  Sparkles, 
  Send, 
  Play, 
  ShieldCheck, 
  Terminal, 
  Cpu, 
  Flame, 
  Zap, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  ChevronDown,
  Layers,
  ArrowRight,
  Code2,
  FileCheck
} from "lucide-react";

interface AgentChatWorkspaceProps {
  project: ProjectDetail;
  onSynthesize: (prompt: string, chain: SupportedChain, name?: string) => Promise<void>;
  isProcessing: boolean;
  onSelectTab: (tabId: string) => void;
  selectedChain: SupportedChain;
}

const QUICK_PROMPTS = [
  {
    title: "ERC4626 Yield Vault with Fee",
    prompt: "Create a production-grade ERC4626 Tokenized Yield Vault on Base with a 2% performance fee, virtual shares offset against inflation attacks, emergency pause circuit breaker, and 3-day timelock admin rules.",
    chain: "Base" as SupportedChain,
    standard: "ERC4626",
  },
  {
    title: "Liquid Restaking Token (LRT)",
    prompt: "Architect a Liquid Restaking Token (rsETH) protocol on Ethereum Mainnet with dynamic epoch compounding, multi-operator delegation, and slashing insurance buffer.",
    chain: "Ethereum" as SupportedChain,
    standard: "RESTAKING",
  },
  {
    title: "Decentralized Governor DAO",
    prompt: "Deploy a Decentralized Governor DAO on Arbitrum One with TimelockController, ERC20Votes token, 4% quorum requirement, 1-week voting period, and emergency veto authority.",
    chain: "Arbitrum One" as SupportedChain,
    standard: "GOVERNOR",
  },
  {
    title: "Flash Loan Arbitrage Receiver",
    prompt: "Build an Aave V3 Flash Loan Arbitrage receiver contract on Base with Uniswap V3 swap routing, strict minimum profit assertion, and reentrancy protection.",
    chain: "Base" as SupportedChain,
    standard: "CUSTOM",
  },
  {
    title: "Multi-Sig Escrow with Dispute Arbiter",
    prompt: "Design a non-custodial 2-of-3 multi-signature escrow protocol with milestone releases, 14-day timeout challenge period, and designated third-party arbitration.",
    chain: "Polygon" as SupportedChain,
    standard: "ESCROW",
  },
];

export const AgentChatWorkspace: React.FC<AgentChatWorkspaceProps> = ({
  project,
  onSynthesize,
  isProcessing,
  onSelectTab,
  selectedChain,
}) => {
  const [promptInput, setPromptInput] = useState("");
  const [contractNameInput, setContractNameInput] = useState("");
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim() || isProcessing) return;
    onSynthesize(promptInput, selectedChain, contractNameInput.trim() || undefined);
  };

  const handleSelectQuickPrompt = (p: typeof QUICK_PROMPTS[0]) => {
    setPromptInput(p.prompt);
    if (!contractNameInput) {
      setContractNameInput(p.title.replace(/[^a-zA-Z0-9]/g, ""));
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/40 border border-slate-800 p-5 sm:p-6 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 text-xs font-mono font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Autonomous Multi-Agent Pipeline Active</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Design & Verify Production Smart Contracts
            </h1>
            <p className="text-slate-400 text-sm mt-1.5 max-w-2xl leading-relaxed">
              Describe your protocol mechanics in plain natural language. AgentiChain coordinates 6 specialized AI agents (Architect, Solidity Engineer, Security Auditor, Foundry Tester, Gas Optimizer, and Deployer) to produce battle-tested, gas-optimized, formally verified EVM code.
            </p>
          </div>

          <div className="flex flex-row md:flex-col items-center md:items-end gap-2 shrink-0">
            <div className="text-right hidden md:block">
              <span className="text-[11px] text-slate-400">Current Workspace Target</span>
              <div className="text-sm font-mono font-bold text-cyan-300">{selectedChain} Network</div>
            </div>
            <button
              onClick={() => onSelectTab("code")}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-all shadow-md"
            >
              <Code2 className="w-4 h-4 text-cyan-400" />
              <span>Inspect Code IDE ({project.contracts.length} files)</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Natural Language Prompt Box */}
        <form onSubmit={handleSubmit} className="mt-5">
          <div className="relative rounded-xl bg-slate-950/80 border border-slate-700/80 focus-within:border-cyan-500/80 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all shadow-inner">
            <textarea
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="e.g. Create an ERC4626 Tokenized Yield Vault on Base with a 2% performance fee, virtual shares to stop inflation attacks, an emergency pause circuit breaker, and 3-day timelock access control..."
              rows={3}
              className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-sm p-4 pr-24 resize-none focus:outline-none"
              disabled={isProcessing}
            />

            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/60 border-t border-slate-800/80 rounded-b-xl gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={contractNameInput}
                  onChange={(e) => setContractNameInput(e.target.value)}
                  placeholder="Contract Name (optional, e.g. AgentiVault4626)"
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  disabled={isProcessing}
                />
                <span className="text-xs text-slate-500 hidden sm:inline">Solidity 0.8.24 + OpenZeppelin v5</span>
              </div>

              <button
                type="submit"
                disabled={isProcessing || !promptInput.trim()}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg ${
                  isProcessing || !promptInput.trim()
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-blue-500/25 active:scale-95"
                }`}
              >
                {isProcessing ? (
                  <>
                    <Cpu className="w-4 h-4 animate-spin text-cyan-300" />
                    <span>Orchestrating Swarm...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-cyan-300 fill-cyan-300" />
                    <span>Run Multi-Agent Pipeline</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Quick Suggested Intent Chips */}
        <div className="mt-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Instant Protocol Architect Presets:</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {QUICK_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectQuickPrompt(qp)}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 hover:border-cyan-500/50 text-xs text-slate-300 hover:text-white transition-all text-left group"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-cyan-400 group-hover:text-cyan-300">{qp.title}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">{qp.chain}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time Multi-Agent Swarm Orchestration Trace Cards */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">LangGraph Multi-Agent Execution State</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {project.traces.length} steps recorded
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {project.traces.reduce((acc, t) => acc + (t.latencyMs || 0), 0)} ms
              </span>
            </span>
            <span className="flex items-center gap-1 font-mono">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {project.traces.reduce((acc, t) => acc + (t.tokensUsed || 0), 0).toLocaleString()} tokens
              </span>
            </span>
          </div>
        </div>

        {/* Step-by-Step Agent Execution Pipeline Cards */}
        <div className="space-y-3">
          {project.traces.map((trace, index) => {
            const isExpanded = expandedTrace === trace.id || index === project.traces.length - 1;
            return (
              <div
                key={trace.id}
                className="rounded-xl bg-slate-950/70 border border-slate-800/90 overflow-hidden transition-all hover:border-slate-700"
              >
                <div
                  onClick={() => setExpandedTrace(isExpanded ? null : trace.id)}
                  className="flex items-center justify-between p-3.5 cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-sm font-bold text-cyan-400 border border-slate-700">
                      {index + 1}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200">{trace.agentName}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/80 border border-blue-900 text-blue-300">
                          {trace.agentRole}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{trace.action}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{trace.status}</span>
                    </div>

                    <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-500">
                      <span>{trace.latencyMs}ms</span>
                      <span>•</span>
                      <span>{trace.tokensUsed} tok</span>
                    </div>

                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 border-t border-slate-800/80 bg-slate-950/90 space-y-3 text-xs">
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Agent Chain-of-Thought Reasoning
                      </div>
                      <p className="text-slate-300 font-mono text-xs leading-relaxed bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                        {trace.thought}
                      </p>
                    </div>

                    {trace.outputPayload && (
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Generated Artifacts & Verified Metrics
                        </div>
                        <pre className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto">
                          {JSON.stringify(trace.outputPayload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Fast Action Footer */}
        <div className="mt-5 p-3 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-300 font-medium">
              Specification, Solidity Source, Foundry Test Harness & Slither Security Model Synchronized
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectTab("audit")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Audit Report ({project.audit?.securityScore || 100}/100)</span>
            </button>

            <button
              onClick={() => onSelectTab("simulation")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Foundry Tests & Gas</span>
            </button>

            <button
              onClick={() => onSelectTab("deploy")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              <span>Deploy to {selectedChain}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
