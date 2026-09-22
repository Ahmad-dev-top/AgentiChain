class ChainConfig {
  const ChainConfig({
    required this.name,
    required this.chainId,
    required this.rpcUrl,
    required this.explorerUrl,
    required this.nativeCurrency,
    required this.icon,
  });

  final String name;
  final int chainId;
  final String rpcUrl;
  final String explorerUrl;
  final String nativeCurrency;
  final String icon;
}

const testnetChainNames = {'Base Sepolia', 'Sepolia', 'Arbitrum Sepolia', 'Optimism Sepolia'};

String chainForBroadcast(String? projectChain) {
  if (projectChain != null && testnetChainNames.contains(projectChain)) return projectChain;
  return 'Base Sepolia';
}

const supportedChains = <ChainConfig>[
  ChainConfig(name: 'Base', chainId: 8453, rpcUrl: 'https://mainnet.base.org', explorerUrl: 'https://basescan.org', nativeCurrency: 'ETH', icon: '🔵'),
  ChainConfig(name: 'Base Sepolia', chainId: 84532, rpcUrl: 'https://sepolia.base.org', explorerUrl: 'https://sepolia.basescan.org', nativeCurrency: 'ETH', icon: '🔷'),
  ChainConfig(name: 'Ethereum', chainId: 1, rpcUrl: 'https://cloudflare-eth.com', explorerUrl: 'https://etherscan.io', nativeCurrency: 'ETH', icon: '⟠'),
  ChainConfig(name: 'Sepolia', chainId: 11155111, rpcUrl: 'https://rpc.sepolia.org', explorerUrl: 'https://sepolia.etherscan.io', nativeCurrency: 'SEP', icon: '🧪'),
  ChainConfig(name: 'Arbitrum One', chainId: 42161, rpcUrl: 'https://arb1.arbitrum.io/rpc', explorerUrl: 'https://arbiscan.io', nativeCurrency: 'ETH', icon: '🟦'),
  ChainConfig(name: 'Arbitrum Sepolia', chainId: 421614, rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc', explorerUrl: 'https://sepolia.arbiscan.io', nativeCurrency: 'ETH', icon: '🔹'),
  ChainConfig(name: 'Optimism', chainId: 10, rpcUrl: 'https://mainnet.optimism.io', explorerUrl: 'https://optimistic.etherscan.io', nativeCurrency: 'ETH', icon: '🔴'),
  ChainConfig(name: 'Optimism Sepolia', chainId: 11155420, rpcUrl: 'https://sepolia.optimism.io', explorerUrl: 'https://sepolia-optimism.etherscan.io', nativeCurrency: 'ETH', icon: '🟥'),
  ChainConfig(name: 'Polygon', chainId: 137, rpcUrl: 'https://polygon-rpc.com', explorerUrl: 'https://polygonscan.com', nativeCurrency: 'POL', icon: '💜'),
  ChainConfig(name: 'Avalanche', chainId: 43114, rpcUrl: 'https://api.avax.network/ext/bc/C/rpc', explorerUrl: 'https://snowtrace.io', nativeCurrency: 'AVAX', icon: '🔺'),
  ChainConfig(name: 'BNB Chain', chainId: 56, rpcUrl: 'https://bsc-dataseed.binance.org', explorerUrl: 'https://bscscan.com', nativeCurrency: 'BNB', icon: '🟡'),
];

class WalletSession {
  const WalletSession({
    required this.token,
    required this.address,
    required this.chainId,
    required this.method,
    required this.expiresAt,
    required this.rpc,
    this.note,
  });

  final String token;
  final String address;
  final int chainId;
  final String method;
  final String expiresAt;
  final String rpc;
  final String? note;

  String get shortAddress => address.length < 12 ? address : '${address.substring(0, 6)}…${address.substring(address.length - 4)}';

  factory WalletSession.fromJson(Map<String, dynamic> json) => WalletSession(
        token: _asString(json['token']),
        address: _asString(json['address']),
        chainId: _asInt(json['chainId'], 31337),
        method: _asString(json['method'], 'anvil'),
        expiresAt: _asString(json['expiresAt']),
        rpc: _asString(json['rpc']),
        note: json['note']?.toString(),
      );
}

class TelemetryHost {
  const TelemetryHost({
    required this.hostname,
    required this.system,
    required this.release,
    required this.python,
    required this.pid,
    required this.cpuCount,
    required this.uptimeSeconds,
    this.memoryUsedPercent,
    this.note,
  });

  final String hostname;
  final String system;
  final String release;
  final String python;
  final int pid;
  final int cpuCount;
  final double uptimeSeconds;
  final int? memoryUsedPercent;
  final String? note;

  factory TelemetryHost.fromJson(Map<String, dynamic> json) {
    final memory = _asMap(json['memory']);
    return TelemetryHost(
      hostname: _asString(json['hostname']),
      system: _asString(json['system']),
      release: _asString(json['release']),
      python: _asString(json['python']),
      pid: _asInt(json['pid']),
      cpuCount: _asInt(json['cpuCount'], 1),
      uptimeSeconds: _asDouble(json['uptimeSeconds']),
      memoryUsedPercent: memory['usedPercent'] == null ? null : _asInt(memory['usedPercent']),
      note: json['note']?.toString(),
    );
  }
}

class TelemetryLog {
  const TelemetryLog({
    required this.id,
    required this.correlationId,
    required this.method,
    required this.path,
    required this.statusCode,
    required this.latencyMs,
    required this.createdAt,
  });

  final String id;
  final String correlationId;
  final String method;
  final String path;
  final int statusCode;
  final int latencyMs;
  final String createdAt;

  factory TelemetryLog.fromJson(Map<String, dynamic> json) => TelemetryLog(
        id: _asString(json['id']),
        correlationId: _asString(json['correlationId']),
        method: _asString(json['method']),
        path: _asString(json['path']),
        statusCode: _asInt(json['statusCode']),
        latencyMs: _asInt(json['latencyMs']),
        createdAt: _asString(json['createdAt']),
      );
}

class TelemetrySnapshot {
  const TelemetrySnapshot({
    required this.live,
    required this.engine,
    required this.probes,
    required this.host,
    required this.requestLogs,
    required this.redisStatus,
    this.note,
    this.integrations = const {},
  });

  final bool live;
  final String engine;
  final Map<String, String> probes;
  final TelemetryHost host;
  final List<TelemetryLog> requestLogs;
  final String redisStatus;
  final String? note;
  final Map<String, dynamic> integrations;

  factory TelemetrySnapshot.fromJson(Map<String, dynamic> json) {
    final probesRaw = json['probes'] is Map ? Map<String, dynamic>.from(json['probes'] as Map) : <String, dynamic>{};
    return TelemetrySnapshot(
      live: _asBool(json['live']),
      engine: _asString(json['engine'], 'local_probes'),
      probes: probesRaw.map((key, value) => MapEntry(key, '$value')),
      host: TelemetryHost.fromJson(_asMap(json['host'])),
      requestLogs: _asList(json['requestLogs']).map((item) => TelemetryLog.fromJson(_asMap(item))).toList(),
      redisStatus: _asString(_asMap(json['redis'])['status'], probesRaw['redis']?.toString() ?? 'not_installed'),
      note: json['note']?.toString(),
      integrations: json['integrations'] is Map ? Map<String, dynamic>.from(json['integrations'] as Map) : <String, dynamic>{},
    );
  }
}

class AgentProfile {
  const AgentProfile(this.role, this.avatar, this.badge, this.description);
  final String role;
  final String avatar;
  final String badge;
  final String description;
}

const agentProfiles = <AgentProfile>[
  AgentProfile('Protocol Architect', '🏛️', 'System Architecture', 'Designs modular smart contract blueprints and access-control patterns.'),
  AgentProfile('Lead Solidity Engineer', '⚡', 'Solidity 0.8.24', 'Implements gas-efficient contracts with NatSpec and strict storage layout.'),
  AgentProfile('Security Auditor', '🛡️', 'Static Analysis', 'Runs the live local auditor plus the pattern scanner.'),
  AgentProfile('Foundry Test Engineer', '🧪', 'Forge & Invariant Testing', 'Runs live forge build/test on generated sources.'),
  AgentProfile('Gas Optimizer', '⛽', 'Opcode & Storage Optimization', 'Reports storage packing and custom-error gas savings.'),
  AgentProfile('Multi-Chain Deployer', '🚀', 'EVM Deployer & Verifier', 'Broadcasts to local Anvil 31337 and matches runtime bytecode locally. Public explorers are not submitted.'),
  AgentProfile('Autonomous Keeper Bot', '🤖', 'On-Chain Watcher', 'Watches local Anvil over WebSocket or HTTP poll. Public RPCs and auto-pause are not live.'),
  AgentProfile('Foundry Test Engineer', '🧪', 'Forge & Invariant Testing', 'Runs live forge build/test on generated sources.'),
  AgentProfile('Gas Optimizer', '⛽', 'Opcode & Storage Optimization', 'Reports storage packing and custom-error gas savings.'),
  AgentProfile('Multi-Chain Deployer', '🚀', 'EVM Deployer & Verifier', 'Broadcasts to local Anvil 31337 and matches runtime bytecode locally. Public explorers are not submitted.'),
  AgentProfile('Autonomous Keeper Bot', '🤖', 'On-Chain Watcher', 'Watches local Anvil over WebSocket or HTTP poll. Public RPCs and auto-pause are not live.'),
];

int _asInt(dynamic value, [int fallback = 0]) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse('$value') ?? fallback;
}

