"use client";

import React, { useState } from "react";
import { ContractSpec } from "@/lib/types";
import { 
  FileCheck2, 
  Shield, 
  Key, 
  AlertOctagon, 
  ListTree, 
  Sliders, 
  Code2, 
  Layers, 
  CheckCircle2, 
  Cpu,
  Copy,
  Check
} from "lucide-react";

interface SpecificationViewerProps {
  spec: ContractSpec;
  onUpdateSpec?: (spec: ContractSpec) => void;
}

export const SpecificationViewer: React.FC<SpecificationViewerProps> = ({ spec }) => {
  const [viewRawJson, setViewRawJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Specification Header */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300">
              Phase 2: Intent Parser & Formal Specification Engine
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              Standard: {spec.standard}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>{spec.title || spec.name}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">{spec.description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setViewRawJson(!viewRawJson)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            <Code2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>{viewRawJson ? "Visual Spec View" : "Raw JSON Schema"}</span>
          </button>

          <button
            onClick={handleCopyJson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? "Copied" : "Copy JSON"}</span>
          </button>
        </div>
      </div>

      {viewRawJson ? (
        <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 shadow-xl">
          <div className="text-xs font-mono text-slate-400 mb-2 pb-2 border-b border-slate-800 flex items-center justify-between">
            <span>contract_specification.json</span>
            <span className="text-emerald-400">● JSON Schema Validated (RFC-8259)</span>
          </div>
          <pre className="p-3 rounded-xl bg-slate-900 font-mono text-xs text-cyan-300 overflow-x-auto max-h-[600px]">
            {JSON.stringify(spec, null, 2)}
          </pre>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Feature Matrix & Storage Slots */}
          <div className="space-y-6">
            {/* Feature Flags */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-xl">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800 mb-3">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  OpenZeppelin & Security Primitives
                </h3>
              </div>

              <div className="space-y-2">
                {Object.entries(spec.features).map(([key, enabled]) => (
                  <div
                    key={key}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs font-mono transition-colors ${
                      enabled
                        ? "bg-slate-950/80 border border-slate-800/90 text-slate-200"
                        : "bg-slate-950/30 text-slate-500"
                    }`}
                  >
                    <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        enabled
                          ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                          : "bg-slate-900 text-slate-600"
                      }`}
                    >
                      {enabled ? "ACTIVE" : "OFF"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* State Storage Layout */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-xl">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800 mb-3">
                <Layers className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Optimized Storage Layout
                </h3>
              </div>

              <div className="space-y-2">
                {spec.stateVariables.map((v, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-cyan-300 font-bold">{v.name}</span>
                      <span className="font-mono text-[10px] text-purple-400 px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-900">
                        {v.type}
                      </span>
                    </div>
                    {v.slotPackingNotes && (
                      <div className="text-[10px] text-slate-400 mt-1 font-mono">
                        ⚙️ {v.slotPackingNotes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: Role Permissions & Invariants */}
          <div className="space-y-6">
            {/* Roles Matrix */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-xl">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800 mb-3">
                <Key className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Role-Based Access Control (RBAC)
                </h3>
              </div>

              <div className="space-y-3">
                {spec.roles.map((r, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-amber-300">{r.name}</span>
                      <span className="text-[10px] font-mono text-slate-500 truncate max-w-[100px]">{r.identifier}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{r.description}</p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {r.allowedFunctions.map((fn, fidx) => (
                        <span key={fidx} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                          {fn}()
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Formal Invariants */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-xl">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800 mb-3">
                <Shield className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Formal Mathematical Invariants
                </h3>
              </div>

              <div className="space-y-3">
                {spec.invariants.map((inv, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400">{inv.id}: {inv.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                        {inv.verificationLevel} Target
                      </span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 font-mono text-[11px] text-slate-200 border border-slate-800">
                      {inv.expression}
                    </div>
                    <p className="text-[10px] text-slate-400">{inv.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column 3: Custom Errors & Key Protocol Functions */}
          <div className="space-y-6">
            {/* Custom Errors */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-xl">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800 mb-3">
                <AlertOctagon className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Gas-Optimized Custom Errors
                </h3>
              </div>

              <div className="space-y-2">
                {spec.customErrors.map((err, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 text-xs">
                    <div className="font-mono text-rose-400 font-semibold">
                      error {err.name}({err.params.map(p => `${p.type} ${p.name}`).join(", ")});
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{err.description}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Protocol Functions */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-xl">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800 mb-3">
                <ListTree className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Target Function Interface
                </h3>
              </div>

              <div className="space-y-2.5">
                {spec.functions.map((fn, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-cyan-300">{fn.name}()</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">{fn.visibility}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">{fn.mutability}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{fn.description}</p>
                    {fn.modifiers.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap text-[10px] text-slate-500 font-mono">
                        <span>Modifiers:</span>
                        {fn.modifiers.map((m, midx) => (
                          <span key={midx} className="px-1 rounded bg-slate-900 text-slate-300">{m}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
