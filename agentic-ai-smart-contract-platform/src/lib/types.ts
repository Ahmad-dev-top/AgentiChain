export type ContractStandard =
  | "ERC20"
  | "ERC721"
  | "ERC1155"
  | "ERC4626"
  | "STAKING"
  | "GOVERNOR"
  | "ESCROW"
  | "AMM"
  | "LENDING"
  | "RESTAKING"
  | "ACCOUNT_ABSTRACTION"
  | "CUSTOM";

export type SupportedChain =
  | "Base"
  | "Base Sepolia"
  | "Ethereum"
  | "Sepolia"
  | "Arbitrum One"
  | "Arbitrum Sepolia"
  | "Optimism"
  | "Polygon"
  | "Avalanche"
  | "BNB Chain";

export interface ChainConfig {
  name: SupportedChain;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: string;
  icon: string;
}

export interface RoleSpec {
  name: string;
  identifier: string;
  description: string;
  adminRole?: string;
  allowedFunctions: string[];
}

export interface InvariantSpec {
  id: string;
  name: string;
  expression: string;
  description: string;
  verificationLevel: "SMT" | "Foundry" | "Certora";
}

export interface FunctionSpec {
  name: string;
  visibility: "public" | "external" | "internal" | "private";
  mutability: "nonpayable" | "payable" | "view" | "pure";
  params: { name: string; type: string; description?: string }[];
  returns: { name?: string; type: string }[];
  modifiers: string[];
  description: string;
  emitsEvents: string[];
  revertsWithErrors: string[];
}

export interface EventSpec {
  name: string;
  params: { name: string; type: string; indexed: boolean }[];
  description: string;
}

export interface ErrorSpec {
  name: string;
  params: { name: string; type: string }[];
  description: string;
}

export interface ContractSpec {
  name: string;
  title: string;
  description: string;
  standard: ContractStandard;
  targetChain: SupportedChain;
  solidityVersion: string;
  features: {
    pausable: boolean;
    ownable2Step: boolean;
    accessControl: boolean;
    reentrancyGuard: boolean;
    erc4626VirtualShares: boolean;
    permit2EIP2612: boolean;
    flashLoanProtection: boolean;
    timelockQueue: boolean;
    oracleIntegration: boolean;
    feeOnTransferSupport: boolean;
    gasOptimizationPass: boolean;
  };
  roles: RoleSpec[];
  invariants: InvariantSpec[];
  customErrors: ErrorSpec[];
  events: EventSpec[];
  functions: FunctionSpec[];
  stateVariables: {
    name: string;
    type: string;
    visibility: string;
    isImmutable?: boolean;
    isConstant?: boolean;
    slotPackingNotes?: string;
  }[];
}

export type AgentRoleType =
  | "Protocol Architect"
  | "Lead Solidity Engineer"
  | "Security Auditor"
  | "Foundry Test Engineer"
  | "Gas Optimizer"
  | "Formal Verifier"
  | "Multi-Chain Deployer"
  | "Autonomous Keeper Bot";

export interface AgentTraceItem {
  id: string;
  agentName: AgentRoleType;
  agentRole: string;
  action: string;
  thought: string;
  inputPayload?: any;
  outputPayload?: any;
  status: "success" | "warning" | "error" | "in_progress";
  tokensUsed: number;
  latencyMs: number;
  createdAt: string;
}

export interface VulnerabilityItem {
  id: string;
  title: string;
  detectorId: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "Informational" | "Gas";
  cwe?: string;
  swcId?: string;
  filePath: string;
  lineNumbers: number[];
  description: string;
  impact: string;
  recommendation: string;
  patchDiff?: string;
  status: "open" | "patched" | "suppressed";
}

export interface SecurityAuditReport {
  id: string;
  projectId: string;
  contractId?: string;
  totalIssues: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  gasCount: number;
  securityScore: number;
  auditReportMd: string;
  isPatched: boolean;
  vulnerabilities: VulnerabilityItem[];
  createdAt: string;
}

export interface CallTraceFrame {
  id: string;
  contract: string;
  method: string;
  args: string[];
  returnValue?: string;
  gasUsed: number;
  status: "success" | "revert";
  depth: number;
  children?: CallTraceFrame[];
}

export interface ForgeTestResult {
  name: string;
  suite: string;
  status: "PASS" | "FAIL";
  durationMs: number;
  gasUsed: number;
  fuzzRuns?: number;
  trace?: CallTraceFrame[];
  errorMessage?: string;
}

export interface GasBenchmarkItem {
  functionName: string;
  minGas: number;
  avgGas: number;
  maxGas: number;
  callsCount: number;
  optimizedAvgGas: number;
  savingsPercentage: number;
}

export interface SimulationResult {
  id: string;
  projectId: string;
  simType: "anvil_local" | "fork_test" | "fuzz_test" | "gas_benchmark";
  networkFork: string;
  blockNumber: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  durationMs: number;
  status: "passed" | "failed" | "running";
  tests: ForgeTestResult[];
  gasBenchmarks: GasBenchmarkItem[];
  traceLogs: string[];
  createdAt: string;
}

export interface DeploymentRecord {
  id: string;
  projectId: string;
  contractName: string;
  network: SupportedChain;
  chainId: number;
  contractAddress: string;
  deployerAddress: string;
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
  verificationStatus: "verified" | "pending" | "failed";
  explorerUrl: string;
  constructorArgs?: any;
  createdAt: string;
}

export interface MonitoringBotRecord {
  id: string;
  projectId: string;
  deploymentId?: string;
  name: string;
  botType: "event_watcher" | "tvl_monitor" | "gas_spike_alert" | "health_keeper" | "circuit_breaker";
  contractAddress: string;
  network: string;
  targetEvent: string;
  triggerCondition: string;
  actionType: "send_alert" | "execute_pause" | "rebalance" | "trigger_keeper";
  status: "active" | "paused" | "triggered" | "error";
  lastCheckedAt: string;
  eventsCaptured: number;
  alertsFired: number;
  logs: { timestamp: string; level: string; message: string; payload?: any }[];
  createdAt: string;
}

export interface ContractFile {
  id: string;
  projectId: string;
  name: string;
  filePath: string;
  contractType: "core" | "interface" | "test" | "script" | "library";
  code: string;
  version: number;
  abi?: any[];
  bytecode?: string;
  astJson?: any;
}

export interface ProjectDetail {
  id: string;
  name: string;
  description: string;
  contractStandard: ContractStandard;
  targetChain: SupportedChain;
  solidityVersion: string;
  status: string;
  specJson: ContractSpec;
  contracts: ContractFile[];
  audit?: SecurityAuditReport;
  simulation?: SimulationResult;
  deployment?: DeploymentRecord;
  bots: MonitoringBotRecord[];
  traces: AgentTraceItem[];
  createdAt: string;
  updatedAt: string;
}