double _asDouble(dynamic value, [double fallback = 0]) {
  if (value is num) return value.toDouble();
  return double.tryParse('$value') ?? fallback;
}

bool _asBool(dynamic value, [bool fallback = false]) => value is bool ? value : fallback;

String _asString(dynamic value, [String fallback = '']) => value == null ? fallback : '$value';

List<dynamic> _asList(dynamic value) => value is List ? value : const [];

Map<String, dynamic> _asMap(dynamic value) =>
    value is Map<String, dynamic> ? value : value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

class FeatureFlags {
  const FeatureFlags({
    this.pausable = false,
    this.ownable2Step = true,
    this.accessControl = false,
    this.reentrancyGuard = true,
    this.erc4626VirtualShares = false,
    this.permit2EIP2612 = true,
    this.flashLoanProtection = true,
    this.timelockQueue = false,
    this.oracleIntegration = false,
    this.feeOnTransferSupport = false,
    this.gasOptimizationPass = true,
  });

  final bool pausable;
  final bool ownable2Step;
  final bool accessControl;
  final bool reentrancyGuard;
  final bool erc4626VirtualShares;
  final bool permit2EIP2612;
  final bool flashLoanProtection;
  final bool timelockQueue;
  final bool oracleIntegration;
  final bool feeOnTransferSupport;
  final bool gasOptimizationPass;

