"use client";

import React, { useState } from "react";
import { AgentTraceItem } from "@/lib/types";
import { 
  Terminal, 
  Cpu, 
  Server, 
  Activity, 
  Database, 
  Clock, 
  Zap, 
  ShieldCheck, 
  Flame, 
  RefreshCw 
} from "lucide-react";

interface TelemetryConsoleProps {
  traces: AgentTraceItem[];
}

export const TelemetryConsole: React.FC<TelemetryConsoleProps> = ({ traces }) => {
  const [filterLevel, setFilterLevel] = useState<string>("all");

  const totalTokens = traces.reduce((acc, t) => acc + (t.tokensUsed || 0), 0);
  const totalLatency = traces.reduce((acc, t) => acc + (t.latencyMs || 0), 0);

  return (
    <div className="space-y-6">
      {/* Cloud Server Telemetry Card */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300">
                Oracle Always Free Cloud Infrastructure (ARM64 Ubuntu 24.04 LTS)
              </span>
              <span className="text-xs font-mono text-cyan-400">
                ● Telemetry Stream Active
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">Cloud Server Telemetry & Agent Traces</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live metrics for multi-agent reasoning, Slither static analysis runs, Anvil EVM execution, and PostgreSQL transactions.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500 text-[10px]">CPU UTILIZATION</div>
            <div className="font-bold text-sm text-cyan-300 mt-0.5">14.2% (4 OCPUs)</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500 text-[10px]">MEMORY POOL</div>
            <div className="font-bold text-sm text-indigo-300 mt-0.5">2.4 / 24.0 GB</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500 text-[10px]">TOTAL TOKENS USED</div>
            <div className="font-bold text-sm text-amber-300 mt-0.5">{totalTokens.toLocaleString()} tok</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500 text-[10px]">TOTAL INFERENCE LATENCY</div>
            <div className="font-bold text-sm text-emerald-400 mt-0.5">{totalLatency} ms</div>
          </div>
        </div>
      </div>

      {/* Stream Logs */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs shadow-2xl space-y-2">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-slate-400 text-[11px]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>telemetry_stream.log</span>
          </div>
          <span className="text-emerald-400">● Streaming Real-Time Events</span>
        </div>

        <div className="space-y-2 overflow-x-auto max-h-[550px] p-2">
          {traces.map((trace, idx) => (
            <div key={idx} className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between flex-wrap gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">[{new Date(trace.createdAt).toLocaleTimeString()}]</span>
                  <span className="font-bold text-cyan-300">{trace.agentName}</span>
                  <span className="text-slate-400 font-semibold">• {trace.action}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="text-emerald-400">{trace.status}</span>
                  <span>{trace.latencyMs}ms</span>
                  <span>{trace.tokensUsed} tokens</span>
                </div>
              </div>

              <div className="text-slate-300 text-xs pl-2 border-l-2 border-cyan-500/40">
                {trace.thought}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
