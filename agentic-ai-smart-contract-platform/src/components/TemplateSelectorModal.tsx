"use client";

import React from "react";
import { PRESET_TEMPLATES, PresetTemplate } from "@/lib/preset-templates";
import { 
  Layers, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  ArrowRight, 
  ChevronRight,
  Rocket
} from "lucide-react";

interface TemplateSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: PresetTemplate) => void;
  selectedId: string;
}

export const TemplateSelectorModal: React.FC<TemplateSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  selectedId,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Production Smart Contract Blueprints</h3>
              <p className="text-xs text-slate-400">Select an audited protocol architecture to instantly load or test.</p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm font-bold">
            ✕
          </button>
        </div>

        {/* Template Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PRESET_TEMPLATES.map((tmpl) => {
            const isSelected = tmpl.id === selectedId;
            return (
              <div
                key={tmpl.id}
                onClick={() => {
                  onSelectTemplate(tmpl);
                  onClose();
                }}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  isSelected
                    ? "bg-cyan-950/60 border-cyan-500 ring-2 ring-cyan-500/40 shadow-xl"
                    : "bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800">
                      {tmpl.standard}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400 font-semibold">{tmpl.targetChain}</span>
                  </div>

                  <h4 className="text-sm font-bold text-white">{tmpl.name}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{tmpl.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Audit Score: {tmpl.audit.securityScore}/100</span>
                  </span>

                  <span className="text-cyan-400 flex items-center gap-1">
                    <span>Load</span>
                    <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
