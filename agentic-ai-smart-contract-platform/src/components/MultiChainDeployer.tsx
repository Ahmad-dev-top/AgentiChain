"use client";

import React, { useState } from "react";
import { DeploymentRecord, SupportedChain } from "@/lib/types";
import { SUPPORTED_CHAINS } from "@/lib/constants";
import { 
  Rocket, 
  CheckCircle2, 
  ExternalLink, 
  Copy, 
  Check, 
  ShieldCheck, 
  Layers, 
  FileCode2, 
  Globe, 
  Zap,
  Flame,
  ArrowRight
} from "lucide-react";

interface MultiChainDeployerProps {
  deployment?: DeploymentRecord;
  contractName: string;
  selectedChain: SupportedChain;
  onDeploy: (network: SupportedChain) => Promise<void>;
  isDeploying: boolean;
  solidityCode?: string;
}

export const MultiChainDeployer: React.FC<MultiChainDeployerProps> = ({
  deployment,
  contractName,
  selectedChain,
  onDeploy,
  isDeploying,
  solidityCode,
}) => {
  const [targetNetwork, setTargetNetwork] = useState<SupportedChain>(selectedChain || "Base");
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedTx, setCopiedTx] = useState(false);
  const [showJsonPayload, setShowJsonPayload] = useState(false);

  const chainConfig = SUPPORTED_CHAINS[targetNetwork] || SUPPORTED_CHAINS["Base"];

  const handleCopy = (text: string, type: "addr" | "tx") => {
    navigator.clipboard.writeText(text);
    if (type === "addr") {
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 2000);
    } else {
      setCopiedTx(true);
      setTimeout(() => setCopiedTx(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300">
                Phase 7: Multi-Chain Deployment & Block Explorer Verification
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">Multi-Chain Deployment Engine</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Broadcast verified smart contracts across Layer-1 and Layer-2 EVMs with automated bytecode verification.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onDeploy(targetNetwork)}
              disabled={isDeploying}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50"
            >
              <Rocket className={`w-4 h-4 ${isDeploying ? "animate-bounce" : ""}`} />
              <span>{isDeploying ? `Broadcasting to ${targetNetwork}...` : `Deploy to ${targetNetwork}`}</span>
            </button>
          </div>
        </div>

        {/* Chain Target Selector */}
        <div className="mt-4 pt-4 border-t border-slate-800">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Target EVM Destination
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {Object.values(SUPPORTED_CHAINS).map((chain) => (
              <button
                key={chain.name}
                type="button"
                onClick={() => setTargetNetwork(chain.name)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  targetNetwork === chain.name
                    ? "bg-cyan-950/80 border-cyan-500 text-cyan-300 ring-2 ring-cyan-500/30"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{chain.icon}</span>
                  <span className="text-[10px] font-mono text-slate-500">ID:{chain.chainId}</span>
                </div>
                <div className="text-xs font-bold mt-1 truncate">{chain.name}</div>
                <div className="text-[10px] text-slate-500">{chain.nativeCurrency} Native</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Deployment Result Card */}
      {deployment ? (
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Live On-Chain Deployment Verified</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-mono font-bold">
              ● {deployment.verificationStatus.toUpperCase()} ON {deployment.network.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-slate-500 text-[10px]">CONTRACT ADDRESS</div>
              <div className="flex items-center justify-between">
                <span className="text-cyan-300 font-bold break-all">{deployment.contractAddress}</span>
                <button
                  onClick={() => handleCopy(deployment.contractAddress, "addr")}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  {copiedAddr ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-slate-500 text-[10px]">TRANSACTION HASH</div>
              <div className="flex items-center justify-between">
                <span className="text-purple-300 font-bold truncate max-w-[240px]">{deployment.transactionHash}</span>
                <button
                  onClick={() => handleCopy(deployment.transactionHash, "tx")}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  {copiedTx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-slate-500 text-[10px]">BLOCK NUMBER & GAS USED</div>
              <div className="text-slate-200">
                Block #{deployment.blockNumber.toLocaleString()} • {deployment.gasUsed}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-slate-500 text-[10px]">EXPLORER VERIFICATION</div>
              <div>
                <a
                  href={deployment.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-cyan-400 hover:underline font-bold"
                >
                  <span>View Verified Source Code</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
            <button
              onClick={() => setShowJsonPayload(!showJsonPayload)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 transition-colors"
            >
              <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>{showJsonPayload ? "Hide Compiler Input JSON" : "Standard-JSON Verification Payload"}</span>
            </button>
          </div>

          {showJsonPayload && (
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 font-mono text-xs text-cyan-300 max-h-60 overflow-x-auto">
              <pre>
                {JSON.stringify(
                  {
                    language: "Solidity",
                    sources: {
                      [`src/${contractName}.sol`]: {
                        content: solidityCode || "// Verified Solidity Source Code",
                      },
                    },
                    settings: {
                      optimizer: { enabled: true, runs: 200 },
                      evmVersion: "cancun",
                      metadata: { bytecodeHash: "ipfs" },
                    },
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900/40 border border-slate-800 p-8 text-center space-y-3">
          <Rocket className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">Ready for Deployment</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Click "Deploy to {targetNetwork}" to simulate transaction broadcast, record block metrics, and generate verified explorer artifacts.
          </p>
        </div>
      )}
    </div>
  );
};