  factory FeatureFlags.fromJson(Map<String, dynamic>? json) {
    final map = json ?? const {};
    return FeatureFlags(
      pausable: _asBool(map['pausable']),
      ownable2Step: _asBool(map['ownable2Step'], true),
      accessControl: _asBool(map['accessControl']),
      reentrancyGuard: _asBool(map['reentrancyGuard'], true),
      erc4626VirtualShares: _asBool(map['erc4626VirtualShares']),
      permit2EIP2612: _asBool(map['permit2EIP2612'], true),
      flashLoanProtection: _asBool(map['flashLoanProtection'], true),
      timelockQueue: _asBool(map['timelockQueue']),
      oracleIntegration: _asBool(map['oracleIntegration']),
      feeOnTransferSupport: _asBool(map['feeOnTransferSupport']),
      gasOptimizationPass: _asBool(map['gasOptimizationPass'], true),
    );
  }

  Map<String, bool> get asMap => {
        'pausable': pausable,
        'ownable2Step': ownable2Step,
        'accessControl': accessControl,
        'reentrancyGuard': reentrancyGuard,
        'erc4626VirtualShares': erc4626VirtualShares,
        'permit2EIP2612': permit2EIP2612,
        'flashLoanProtection': flashLoanProtection,
        'timelockQueue': timelockQueue,
        'oracleIntegration': oracleIntegration,
        'feeOnTransferSupport': feeOnTransferSupport,
        'gasOptimizationPass': gasOptimizationPass,
      };
}

class NamedNote {
  const NamedNote({required this.name, required this.description, this.extra = ''});
  final String name;
  final String description;
  final String extra;
}

class ContractSpec {
  const ContractSpec({
    required this.name,
    required this.title,
    required this.description,
    required this.standard,
    required this.targetChain,
    required this.solidityVersion,
    required this.features,
    required this.roles,
    required this.invariants,
    required this.customErrors,
    required this.events,
    required this.functions,
    required this.stateVariables,
  });

  final String name;
  final String title;
  final String description;
  final String standard;
  final String targetChain;
  final String solidityVersion;
  final FeatureFlags features;
  final List<NamedNote> roles;
  final List<NamedNote> invariants;
  final List<NamedNote> customErrors;
  final List<NamedNote> events;
  final List<NamedNote> functions;
  final List<NamedNote> stateVariables;

