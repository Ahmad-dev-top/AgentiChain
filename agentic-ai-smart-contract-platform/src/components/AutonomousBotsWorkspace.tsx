"use client";

import React, { useState } from "react";
import { MonitoringBotRecord } from "@/lib/types";
import { 
  Bot, 
  Activity, 
  ShieldAlert, 
  Zap, 
  Play, 
  Pause, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Terminal, 
  RefreshCw,
  Bell,
  Cpu
} from "lucide-react";

interface AutonomousBotsWorkspaceProps {
  bots: MonitoringBotRecord[];
  contractAddress: string;
  network: string;
  projectId: string;
  onCreateBot: (botType: "event_watcher" | "tvl_monitor" | "gas_spike_alert" | "health_keeper" | "circuit_breaker", name: string) => Promise<void>;
  onTriggerSimulatedAnomaly: () => void;
}

export const AutonomousBotsWorkspace: React.FC<AutonomousBotsWorkspaceProps> = ({
  bots,
  contractAddress,
  network,
  projectId,
  onCreateBot,
  onTriggerSimulatedAnomaly,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBotName, setNewBotName] = useState("");
  const [newBotType, setNewBotType] = useState<"event_watcher" | "tvl_monitor" | "gas_spike_alert" | "health_keeper" | "circuit_breaker">("tvl_monitor");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onCreateBot(newBotType, newBotName || "Autonomous Protocol Watcher");
      setShowAddModal(false);
      setNewBotName("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300">
                Phase 7: Autonomous On-Chain Watchers & Keeper Bots
              </span>
              <span className="text-xs font-mono text-cyan-400">
                ● WebSocket RPC Listener Active
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">Real-Time Autonomous Protocol Guardians</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Event ingestion bots, TVL anomaly detectors, MEV spike triggers, and automated emergency pause circuit breakers.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onTriggerSimulatedAnomaly}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-800 text-amber-300 text-xs font-semibold transition-all shadow-md active:scale-95"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulate On-Chain Anomaly</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white text-xs font-bold transition-all shadow-lg active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Keeper Bot</span>
            </button>
          </div>
        </div>

        {/* Global Bot Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500 text-[10px]">ACTIVE BOTS</div>
            <div className="font-bold text-sm text-emerald-400 mt-0.5">{bots.length} Running</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500 text-[10px]">EVENTS INGESTED</div>
            <div className="font-bold text-sm text-cyan-300 mt-0.5">
              {bots.reduce((acc, b) => acc + (b.eventsCaptured || 0), 0).toLocaleString()}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500 text-[10px]">ALERTS FIRED</div>
            <div className="font-bold text-sm text-amber-300 mt-0.5">
              {bots.reduce((acc, b) => acc + (b.alertsFired || 0), 0)}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500 text-[10px]">HEARTBEAT FREQUENCY</div>
            <div className="font-bold text-sm text-slate-200 mt-0.5">30s Ticks</div>
          </div>
        </div>
      </div>

      {/* Bots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bots.map((bot) => (
          <div
            key={bot.id}
            className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-xl space-y-3 hover:border-slate-700 transition-all"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">{bot.name}</h4>
                  <span className="text-[10px] font-mono text-cyan-400 uppercase">{bot.botType}</span>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>ACTIVE</span>
              </span>
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                <div className="text-slate-500 text-[10px]">TARGET EVENT</div>
                <div className="text-cyan-300 font-bold truncate">{bot.targetEvent}</div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                <div className="text-slate-500 text-[10px]">TRIGGER CONDITION</div>
                <div className="text-amber-300 text-[11px]">{bot.triggerCondition}</div>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                <span>Action: {bot.actionType}</span>
                <span>Events: {bot.eventsCaptured}</span>
              </div>
            </div>

            {/* Live Log Stream */}
            {bot.logs && bot.logs.length > 0 && (
              <div className="pt-2 border-t border-slate-800 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-500">Recent Stream Logs</div>
                {bot.logs.slice(-2).map((l, lidx) => (
                  <div key={lidx} className="p-1.5 rounded bg-slate-950 font-mono text-[10px] text-slate-300 truncate">
                    <span className="text-slate-500">[{new Date(l.timestamp).toLocaleTimeString()}]</span> {l.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Bot Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Deploy Autonomous Keeper Bot</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white text-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-mono">Bot Name</label>
                <input
                  type="text"
                  value={newBotName}
                  onChange={(e) => setNewBotName(e.target.value)}
                  placeholder="e.g. Yield Compounder Keeper Bot"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-mono">Guardian Subsystem Type</label>
                <select
                  value={newBotType}
                  onChange={(e) => setNewBotType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value="tvl_monitor">TVL Anomaly & Whale Outflow Watcher</option>
                  <option value="circuit_breaker">Emergency Pause Circuit Breaker</option>
                  <option value="health_keeper">State Rebalancing & Epoch Keeper</option>
                  <option value="gas_spike_alert">MEV Frontrunning & Gas Spike Sentinel</option>
                  <option value="event_watcher">Continuous WebSocket Event Ingestor</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? "Deploying..." : "Launch Bot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
