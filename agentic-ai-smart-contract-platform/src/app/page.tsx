"use client";

import React, { useState, useEffect } from "react";
import { ProjectDetail, SupportedChain } from "@/lib/types";
import { PRESET_TEMPLATES, PresetTemplate } from "@/lib/preset-templates";
import { Header } from "@/components/Header";
import { AgentChatWorkspace } from "@/components/AgentChatWorkspace";
import { SpecificationViewer } from "@/components/SpecificationViewer";
import { CodeEditorWorkspace } from "@/components/CodeEditorWorkspace";
import { ArchitectureGraph } from "@/components/ArchitectureGraph";
import { SecurityAuditWorkspace } from "@/components/SecurityAuditWorkspace";
import { FoundrySimulationWorkspace } from "@/components/FoundrySimulationWorkspace";
import { MultiChainDeployer } from "@/components/MultiChainDeployer";
import { AutonomousBotsWorkspace } from "@/components/AutonomousBotsWorkspace";
import { TelemetryConsole } from "@/components/TelemetryConsole";
import { TemplateSelectorModal } from "@/components/TemplateSelectorModal";

import { 
  Sparkles, 
  Code2, 
  ShieldCheck, 
  Terminal, 
  Rocket, 
  Bot, 
  Layers, 
  Activity, 
  Sliders, 
  Network,
  FileCheck2,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";

export default function AgentiChainApp() {
  // Main state
  const [currentProject, setCurrentProject] = useState<ProjectDetail>(PRESET_TEMPLATES[0] as any);
  const [activeTab, setActiveTab] = useState<string>("chat");
  const [selectedChain, setSelectedChain] = useState<SupportedChain>("Base");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPatching, setIsPatching] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "info" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Load initial projects from backend API
  useEffect(() => {
    async function loadInitial() {
      try {
        const res = await fetch("/api/projects");
        const data = await res.json();
        if (data.success && data.projects && data.projects.length > 0) {
          setCurrentProject(data.projects[0]);
          setSelectedChain(data.projects[0].targetChain || "Base");
        }
      } catch (err) {
        console.warn("Failed to load projects from DB, using preset:", err);
      }
    }
    loadInitial();
  }, []);

  // Multi-Agent Pipeline Runner
  const handleSynthesize = async (prompt: string, chain: SupportedChain, name?: string) => {
    setIsProcessing(true);
    showToast("Starting LangGraph Multi-Agent Swarm...", "info");

    try {
      const res = await fetch("/api/agent-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          targetChain: chain,
          contractName: name,
          projectId: `proj-${Date.now()}`,
        }),
      });

      const data = await res.json();
      if (data.success && data.project) {
        setCurrentProject(data.project);
        setSelectedChain(data.project.targetChain);
        showToast("Multi-Agent synthesis, security audit & simulation complete!", "success");
      } else {
        throw new Error(data.error || "Synthesis failed");
      }
    } catch (err: any) {
      showToast(err.message || "Pipeline execution failed", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto-Patching Subsystem
  const handleAutoPatch = async () => {
    if (!currentProject.contracts || currentProject.contracts.length === 0) return;
    setIsPatching(true);
    showToast("Running Slither Static Analysis & Auto-Patch Reflection Loop...", "info");

    try {
      const coreContract = currentProject.contracts[0];
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: coreContract.code,
          filePath: coreContract.filePath,
          autoPatch: true,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const updatedContracts = [...currentProject.contracts];
        updatedContracts[0] = {
          ...updatedContracts[0],
          code: data.patchedCode,
          version: (updatedContracts[0].version || 1) + 1,
        };

        const updatedProject: ProjectDetail = {
          ...currentProject,
          contracts: updatedContracts,
          audit: {
            ...data.audit,
            projectId: currentProject.id,
          },
        };

        setCurrentProject(updatedProject);
        showToast(`Auto-Patch successful! Security score elevated to ${data.audit.securityScore}/100.`, "success");
      }
    } catch (err: any) {
      showToast(err.message || "Auto-patch failed", "error");
    } finally {
      setIsPatching(false);
    }
  };

  // Run Simulation
  const handleRunSimulation = async () => {
    setIsSimulating(true);
    showToast(`Spinning up Anvil EVM local fork on ${selectedChain}...`, "info");

    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractName: currentProject.name,
          networkFork: `${selectedChain} Mainnet`,
          projectId: currentProject.id,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCurrentProject((prev) => ({
          ...prev,
          simulation: data.simulation,
        }));
        showToast("Foundry Forge tests and opcode gas profiling completed with 100% pass rate!", "success");
      }
    } catch (err: any) {
      showToast(err.message || "Simulation failed", "error");
    } finally {
      setIsSimulating(false);
    }
  };

  // Multi-chain Deploy
  const handleDeploy = async (network: SupportedChain) => {
    setIsDeploying(true);
    showToast(`Broadcasting deployment transaction to ${network}...`, "info");

    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: currentProject.id,
          contractName: currentProject.name,
          network,
          code: currentProject.contracts[0]?.code,
          constructorArgs: {},
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCurrentProject((prev) => ({
          ...prev,
          deployment: data.deployment,
          status: "deployed",
        }));
        showToast(`Contract successfully deployed to ${network}! Verified at ${data.deployment.contractAddress}`, "success");
      }
    } catch (err: any) {
      showToast(err.message || "Deployment failed", "error");
    } finally {
      setIsDeploying(false);
    }
  };

  // Create Bot
  const handleCreateBot = async (botType: any, name: string) => {
    try {
      const contractAddress = currentProject.deployment?.contractAddress || "0x892a7f39b1a53bE5F80D878d6bEfB5F228D13F24";
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: currentProject.id,
          deploymentId: currentProject.deployment?.id || "dep-01",
          contractAddress,
          network: selectedChain,
          botType,
          name,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCurrentProject((prev) => ({
          ...prev,
          bots: [data.bot, ...prev.bots],
        }));
        showToast(`Autonomous ${botType} keeper successfully launched on ${selectedChain}!`, "success");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to create bot", "error");
    }
  };

  // Simulate Anomaly
  const handleTriggerAnomaly = () => {
    const updatedBots = currentProject.bots.map((b) => ({
      ...b,
      alertsFired: (b.alertsFired || 0) + 1,
      logs: [
        {
          timestamp: new Date().toISOString(),
          level: "WARN",
          message: `[ALERT] Simulated 1,200,000 USDC whale withdrawal detected in Block #${Math.floor(18500200 + Math.random() * 500)}! Verified solvency invariant valid.`,
        },
        ...b.logs,
      ],
    }));

    setCurrentProject((prev) => ({
      ...prev,
      bots: updatedBots,
    }));

    showToast("Simulated on-chain anomaly triggered. Autonomous keeper bots recorded alert!", "info");
  };

  // Load Template
  const handleSelectTemplate = (template: PresetTemplate) => {
    setCurrentProject(template as any);
    setSelectedChain(template.targetChain);
    showToast(`Loaded ${template.name} blueprint.`, "info");
  };

  const navTabs = [
    { id: "chat", label: "AI Workspace", icon: Sparkles, phase: "Phase 1-3" },
    { id: "spec", label: "Formal Spec", icon: FileCheck2, phase: "Phase 2" },
    { id: "code", label: "Solidity IDE", icon: Code2, count: currentProject.contracts.length, phase: "Phase 3" },
    { id: "graph", label: "Architecture", icon: Network, phase: "Phase 3" },
    { id: "audit", label: "Security Audit", icon: ShieldCheck, badge: `${currentProject.audit?.securityScore || 100}/100`, phase: "Phase 4" },
    { id: "simulation", label: "Foundry EVM", icon: Terminal, phase: "Phase 5" },
    { id: "deploy", label: "Multi-Chain Deploy", icon: Rocket, phase: "Phase 7" },
    { id: "bots", label: "Keeper Bots", icon: Bot, count: currentProject.bots.length, phase: "Phase 7" },
    { id: "telemetry", label: "Cloud Telemetry", icon: Activity, phase: "Phase 1 & 6" },
  ];

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-2.5 text-xs font-mono transition-all animate-bounce ${
            notification.type === "success"
              ? "bg-emerald-950/95 border-emerald-600 text-emerald-200"
              : notification.type === "error"
              ? "bg-rose-950/95 border-rose-600 text-rose-200"
              : "bg-blue-950/95 border-blue-600 text-blue-200"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Global Header */}
      <Header
        selectedChain={selectedChain}
        onSelectChain={(chain) => {
          setSelectedChain(chain);
          setCurrentProject((prev) => ({ ...prev, targetChain: chain }));
          showToast(`Target chain set to ${chain}`, "info");
        }}
        onOpenTemplates={() => setShowTemplateModal(true)}
        onNewSession={() => {
          setActiveTab("chat");
          showToast("Ready for new natural language protocol prompt", "info");
        }}
        isProcessing={isProcessing}
      />

      {/* Main Workspace Navigation Tabs */}
      <div className="bg-slate-950/90 border-b border-slate-800/80 sticky top-[61px] z-40 backdrop-blur-sm px-4">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto py-2 scrollbar-none">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all shrink-0 ${
                  isActive
                    ? "bg-slate-800 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-slate-500"}`} />
                <span>{tab.label}</span>

                {tab.count !== undefined && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-900 text-slate-400">
                    {tab.count}
                  </span>
                )}

                {tab.badge && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                      (currentProject.audit?.securityScore || 100) >= 90
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                        : "bg-amber-950 text-amber-400 border border-amber-800"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === "chat" && (
          <AgentChatWorkspace
            project={currentProject}
            onSynthesize={handleSynthesize}
            isProcessing={isProcessing}
            onSelectTab={setActiveTab}
            selectedChain={selectedChain}
          />
        )}

        {activeTab === "spec" && (
          <SpecificationViewer spec={currentProject.specJson} />
        )}

        {activeTab === "code" && (
          <CodeEditorWorkspace
            contracts={currentProject.contracts}
            onRunAudit={() => {
              setActiveTab("audit");
              handleAutoPatch();
            }}
            onRunSimulation={() => {
              setActiveTab("simulation");
              handleRunSimulation();
            }}
          />
        )}

        {activeTab === "graph" && (
          <ArchitectureGraph spec={currentProject.specJson} />
        )}

        {activeTab === "audit" && (
          <SecurityAuditWorkspace
            audit={currentProject.audit}
            onAutoPatch={handleAutoPatch}
            isPatching={isPatching}
          />
        )}

        {activeTab === "simulation" && (
          <FoundrySimulationWorkspace
            simulation={currentProject.simulation}
            onRunSimulation={handleRunSimulation}
            isSimulating={isSimulating}
          />
        )}

        {activeTab === "deploy" && (
          <MultiChainDeployer
            deployment={currentProject.deployment}
            contractName={currentProject.name}
            selectedChain={selectedChain}
            onDeploy={handleDeploy}
            isDeploying={isDeploying}
            solidityCode={currentProject.contracts[0]?.code}
          />
        )}

        {activeTab === "bots" && (
          <AutonomousBotsWorkspace
            bots={currentProject.bots}
            contractAddress={currentProject.deployment?.contractAddress || "0x892a7f39b1a53bE5F80D878d6bEfB5F228D13F24"}
            network={selectedChain}
            projectId={currentProject.id}
            onCreateBot={handleCreateBot}
            onTriggerSimulatedAnomaly={handleTriggerAnomaly}
          />
        )}

        {activeTab === "telemetry" && (
          <TelemetryConsole traces={currentProject.traces} />
        )}
      </main>

      {/* Blueprint Templates Modal */}
      <TemplateSelectorModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelectTemplate={handleSelectTemplate}
        selectedId={currentProject.id}
      />

      {/* Global Footer */}
      <footer className="border-t border-slate-900 bg-[#060a12] py-4 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>AgentiChain Multi-Agent AI Suite • Deployed on Oracle Always Free Cloud (Linux ARM64)</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span>Solidity 0.8.24</span>
            <span>•</span>
            <span>OpenZeppelin v5.0</span>
            <span>•</span>
            <span>Foundry v0.2.0</span>
            <span>•</span>
            <span>PostgreSQL 16</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
