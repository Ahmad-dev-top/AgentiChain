"use client";

import React, { useState } from "react";
import { SecurityAuditReport, VulnerabilityItem } from "@/lib/types";
import { 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  Info, 
  Zap, 
  Wrench, 
  CheckCircle2, 
  FileCode, 
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Layers,
  ArrowRight
} from "lucide-react";

interface SecurityAuditWorkspaceProps {
  audit?: SecurityAuditReport;
  onAutoPatch: () => Promise<void>;
  isPatching: boolean;
}

export const SecurityAuditWorkspace: React.FC<SecurityAuditWorkspaceProps> = ({
  audit,
  onAutoPatch,
  isPatching,
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [expandedVuln, setExpandedVuln] = useState<string | null>(null);

  if (!audit) {
    return (
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-8 text-center space-y-3">
        <ShieldCheck className="w-10 h-10 text-slate-600 mx-auto" />
        <h3 className="text-base font-bold text-slate-300">No Security Audit Data Available</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Run the multi-agent code generation or trigger Slither static analysis from the code workspace.
        </p>
      </div>
    );
  }

  const score = audit.securityScore;
  const vulns = audit.vulnerabilities || [];
  const filteredVulns =
    selectedSeverity === "all" ? vulns : vulns.filter((v) => v.severity.toLowerCase() === selectedSeverity.toLowerCase());

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "Critical":
        return "bg-rose-950/80 text-rose-300 border-rose-800";
      case "High":
        return "bg-amber-950/80 text-amber-300 border-amber-800";
      case "Medium":
        return "bg-yellow-950/80 text-yellow-300 border-yellow-800";
      case "Low":
        return "bg-blue-950/80 text-blue-300 border-blue-800";
      case "Gas":
        return "bg-purple-950/80 text-purple-300 border-purple-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const getScoreColor = (s: number) => {
    if (s >= 90) return "text-emerald-400 border-emerald-500 bg-emerald-950/40";
    if (s >= 75) return "text-yellow-400 border-yellow-500 bg-yellow-950/40";
    return "text-rose-400 border-rose-500 bg-rose-950/40";
  };

  return (
    <div className="space-y-6">
      {/* Audit Score Header Card */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Score Ring */}
            <div
              className={`w-20 h-20 rounded-2xl border-2 flex flex-col items-center justify-center p-2 shadow-lg ${getScoreColor(
                score
              )}`}
            >
              <span className="text-2xl font-black">{score}</span>
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase">
                {score >= 90 ? "Grade A+" : score >= 75 ? "Grade B" : "Grade C"}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300">
                  Slither & SMT Formal Static Analyzer
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Status: {audit.isPatched ? "✅ Formally Patched" : "⚠️ Review Required"}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white">Autonomous Security & Vulnerability Matrix</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluated against 30+ SWC Registry attack vectors, OpenZeppelin v5 invariants, and OWASP Web3 Top 10.
              </p>
            </div>
          </div>

          {/* 1-Click Auto-Patch Reflection Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onAutoPatch}
              disabled={isPatching || audit.isPatched}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg ${
                audit.isPatched
                  ? "bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700"
                  : isPatching
                  ? "bg-cyan-900 text-cyan-200 cursor-wait"
                  : "bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white shadow-emerald-500/20 active:scale-95"
              }`}
            >
              {isPatching ? (
                <>
                  <Wrench className="w-4 h-4 animate-spin text-cyan-300" />
                  <span>Patching & Re-Auditing...</span>
                </>
              ) : audit.isPatched ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>100% Security Verified</span>
                </>
              ) : (
                <>
                  <Wrench className="w-4 h-4 text-white" />
                  <span>Execute 1-Click Auto-Patch Loop</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Metric Counts */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-4 pt-4 border-t border-slate-800 text-xs font-mono">
          <button
            onClick={() => setSelectedSeverity("all")}
            className={`p-2 rounded-xl text-center border transition-colors ${
              selectedSeverity === "all" ? "bg-slate-800 border-slate-600 text-white" : "bg-slate-950 border-slate-800 text-slate-400"
            }`}
          >
            <div className="text-[10px] text-slate-500">TOTAL</div>
            <div className="font-bold text-sm text-slate-200">{audit.totalIssues}</div>
          </button>

          <button
            onClick={() => setSelectedSeverity("critical")}
            className={`p-2 rounded-xl text-center border transition-colors ${
              selectedSeverity === "critical" ? "bg-rose-950/80 border-rose-800 text-rose-300" : "bg-slate-950 border-slate-800 text-slate-400"
            }`}
          >
            <div className="text-[10px] text-rose-400">CRITICAL</div>
            <div className="font-bold text-sm text-rose-300">{audit.criticalCount}</div>
          </button>

          <button
            onClick={() => setSelectedSeverity("high")}
            className={`p-2 rounded-xl text-center border transition-colors ${
              selectedSeverity === "high" ? "bg-amber-950/80 border-amber-800 text-amber-300" : "bg-slate-950 border-slate-800 text-slate-400"
            }`}
          >
            <div className="text-[10px] text-amber-400">HIGH</div>
            <div className="font-bold text-sm text-amber-300">{audit.highCount}</div>
          </button>

          <button
            onClick={() => setSelectedSeverity("medium")}
            className={`p-2 rounded-xl text-center border transition-colors ${
              selectedSeverity === "medium" ? "bg-yellow-950/80 border-yellow-800 text-yellow-300" : "bg-slate-950 border-slate-800 text-slate-400"
            }`}
          >
            <div className="text-[10px] text-yellow-400">MEDIUM</div>
            <div className="font-bold text-sm text-yellow-300">{audit.mediumCount}</div>
          </button>

          <button
            onClick={() => setSelectedSeverity("low")}
            className={`p-2 rounded-xl text-center border transition-colors ${
              selectedSeverity === "low" ? "bg-blue-950/80 border-blue-800 text-blue-300" : "bg-slate-950 border-slate-800 text-slate-400"
            }`}
          >
            <div className="text-[10px] text-blue-400">LOW</div>
            <div className="font-bold text-sm text-blue-300">{audit.lowCount}</div>
          </button>

          <button
            onClick={() => setSelectedSeverity("gas")}
            className={`p-2 rounded-xl text-center border transition-colors ${
              selectedSeverity === "gas" ? "bg-purple-950/80 border-purple-800 text-purple-300" : "bg-slate-950 border-slate-800 text-slate-400"
            }`}
          >
            <div className="text-[10px] text-purple-400">GAS</div>
            <div className="font-bold text-sm text-purple-300">{audit.gasCount}</div>
          </button>
        </div>
      </div>

      {/* Vulnerabilities List */}
      <div className="space-y-3">
        {filteredVulns.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-bold text-slate-200">Zero Issues in this Category</h4>
            <p className="text-xs text-slate-400">The smart contract is protected against all screened exploit vectors.</p>
          </div>
        ) : (
          filteredVulns.map((vuln) => {
            const isExpanded = expandedVuln === vuln.id;
            return (
              <div
                key={vuln.id}
                className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden transition-all hover:border-slate-700 shadow-md"
              >
                <div
                  onClick={() => setExpandedVuln(isExpanded ? null : vuln.id)}
                  className="p-4 flex items-center justify-between cursor-pointer bg-slate-900/40 hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase border ${getSeverityBadge(
                        vuln.severity
                      )}`}
                    >
                      {vuln.severity}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-100">{vuln.title}</h4>
                        <span className="text-[10px] font-mono text-cyan-400 px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-900">
                          {vuln.detectorId}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{vuln.filePath}</span>
                        {vuln.lineNumbers && vuln.lineNumbers.length > 0 && (
                          <span>• Line {vuln.lineNumbers.join(", ")}</span>
                        )}
                        {vuln.cwe && <span>• {vuln.cwe}</span>}
                        {vuln.swcId && <span>• {vuln.swcId}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        vuln.status === "patched"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : "bg-rose-950 text-rose-300 border border-rose-800"
                      }`}
                    >
                      {vuln.status === "patched" ? "PATCHED" : "OPEN"}
                    </span>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 border-t border-slate-800 bg-slate-950/80 space-y-3 text-xs">
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Vulnerability Explanation & Attack Vector
                      </div>
                      <p className="text-slate-300 leading-relaxed font-mono text-xs">{vuln.description}</p>
                    </div>

                    <div>
                      <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider mb-1">
                        Impact
                      </div>
                      <p className="text-slate-400 font-mono text-xs">{vuln.impact}</p>
                    </div>

                    <div>
                      <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-1">
                        Security Recommendation
                      </div>
                      <p className="text-slate-300 font-mono text-xs">{vuln.recommendation}</p>
                    </div>

                    {vuln.patchDiff && (
                      <div>
                        <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                          Unified Patch Diff (Git Unified Patch Format)
                        </div>
                        <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                          {vuln.patchDiff}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
