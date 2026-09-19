import 'package:flutter/foundation.dart';

import 'api.dart';
import 'models.dart';

enum WorkspaceTab { chat, spec, code, graph, audit, simulation, deploy, bots, telemetry }

class CommandCenterState extends ChangeNotifier {
  CommandCenterState({AgentiApi? api}) : _api = api ?? AgentiApi();

  final AgentiApi _api;
  final List<ProjectDetail> projects = [];

  ProjectDetail? current;
  WorkspaceTab tab = WorkspaceTab.chat;
  String selectedChain = 'Base';
  bool apiOnline = false;
  bool loading = false;
  bool processing = false;
  bool patching = false;
  bool simulating = false;
  bool deploying = false;
  String? notice;
  String noticeKind = 'info';

  String get apiBase => _api.baseUrl;

  Future<void> bootstrap() async {
    loading = true;
    notifyListeners();
    apiOnline = await _api.health();
    try {
      if (apiOnline) {
        final loaded = await _api.listProjects();
        projects
          ..clear()
          ..addAll(loaded);
        current = loaded.isNotEmpty ? loaded.first : _offlinePlaceholder();
        selectedChain = current?.targetChain ?? 'Base';
      } else {
        current = _offlinePlaceholder();
        projects
          ..clear()
          ..add(current!);
      }
    } catch (error) {
      apiOnline = false;
      current = _offlinePlaceholder();
      projects
        ..clear()
        ..add(current!);
      _toast('API unavailable, using local placeholder: $error', 'error');
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  void selectTab(WorkspaceTab value) {
    tab = value;
    notifyListeners();
  }

  void selectChain(String chain) {
    selectedChain = chain;
    if (current != null) {
      current = current!.copyWith(targetChain: chain);
    }
    _toast('Target chain set to $chain', 'info');
    notifyListeners();
  }

  void selectProject(ProjectDetail project) {
    current = project;
    selectedChain = project.targetChain;
    _toast('Loaded ${project.name}', 'info');
    notifyListeners();
  }

  Future<void> synthesize(String prompt, {String? contractName}) async {
    if (prompt.trim().isEmpty || processing) return;
    processing = true;
    _toast('Starting multi-agent pipeline...', 'info');
    notifyListeners();
    try {
      if (!apiOnline) {
        throw ApiException('FastAPI is offline. Start the backend on $_api.baseUrl');
      }
      final project = await _api.runPipeline(
        prompt: prompt,
        targetChain: selectedChain,
        contractName: contractName,
      );
      current = project;
      projects.removeWhere((item) => item.id == project.id);
      projects.insert(0, project);
      _toast('Synthesis, audit fixtures, and simulation fixtures complete.', 'success');
    } catch (error) {
      _toast('$error', 'error');
    } finally {
      processing = false;
      notifyListeners();
    }
  }

  Future<void> autoPatch() async {
    final project = current;
    if (project == null || project.contracts.isEmpty) return;
    patching = true;
    _toast('Running pattern-based audit and auto-patch...', 'info');
    notifyListeners();
    try {
      final result = await _api.audit(code: project.contracts.first.code, filePath: project.contracts.first.filePath, autoPatch: true);
      final patchedCode = result['patchedCode'] as String? ?? project.contracts.first.code;
      final audit = SecurityAuditReport.fromJson(Map<String, dynamic>.from(result['audit'] as Map));
      final updated = [...project.contracts];
      updated[0] = updated[0].copyWith(code: patchedCode, version: updated[0].version + 1);
      current = project.copyWith(contracts: updated, audit: audit);
      _toast('Auto-patch complete. Score ${audit.securityScore}/100.', 'success');
    } catch (error) {
      _toast('$error', 'error');
    } finally {
      patching = false;
      notifyListeners();
    }
  }

  Future<void> runSimulation() async {
    final project = current;
    if (project == null) return;
    simulating = true;
    _toast('Requesting Foundry fixture simulation on $selectedChain...', 'info');
    notifyListeners();
    try {
      final simulation = await _api.simulate(
        contractName: project.name,
        networkFork: '$selectedChain Mainnet',
        projectId: project.id,
      );
      current = project.copyWith(simulation: simulation);
      _toast(simulation.live ? 'Live forge suite finished (${simulation.passedTests} passed).' : 'Foundry result recorded.', 'success');
    } catch (error) {
      _toast('$error', 'error');
    } finally {
      simulating = false;
      notifyListeners();
    }
  }

  Future<void> deploy(String network) async {
    final project = current;
    if (project == null) return;
    deploying = true;
    _toast('Creating demonstration deployment record for $network...', 'info');
    notifyListeners();
    try {
      final deployment = await _api.deploy(
        projectId: project.id,
        contractName: project.name,
        network: network,
        code: project.contracts.isNotEmpty ? project.contracts.first.code : null,
      );
      current = project.copyWith(deployment: deployment, status: 'deployed');
      _toast('Demonstration address recorded. No transaction was broadcast.', 'success');
    } catch (error) {
      _toast('$error', 'error');
    } finally {
      deploying = false;
      notifyListeners();
    }
  }

  Future<void> createBot(String botType, String name) async {
    final project = current;
    if (project == null) return;
    try {
      final address = project.deployment?.contractAddress ?? '0x892a7f39b1a53bE5F80D878d6bEfB5F228D13F24';
      final bot = await _api.createBot(
        projectId: project.id,
        contractAddress: address,
        network: selectedChain,
        botType: botType,
        name: name,
        deploymentId: project.deployment?.id,
      );
      current = project.copyWith(bots: [bot, ...project.bots]);
      _toast('Keeper configuration saved. It is not a live WebSocket process.', 'success');
      notifyListeners();
    } catch (error) {
      _toast('$error', 'error');
      notifyListeners();
    }
  }

  void triggerAnomaly() {
    final project = current;
    if (project == null) return;
    final updated = project.bots
        .map(
          (bot) => bot.copyWith(
            alertsFired: bot.alertsFired + 1,
            logs: [
              BotLog(
                timestamp: DateTime.now().toIso8601String(),
                level: 'WARN',
                message: 'Simulated whale withdrawal recorded. Solvency invariant still marked valid.',
              ),
              ...bot.logs,
            ],
          ),
        )
        .toList();
    current = project.copyWith(bots: updated);
    _toast('Simulated on-chain anomaly recorded locally.', 'info');
    notifyListeners();
  }

  void _toast(String message, String kind) {
    notice = message;
    noticeKind = kind;
  }

  void clearNotice() {
    notice = null;
    notifyListeners();
  }

  ProjectDetail _offlinePlaceholder() {
    const spec = ContractSpec(
      name: 'AgentiVault4626',
      title: 'ERC4626 Tokenized Yield Vault',
      description: 'Offline placeholder. Start FastAPI to load seeded projects and run the pipeline.',
      standard: 'ERC4626',
      targetChain: 'Base',
      solidityVersion: '0.8.24',
      features: FeatureFlags(pausable: true, accessControl: true, erc4626VirtualShares: true, timelockQueue: true, oracleIntegration: true),
      roles: [
        NamedNote(name: 'DEFAULT_ADMIN_ROLE', description: 'Super-admin role', extra: 'grantRole, revokeRole'),
        NamedNote(name: 'PAUSER_ROLE', description: 'Emergency pause operator', extra: 'pause, unpause'),
      ],
      invariants: [
        NamedNote(name: 'Conservation of Assets', description: 'Vault accounting stays solvent', extra: 'totalAssets() >= reserves'),
      ],
      customErrors: [NamedNote(name: 'ZeroAmount', description: 'Reverts when amount is zero')],
      events: [NamedNote(name: 'YieldHarvested', description: 'Emitted after harvest')],
      functions: [NamedNote(name: 'deposit', description: 'ERC-4626 deposit entrypoint', extra: 'nonReentrant, whenNotPaused')],
      stateVariables: [NamedNote(name: 'performanceFeeBps', description: 'uint16 public', extra: 'Packed into Slot 0')],
    );
    return ProjectDetail(
      id: 'offline-placeholder',
      name: 'AgentiVault4626',
      description: spec.description,
      contractStandard: 'ERC4626',
      targetChain: 'Base',
      solidityVersion: '0.8.24',
      status: 'offline',
      specJson: spec,
      contracts: const [
        ContractFile(
          id: 'offline-core',
          projectId: 'offline-placeholder',
          name: 'AgentiVault4626.sol',
          filePath: 'src/AgentiVault4626.sol',
          contractType: 'core',
          version: 1,
          code: '// Start the FastAPI backend to generate Solidity from natural language.\npragma solidity 0.8.24;\n\ncontract AgentiVault4626 {}\n',
        ),
      ],
      bots: const [],
      traces: const [],
      createdAt: DateTime.now().toIso8601String(),
      updatedAt: DateTime.now().toIso8601String(),
    );
  }
}