  factory ContractSpec.fromJson(Map<String, dynamic>? json) {
    final map = json ?? const {};
    return ContractSpec(
      name: _asString(map['name'], 'AgentiContract'),
      title: _asString(map['title'], 'Custom Contract'),
      description: _asString(map['description']),
      standard: _asString(map['standard'], 'CUSTOM'),
      targetChain: _asString(map['targetChain'], 'Base'),
      solidityVersion: _asString(map['solidityVersion'], '0.8.24'),
      features: FeatureFlags.fromJson(_asMap(map['features'])),
      roles: _asList(map['roles'])
          .map((item) => NamedNote(
                name: _asString(_asMap(item)['name']),
                description: _asString(_asMap(item)['description']),
                extra: (_asList(_asMap(item)['allowedFunctions'])).join(', '),
              ))
          .toList(),
      invariants: _asList(map['invariants'])
          .map((item) => NamedNote(
                name: _asString(_asMap(item)['name']),
                description: _asString(_asMap(item)['description']),
                extra: _asString(_asMap(item)['expression']),
              ))
          .toList(),
      customErrors: _asList(map['customErrors'])
          .map((item) => NamedNote(name: _asString(_asMap(item)['name']), description: _asString(_asMap(item)['description'])))
          .toList(),
      events: _asList(map['events'])
          .map((item) => NamedNote(name: _asString(_asMap(item)['name']), description: _asString(_asMap(item)['description'])))
          .toList(),
      functions: _asList(map['functions'])
          .map((item) => NamedNote(
                name: _asString(_asMap(item)['name']),
                description: _asString(_asMap(item)['description']),
                extra: (_asList(_asMap(item)['modifiers'])).join(', '),
              ))
          .toList(),
      stateVariables: _asList(map['stateVariables'])
          .map((item) => NamedNote(
                name: _asString(_asMap(item)['name']),
                description: '${_asString(_asMap(item)['type'])} ${_asString(_asMap(item)['visibility'])}',
                extra: _asString(_asMap(item)['slotPackingNotes']),
              ))
          .toList(),
    );
  }
}

class AgentTraceItem {
  const AgentTraceItem({
    required this.id,
    required this.agentName,
    required this.agentRole,
    required this.action,
    required this.thought,
    required this.status,
    required this.tokensUsed,
    required this.latencyMs,
    required this.createdAt,
  });

  final String id;
  final String agentName;
  final String agentRole;
  final String action;
  final String thought;
  final String status;
  final int tokensUsed;
  final int latencyMs;
  final String createdAt;

  factory AgentTraceItem.fromJson(Map<String, dynamic> json) => AgentTraceItem(
        id: _asString(json['id']),
        agentName: _asString(json['agentName']),
        agentRole: _asString(json['agentRole']),
        action: _asString(json['action']),
        thought: _asString(json['thought']),
        status: _asString(json['status'], 'success'),
        tokensUsed: _asInt(json['tokensUsed']),
        latencyMs: _asInt(json['latencyMs']),
        createdAt: _asString(json['createdAt']),
      );
}

class VulnerabilityItem {
  const VulnerabilityItem({
    required this.id,
    required this.title,
    required this.detectorId,
    required this.severity,
    required this.filePath,
    required this.lineNumbers,
    required this.description,
    required this.impact,
    required this.recommendation,
    required this.status,
    this.cwe,
    this.swcId,
    this.patchDiff,
  });

  final String id;
  final String title;
  final String detectorId;
  final String severity;
  final String filePath;
  final List<int> lineNumbers;
  final String description;
  final String impact;
  final String recommendation;
  final String status;
  final String? cwe;
  final String? swcId;
  final String? patchDiff;

  factory VulnerabilityItem.fromJson(Map<String, dynamic> json) => VulnerabilityItem(
        id: _asString(json['id']),
        title: _asString(json['title']),
        detectorId: _asString(json['detectorId']),
        severity: _asString(json['severity']),
        filePath: _asString(json['filePath']),
        lineNumbers: _asList(json['lineNumbers']).map(_asInt).toList(),
        description: _asString(json['description']),
        impact: _asString(json['impact']),
        recommendation: _asString(json['recommendation']),
        status: _asString(json['status'], 'open'),
        cwe: json['cwe']?.toString(),
        swcId: json['swcId']?.toString(),
        patchDiff: json['patchDiff']?.toString(),
      );
}

class SecurityAuditReport {
  const SecurityAuditReport({
    required this.id,
    required this.projectId,
    required this.totalIssues,
    required this.criticalCount,
    required this.highCount,
    required this.mediumCount,
    required this.lowCount,
    required this.infoCount,
    required this.gasCount,
    required this.securityScore,
    required this.auditReportMd,
    required this.isPatched,
    required this.vulnerabilities,
    required this.createdAt,
    this.live = false,
    this.engine = 'pattern',
    this.slitherVersion,
  });

