from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

ContractStandard = Literal[
    "ERC20",
    "ERC721",
    "ERC1155",
    "ERC4626",
    "STAKING",
    "GOVERNOR",
    "ESCROW",
    "AMM",
    "LENDING",
    "RESTAKING",
    "ACCOUNT_ABSTRACTION",
    "CUSTOM",
]

SupportedChain = Literal[
    "Base",
    "Base Sepolia",
    "Ethereum",
    "Sepolia",
    "Arbitrum One",
    "Arbitrum Sepolia",
    "Optimism",
    "Polygon",
    "Avalanche",
    "BNB Chain",
]

AgentRoleType = Literal[
    "Protocol Architect",
    "Lead Solidity Engineer",
    "Security Auditor",
    "Foundry Test Engineer",
    "Gas Optimizer",
    "Formal Verifier",
    "Multi-Chain Deployer",
    "Autonomous Keeper Bot",
]


class ChainConfig(BaseModel):
    name: SupportedChain
    chainId: int
    rpcUrl: str
    explorerUrl: str
    nativeCurrency: str
    icon: str


class RoleSpec(BaseModel):
    name: str
    identifier: str
    description: str
    adminRole: Optional[str] = None
    allowedFunctions: list[str] = Field(default_factory=list)


class InvariantSpec(BaseModel):
    id: str
    name: str
    expression: str
    description: str
    verificationLevel: Literal["SMT", "Foundry", "Certora"] = "Foundry"


class FunctionParam(BaseModel):
    name: str
    type: str
    description: Optional[str] = None


class FunctionReturn(BaseModel):
    name: Optional[str] = None
    type: str


class FunctionSpec(BaseModel):
    name: str
    visibility: Literal["public", "external", "internal", "private"] = "external"
    mutability: Literal["nonpayable", "payable", "view", "pure"] = "nonpayable"
    params: list[FunctionParam] = Field(default_factory=list)
    returns: list[FunctionReturn] = Field(default_factory=list)
    modifiers: list[str] = Field(default_factory=list)
    description: str = ""
    emitsEvents: list[str] = Field(default_factory=list)
    revertsWithErrors: list[str] = Field(default_factory=list)


class EventParam(BaseModel):
    name: str
    type: str
    indexed: bool = False


class EventSpec(BaseModel):
    name: str
    params: list[EventParam] = Field(default_factory=list)
    description: str = ""


class ErrorParam(BaseModel):
    name: str
    type: str


class ErrorSpec(BaseModel):
    name: str
    params: list[ErrorParam] = Field(default_factory=list)
    description: str = ""


class FeatureFlags(BaseModel):
    pausable: bool = False
    ownable2Step: bool = True
    accessControl: bool = False
    reentrancyGuard: bool = True
    erc4626VirtualShares: bool = False
    permit2EIP2612: bool = True
    flashLoanProtection: bool = True
    timelockQueue: bool = False
    oracleIntegration: bool = False
    feeOnTransferSupport: bool = False
    gasOptimizationPass: bool = True


class StateVariable(BaseModel):
    name: str
    type: str
    visibility: str = "public"
    isImmutable: Optional[bool] = None
    isConstant: Optional[bool] = None
    slotPackingNotes: Optional[str] = None


class ContractSpec(BaseModel):
    name: str
    title: str
    description: str
    standard: ContractStandard
    targetChain: SupportedChain
    solidityVersion: str = "0.8.24"
    features: FeatureFlags
    roles: list[RoleSpec] = Field(default_factory=list)
    invariants: list[InvariantSpec] = Field(default_factory=list)
    customErrors: list[ErrorSpec] = Field(default_factory=list)
    events: list[EventSpec] = Field(default_factory=list)
    functions: list[FunctionSpec] = Field(default_factory=list)
    stateVariables: list[StateVariable] = Field(default_factory=list)


class AgentTraceItem(BaseModel):
    id: str
    agentName: AgentRoleType
    agentRole: str
    action: str
    thought: str
    inputPayload: Optional[Any] = None
    outputPayload: Optional[Any] = None
    status: Literal["success", "warning", "error", "in_progress"] = "success"
    tokensUsed: int = 0
    latencyMs: int = 0
    createdAt: str


class VulnerabilityItem(BaseModel):
    id: str
    title: str
    detectorId: str
    severity: Literal["Critical", "High", "Medium", "Low", "Informational", "Gas"]
    cwe: Optional[str] = None
    swcId: Optional[str] = None
    filePath: str
    lineNumbers: list[int] = Field(default_factory=list)
    description: str
    impact: str
    recommendation: str
    patchDiff: Optional[str] = None
    status: Literal["open", "patched", "suppressed"] = "open"


class SecurityAuditReport(BaseModel):
    id: str
    projectId: str
    contractId: Optional[str] = None
    totalIssues: int = 0
    criticalCount: int = 0
    highCount: int = 0
    mediumCount: int = 0
    lowCount: int = 0
    infoCount: int = 0
    gasCount: int = 0
    securityScore: int = 100
    auditReportMd: str = ""
    isPatched: bool = False
    vulnerabilities: list[VulnerabilityItem] = Field(default_factory=list)
    createdAt: str