  final String id;
  final String projectId;
  final int totalIssues;
  final int criticalCount;
  final int highCount;
  final int mediumCount;
  final int lowCount;
  final int infoCount;
  final int gasCount;
  final int securityScore;
  final String auditReportMd;
  final bool isPatched;
  final List<VulnerabilityItem> vulnerabilities;
  final String createdAt;
  final bool live;
  final String engine;
  final String? slitherVersion;

  factory SecurityAuditReport.fromJson(Map<String, dynamic>? json) {
    final map = json ?? const {};
    return SecurityAuditReport(
      id: _asString(map['id']),
      projectId: _asString(map['projectId']),
      totalIssues: _asInt(map['totalIssues']),
      criticalCount: _asInt(map['criticalCount']),
      highCount: _asInt(map['highCount']),
      mediumCount: _asInt(map['mediumCount']),
      lowCount: _asInt(map['lowCount']),
      infoCount: _asInt(map['infoCount']),
      gasCount: _asInt(map['gasCount']),
      securityScore: _asInt(map['securityScore'], 100),
      auditReportMd: _asString(map['auditReportMd']),
      isPatched: _asBool(map['isPatched']),
      vulnerabilities: _asList(map['vulnerabilities']).map((item) => VulnerabilityItem.fromJson(_asMap(item))).toList(),
      createdAt: _asString(map['createdAt']),
      live: _asBool(map['live']),
      engine: _asString(map['engine'], 'pattern'),
      slitherVersion: map['slitherVersion']?.toString(),
    );
  }
}

class ForgeTestResult {
  const ForgeTestResult({
    required this.name,
    required this.suite,
    required this.status,
    required this.durationMs,
    required this.gasUsed,
    this.fuzzRuns,
  });

  final String name;
  final String suite;
  final String status;
  final int durationMs;
  final int gasUsed;
  final int? fuzzRuns;

  factory ForgeTestResult.fromJson(Map<String, dynamic> json) => ForgeTestResult(
        name: _asString(json['name']),
        suite: _asString(json['suite']),
        status: _asString(json['status'], 'PASS'),
        durationMs: _asInt(json['durationMs']),
        gasUsed: _asInt(json['gasUsed']),
        fuzzRuns: json['fuzzRuns'] == null ? null : _asInt(json['fuzzRuns']),
      );
}

class GasBenchmarkItem {
  const GasBenchmarkItem({
    required this.functionName,
    required this.minGas,
    required this.avgGas,
    required this.maxGas,
    required this.callsCount,
    required this.optimizedAvgGas,
    required this.savingsPercentage,
  });

  final String functionName;
  final int minGas;
  final int avgGas;
  final int maxGas;
  final int callsCount;
  final int optimizedAvgGas;
  final double savingsPercentage;

  factory GasBenchmarkItem.fromJson(Map<String, dynamic> json) => GasBenchmarkItem(
        functionName: _asString(json['functionName']),
        minGas: _asInt(json['minGas']),
        avgGas: _asInt(json['avgGas']),
        maxGas: _asInt(json['maxGas']),
        callsCount: _asInt(json['callsCount']),
        optimizedAvgGas: _asInt(json['optimizedAvgGas']),
        savingsPercentage: _asDouble(json['savingsPercentage']),
      );
}

class SimulationResult {
  const SimulationResult({
    required this.id,
    required this.projectId,
    required this.simType,
    required this.networkFork,
    required this.blockNumber,
    required this.totalTests,
    required this.passedTests,
    required this.failedTests,
    required this.durationMs,
    required this.status,
    required this.tests,
    required this.gasBenchmarks,
    required this.traceLogs,
    required this.createdAt,
    this.live = false,
    this.engine = 'fixture',
    this.forgeVersion,
  });

  final String id;
  final String projectId;
  final String simType;
  final String networkFork;
  final int blockNumber;
  final int totalTests;
  final int passedTests;
  final int failedTests;
  final int durationMs;
  final String status;
  final List<ForgeTestResult> tests;
  final List<GasBenchmarkItem> gasBenchmarks;
  final List<String> traceLogs;
  final String createdAt;
  final bool live;
  final String engine;
  final String? forgeVersion;

  factory SimulationResult.fromJson(Map<String, dynamic>? json) {
    final map = json ?? const {};
    return SimulationResult(
      id: _asString(map['id']),
      projectId: _asString(map['projectId']),
      simType: _asString(map['simType'], 'fork_test'),
      networkFork: _asString(map['networkFork'], 'Base Mainnet'),
      blockNumber: _asInt(map['blockNumber']),
      totalTests: _asInt(map['totalTests']),
      passedTests: _asInt(map['passedTests']),
      failedTests: _asInt(map['failedTests']),
      durationMs: _asInt(map['durationMs']),
      status: _asString(map['status'], 'passed'),
      tests: _asList(map['tests']).map((item) => ForgeTestResult.fromJson(_asMap(item))).toList(),
      gasBenchmarks: _asList(map['gasBenchmarks']).map((item) => GasBenchmarkItem.fromJson(_asMap(item))).toList(),
      traceLogs: _asList(map['traceLogs']).map((item) => '$item').toList(),
      createdAt: _asString(map['createdAt']),
      live: _asBool(map['live']),
      engine: _asString(map['engine'], 'fixture'),
      forgeVersion: map['forgeVersion']?.toString(),
    );
  }
}

class DeploymentRecord {
  const DeploymentRecord({
    required this.id,
    required this.projectId,
    required this.contractName,
    required this.network,
    required this.chainId,
    required this.contractAddress,
    required this.deployerAddress,
    required this.transactionHash,
    required this.blockNumber,
    required this.gasUsed,
    required this.verificationStatus,
    required this.explorerUrl,
    required this.createdAt,
    this.simulated = true,
    this.live = false,
    this.engine = 'fixture',
    this.deploymentTarget = 'simulated',
    this.verificationEngine = 'none',
    this.verificationNote,
    this.note,
  });

  final String id;
  final String projectId;
  final String contractName;
  final String network;
  final int chainId;
  final String contractAddress;
  final String deployerAddress;
  final String transactionHash;
  final int blockNumber;
  final String gasUsed;
  final String verificationStatus;
  final String explorerUrl;
  final String createdAt;
  final bool simulated;
  final bool live;
  final String engine;
  final String deploymentTarget;
  final String verificationEngine;
  final String? verificationNote;
  final String? note;

  factory DeploymentRecord.fromJson(Map<String, dynamic>? json) {
    final map = json ?? const {};
    return DeploymentRecord(
      id: _asString(map['id']),
      projectId: _asString(map['projectId']),
      contractName: _asString(map['contractName']),
      network: _asString(map['network']),
      chainId: _asInt(map['chainId']),
      contractAddress: _asString(map['contractAddress']),
      deployerAddress: _asString(map['deployerAddress']),
      transactionHash: _asString(map['transactionHash']),
      blockNumber: _asInt(map['blockNumber']),
      gasUsed: _asString(map['gasUsed']),
      verificationStatus: _asString(map['verificationStatus'], 'pending'),
      explorerUrl: _asString(map['explorerUrl']),
      createdAt: _asString(map['createdAt']),
      simulated: _asBool(map['simulated'], true),
      live: _asBool(map['live']),
      engine: _asString(map['engine'], 'fixture'),
      deploymentTarget: _asString(map['deploymentTarget'], 'simulated'),
      verificationEngine: _asString(map['verificationEngine'], 'none'),
      verificationNote: map['verificationNote']?.toString(),
      note: map['note']?.toString(),
    );
  }
}

class BotLog {
  const BotLog({required this.timestamp, required this.level, required this.message});
  final String timestamp;
  final String level;
  final String message;

  factory BotLog.fromJson(Map<String, dynamic> json) => BotLog(
        timestamp: _asString(json['timestamp']),
        level: _asString(json['level'], 'INFO'),
        message: _asString(json['message']),
      );
}

class MonitoringBotRecord {
  const MonitoringBotRecord({
    required this.id,
    required this.projectId,
    required this.name,
    required this.botType,
    required this.contractAddress,
    required this.network,
    required this.targetEvent,
    required this.triggerCondition,
    required this.actionType,
    required this.status,
    required this.lastCheckedAt,
    required this.eventsCaptured,
    required this.alertsFired,
    required this.logs,
    required this.createdAt,
    this.deploymentId,
    this.live = false,
    this.engine = 'fixture',
    this.transport,
    this.note,
  });

  final String id;
  final String projectId;
  final String? deploymentId;
  final String name;
  final String botType;
  final String contractAddress;
  final String network;
  final String targetEvent;
  final String triggerCondition;
  final String actionType;
  final String status;
  final String lastCheckedAt;
  final int eventsCaptured;
  final int alertsFired;
  final List<BotLog> logs;
  final String createdAt;
  final bool live;
  final String engine;
  final String? transport;
  final String? note;