class CallTraceFrame(BaseModel):
    id: str
    contract: str
    method: str
    args: list[str] = Field(default_factory=list)
    returnValue: Optional[str] = None
    gasUsed: int = 0
    status: Literal["success", "revert"] = "success"
    depth: int = 1
    children: Optional[list["CallTraceFrame"]] = None


class ForgeTestResult(BaseModel):
    name: str
    suite: str
    status: Literal["PASS", "FAIL"] = "PASS"
    durationMs: int = 0
    gasUsed: int = 0
    fuzzRuns: Optional[int] = None
    trace: Optional[list[CallTraceFrame]] = None
    errorMessage: Optional[str] = None


class GasBenchmarkItem(BaseModel):
    functionName: str
    minGas: int
    avgGas: int
    maxGas: int
    callsCount: int
    optimizedAvgGas: int
    savingsPercentage: float


class SimulationResult(BaseModel):
    id: str
    projectId: str
    simType: Literal["anvil_local", "fork_test", "fuzz_test", "gas_benchmark"] = "fork_test"
    networkFork: str = "Base Mainnet"
    blockNumber: int = 18500200
    totalTests: int = 0
    passedTests: int = 0
    failedTests: int = 0
    durationMs: int = 0
    status: Literal["passed", "failed", "running"] = "passed"
    tests: list[ForgeTestResult] = Field(default_factory=list)
    gasBenchmarks: list[GasBenchmarkItem] = Field(default_factory=list)
    traceLogs: list[str] = Field(default_factory=list)
    createdAt: str
    live: bool = False
    engine: str = "fixture"
    forgeVersion: Optional[str] = None


class DeploymentRecord(BaseModel):
    id: str
    projectId: str
    contractName: str
    network: SupportedChain
    chainId: int
    contractAddress: str
    deployerAddress: str
    transactionHash: str
    blockNumber: int
    gasUsed: str
    verificationStatus: Literal["verified", "pending", "failed"] = "pending"
    explorerUrl: str
    constructorArgs: Optional[Any] = None
    createdAt: str
    simulated: bool = True


class BotLog(BaseModel):
    timestamp: str
    level: str
    message: str
    payload: Optional[Any] = None


class MonitoringBotRecord(BaseModel):
    id: str
    projectId: str
    deploymentId: Optional[str] = None
    name: str
    botType: Literal["event_watcher", "tvl_monitor", "gas_spike_alert", "health_keeper", "circuit_breaker"]
    contractAddress: str
    network: str
    targetEvent: str
    triggerCondition: str
    actionType: Literal["send_alert", "execute_pause", "rebalance", "trigger_keeper"] = "send_alert"
    status: Literal["active", "paused", "triggered", "error"] = "active"
    lastCheckedAt: str
    eventsCaptured: int = 0
    alertsFired: int = 0
    logs: list[BotLog] = Field(default_factory=list)
    createdAt: str


class ContractFile(BaseModel):
    id: str
    projectId: str
    name: str
    filePath: str
    contractType: Literal["core", "interface", "test", "script", "library"] = "core"
    code: str
    version: int = 1
    abi: Optional[list[Any]] = None
    bytecode: Optional[str] = None
    astJson: Optional[Any] = None


class ProjectDetail(BaseModel):
    id: str
    name: str
    description: str
    contractStandard: ContractStandard
    targetChain: SupportedChain
    solidityVersion: str = "0.8.24"
    status: str = "draft"
    specJson: ContractSpec
    contracts: list[ContractFile] = Field(default_factory=list)
    audit: Optional[SecurityAuditReport] = None
    simulation: Optional[SimulationResult] = None
    deployment: Optional[DeploymentRecord] = None
    bots: list[MonitoringBotRecord] = Field(default_factory=list)
    traces: list[AgentTraceItem] = Field(default_factory=list)
    createdAt: str
    updatedAt: str
    simulated: bool = True


class ParseIntentRequest(BaseModel):
    prompt: str
    targetChain: SupportedChain = "Base"
    contractName: Optional[str] = None


class AgentPipelineRequest(BaseModel):
    prompt: str
    targetChain: SupportedChain = "Base"
    contractName: Optional[str] = None
    projectId: Optional[str] = None


class AuditRequest(BaseModel):
    code: str
    filePath: str = "src/Contract.sol"
    autoPatch: bool = False
    projectId: Optional[str] = None


class SimulateRequest(BaseModel):
    contractName: str = "AgentiContract"
    networkFork: str = "Base Mainnet"
    projectId: str = "proj-temp"


class DeployRequest(BaseModel):
    projectId: str
    contractName: str
    network: SupportedChain
    constructorArgs: Optional[Any] = None
    code: Optional[str] = None


class CreateBotRequest(BaseModel):
    projectId: str
    contractAddress: str
    botType: Literal["event_watcher", "tvl_monitor", "gas_spike_alert", "health_keeper", "circuit_breaker"]
    network: str = "Base"
    deploymentId: Optional[str] = "dep-01"
    name: Optional[str] = None