  MonitoringBotRecord copyWith({int? alertsFired, int? eventsCaptured, List<BotLog>? logs, String? status, bool? live}) => MonitoringBotRecord(
        id: id,
        projectId: projectId,
        deploymentId: deploymentId,
        name: name,
        botType: botType,
        contractAddress: contractAddress,
        network: network,
        targetEvent: targetEvent,
        triggerCondition: triggerCondition,
        actionType: actionType,
        status: status ?? this.status,
        lastCheckedAt: lastCheckedAt,
        eventsCaptured: eventsCaptured ?? this.eventsCaptured,
        alertsFired: alertsFired ?? this.alertsFired,
        logs: logs ?? this.logs,
        createdAt: createdAt,
        live: live ?? this.live,
        engine: engine,
        transport: transport,
        note: note,
      );

  factory MonitoringBotRecord.fromJson(Map<String, dynamic> json) => MonitoringBotRecord(
        id: _asString(json['id']),
        projectId: _asString(json['projectId']),
        deploymentId: json['deploymentId']?.toString(),
        name: _asString(json['name']),
        botType: _asString(json['botType']),
        contractAddress: _asString(json['contractAddress']),
        network: _asString(json['network']),
        targetEvent: _asString(json['targetEvent']),
        triggerCondition: _asString(json['triggerCondition']),
        actionType: _asString(json['actionType']),
        status: _asString(json['status'], 'active'),
        lastCheckedAt: _asString(json['lastCheckedAt']),
        eventsCaptured: _asInt(json['eventsCaptured']),
        alertsFired: _asInt(json['alertsFired']),
        logs: _asList(json['logs']).map((item) => BotLog.fromJson(_asMap(item))).toList(),
        createdAt: _asString(json['createdAt']),
        live: _asBool(json['live']),
        engine: _asString(json['engine'], 'fixture'),
        transport: json['transport']?.toString(),
        note: json['note']?.toString(),
      );
}

class ContractFile {
  const ContractFile({
    required this.id,
    required this.projectId,
    required this.name,
    required this.filePath,
    required this.contractType,
    required this.code,
    required this.version,
  });

  final String id;
  final String projectId;
  final String name;
  final String filePath;
  final String contractType;
  final String code;
  final int version;

  ContractFile copyWith({String? code, int? version}) => ContractFile(
        id: id,
        projectId: projectId,
        name: name,
        filePath: filePath,
        contractType: contractType,
        code: code ?? this.code,
        version: version ?? this.version,
      );

  factory ContractFile.fromJson(Map<String, dynamic> json) => ContractFile(
        id: _asString(json['id']),
        projectId: _asString(json['projectId']),
        name: _asString(json['name']),
        filePath: _asString(json['filePath']),
        contractType: _asString(json['contractType'], 'core'),
        code: _asString(json['code']),
        version: _asInt(json['version'], 1),
      );
}

class ProjectDetail {
  const ProjectDetail({
    required this.id,
    required this.name,
    required this.description,
    required this.contractStandard,
    required this.targetChain,
    required this.solidityVersion,
    required this.status,
    required this.specJson,
    required this.contracts,
    required this.bots,
    required this.traces,
    required this.createdAt,
    required this.updatedAt,
    this.audit,
    this.simulation,
    this.deployment,
    this.simulated = true,
    this.orchestrationEngine = 'linear',
    this.langgraphVersion,
    this.nodePath = const [],
    this.llmPlanner = false,
    this.llmPlannerStatus,
  });

  final String id;
  final String name;
  final String description;
  final String contractStandard;
  final String targetChain;
  final String solidityVersion;
  final String status;
  final ContractSpec specJson;
  final List<ContractFile> contracts;
  final SecurityAuditReport? audit;
  final SimulationResult? simulation;
  final DeploymentRecord? deployment;
  final List<MonitoringBotRecord> bots;
  final List<AgentTraceItem> traces;
  final String createdAt;
  final String updatedAt;
  final bool simulated;
  final String orchestrationEngine;
  final String? langgraphVersion;
  final List<String> nodePath;
  final bool llmPlanner;
  final String? llmPlannerStatus;

  ProjectDetail copyWith({
    String? targetChain,
    String? status,
    List<ContractFile>? contracts,
    SecurityAuditReport? audit,
    SimulationResult? simulation,
    DeploymentRecord? deployment,
    List<MonitoringBotRecord>? bots,
    List<AgentTraceItem>? traces,
  }) =>
      ProjectDetail(
        id: id,
        name: name,
        description: description,
        contractStandard: contractStandard,
        targetChain: targetChain ?? this.targetChain,
        solidityVersion: solidityVersion,
        status: status ?? this.status,
        specJson: specJson,
        contracts: contracts ?? this.contracts,
        audit: audit ?? this.audit,
        simulation: simulation ?? this.simulation,
        deployment: deployment ?? this.deployment,
        bots: bots ?? this.bots,
        traces: traces ?? this.traces,
        createdAt: createdAt,
        updatedAt: updatedAt,
        simulated: simulated,
        orchestrationEngine: orchestrationEngine,
        langgraphVersion: langgraphVersion,
        nodePath: nodePath,
        llmPlanner: llmPlanner,
        llmPlannerStatus: llmPlannerStatus,
      );

  factory ProjectDetail.fromJson(Map<String, dynamic> json) => ProjectDetail(
        id: _asString(json['id']),
        name: _asString(json['name']),
        description: _asString(json['description']),
        contractStandard: _asString(json['contractStandard'], 'CUSTOM'),
        targetChain: _asString(json['targetChain'], 'Base'),
        solidityVersion: _asString(json['solidityVersion'], '0.8.24'),
        status: _asString(json['status'], 'draft'),
        specJson: ContractSpec.fromJson(_asMap(json['specJson'])),
        contracts: _asList(json['contracts']).map((item) => ContractFile.fromJson(_asMap(item))).toList(),
        audit: json['audit'] == null ? null : SecurityAuditReport.fromJson(_asMap(json['audit'])),
        simulation: json['simulation'] == null ? null : SimulationResult.fromJson(_asMap(json['simulation'])),
        deployment: json['deployment'] == null ? null : DeploymentRecord.fromJson(_asMap(json['deployment'])),
        bots: _asList(json['bots']).map((item) => MonitoringBotRecord.fromJson(_asMap(item))).toList(),
        traces: _asList(json['traces']).map((item) => AgentTraceItem.fromJson(_asMap(item))).toList(),
        createdAt: _asString(json['createdAt']),
        updatedAt: _asString(json['updatedAt']),
        simulated: _asBool(json['simulated'], true),
        orchestrationEngine: _asString(json['orchestrationEngine'], 'linear'),
        langgraphVersion: json['langgraphVersion']?.toString(),
        nodePath: _asList(json['nodePath']).map((item) => item.toString()).toList(),
        llmPlanner: _asBool(json['llmPlanner']),
        llmPlannerStatus: json['llmPlannerStatus']?.toString(),
      );
}

class QuickPrompt {
  const QuickPrompt({required this.title, required this.prompt, required this.chain, required this.standard});
  final String title;
  final String prompt;
  final String chain;
  final String standard;
}

const quickPrompts = <QuickPrompt>[
  QuickPrompt(
    title: 'ERC4626 Yield Vault with Fee',
    prompt:
        'Create a production-grade ERC4626 Tokenized Yield Vault on Base with a 2% performance fee, virtual shares offset against inflation attacks, emergency pause circuit breaker, and 3-day timelock admin rules.',
    chain: 'Base',
    standard: 'ERC4626',
  ),
  QuickPrompt(
    title: 'Liquid Restaking Token (LRT)',
    prompt:
        'Architect a Liquid Restaking Token (rsETH) protocol on Ethereum Mainnet with dynamic epoch compounding, multi-operator delegation, and slashing insurance buffer.',
    chain: 'Ethereum',
    standard: 'RESTAKING',
  ),
  QuickPrompt(
    title: 'Decentralized Governor DAO',
    prompt:
        'Deploy a Decentralized Governor DAO on Arbitrum One with TimelockController, ERC20Votes token, 4% quorum requirement, 1-week voting period, and emergency veto authority.',
    chain: 'Arbitrum One',
    standard: 'GOVERNOR',
  ),
  QuickPrompt(
    title: 'Flash Loan Arbitrage Receiver',
    prompt:
        'Build an Aave V3 Flash Loan Arbitrage receiver contract on Base with Uniswap V3 swap routing, strict minimum profit assertion, and reentrancy protection.',
    chain: 'Base',
    standard: 'CUSTOM',
  ),
  QuickPrompt(
    title: 'Multi-Sig Escrow with Dispute Arbiter',
    prompt:
        'Design a non-custodial 2-of-3 multi-signature escrow protocol with milestone releases, 14-day timeout challenge period, and designated third-party arbitration.',
    chain: 'Polygon',
    standard: 'ESCROW',
  ),
];
