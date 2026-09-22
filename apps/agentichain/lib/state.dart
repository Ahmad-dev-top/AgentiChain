import 'dart:async';

import 'package:flutter/foundation.dart';

import 'api.dart';
import 'browser_wallet.dart';
import 'models.dart';

enum WorkspaceTab { chat, spec, code, graph, audit, simulation, deploy, bots, telemetry }

class CommandCenterState extends ChangeNotifier {
  CommandCenterState({AgentiApi? api}) : _api = api ?? AgentiApi();

  final AgentiApi _api;
  final List<ProjectDetail> projects = [];

  ProjectDetail? current;
  WorkspaceTab tab = WorkspaceTab.chat;
  String selectedChain = 'Base Sepolia';
  bool apiOnline = false;
  bool loading = false;
  bool processing = false;
  bool patching = false;
  bool simulating = false;
  bool deploying = false;
  bool verifying = false;
  bool connectingWallet = false;
  WalletSession? wallet;
  TelemetrySnapshot? telemetry;
  Map<String, dynamic> integrations = {};
  Timer? _botPoll;
  String? notice;
  String noticeKind = 'info';

  bool get publicBroadcastReady {
    final item = integrations['publicChain'];
    return item is Map && item['status'] == 'ready';
  }

  String? get publicDeployerAddress {
    final item = integrations['publicChain'];
    if (item is! Map) return null;
    final value = item['deployerAddress']?.toString() ?? '';
    return value.startsWith('0x') ? value : null;
  }

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
        selectedChain = chainForBroadcast(current?.targetChain);
        await refreshIntegrations();
        _startBotPoll();
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

  Future<void> connectAnvilWallet() async {
    connectingWallet = true;
    _toast('Signing a local Anvil login challenge. The private key stays on Anvil.', 'info');
    notifyListeners();
    try {
      wallet = await _api.signInAnvil();
      _toast('Signed in as ${wallet!.shortAddress} on chainId ${wallet!.chainId}. Not a public-chain login.', 'success');
    } catch (error) {
      _toast('$error', 'error');
    } finally {
      connectingWallet = false;
      notifyListeners();
    }
  }

  Future<void> connectBrowserWallet() async {
    if (!kIsWeb) {
      _toast('Browser wallet sign-in runs in the Chrome app.', 'error');
      notifyListeners();
      return;
    }
    connectingWallet = true;
    _toast('Approve the connection and signature in your browser wallet. The key stays in the wallet.', 'info');
    notifyListeners();
    try {
      final account = await BrowserWallet.connect();
      final challenge = await _api.walletChallenge(address: account.address, chainId: account.chainId);
      final signature = await BrowserWallet.sign(account.address, challenge['message'].toString());
      wallet = await _api.walletVerify(
        address: account.address,
        nonce: challenge['nonce'].toString(),
        signature: signature,
      );
      _toast(
        'Signed in as ${wallet!.shortAddress} on chain ${wallet!.chainId}. Public broadcast still uses the server deployer.',
        'success',
      );
    } catch (error) {
      _toast('$error', 'error');
    } finally {
      connectingWallet = false;
      notifyListeners();
    }
  }

  Future<void> disconnectWallet() async {
    await _api.logout();
    wallet = null;
    _toast('Wallet session ended.', 'info');
    notifyListeners();
  }

  void selectTab(WorkspaceTab value) {
    tab = value;
    if (value == WorkspaceTab.bots) {
      refreshBots();
    }
    if (value == WorkspaceTab.telemetry) {
      refreshTelemetry();
    }
    if (value == WorkspaceTab.deploy) {
      refreshIntegrations();
    }
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
    selectedChain = chainForBroadcast(project.targetChain);
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
        throw ApiException('Backend is offline. Start the server, then retry.');
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
      _toast('Running security audit and auto-patch...', 'info');
    notifyListeners();
    try {
      final result = await _api.audit(
        code: project.contracts.first.code,
        filePath: project.contracts.first.filePath,
        autoPatch: true,
        projectId: project.id,
      );
      final patchedCode = result['patchedCode'] as String? ?? project.contracts.first.code;
      final audit = SecurityAuditReport.fromJson(Map<String, dynamic>.from(result['audit'] as Map));
      final updated = [...project.contracts];
      updated[0] = updated[0].copyWith(code: patchedCode, version: updated[0].version + 1);
      current = project.copyWith(contracts: updated, audit: audit);
      _toast(
        audit.live ? 'Audit complete. Score ${audit.securityScore}/100.' : 'Audit complete. Score ${audit.securityScore}/100.',
        'success',
      );
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

  Future<void> deploy(String network, {bool broadcastPublic = false}) async {
    final project = current;
    if (project == null) return;
    if (wallet == null) {
      _toast('Sign in with local Anvil before deploying. The signer key stays on the server.', 'error');
      notifyListeners();
      return;
    }
    deploying = true;
    _toast(
      broadcastPublic ? 'Broadcasting $network from the server RPC. This is a real public transaction.' : 'Broadcasting to local Anvil 31337...',
      'info',
    );
    notifyListeners();
    try {
      final deployment = await _api.deploy(
        projectId: project.id,
        contractName: project.name,
        network: network,
        code: project.contracts.isNotEmpty ? project.contracts.first.code : null,
        broadcastPublic: broadcastPublic,
      );
      current = project.copyWith(deployment: deployment, status: 'deployed');
      final public = deployment.chainId != 31337;
      _toast(
        deployment.live
            ? public
                ? 'Deployed on ${deployment.network} (chainId ${deployment.chainId}). Verification: ${deployment.verificationStatus}.'
                : 'Deployed on local Anvil (chainId ${deployment.chainId}). Verification: ${deployment.verificationStatus}.'
            : 'Deployment record saved without a live broadcast.',
        'success',
      );
    } catch (error) {
      _toast('$error', 'error');
    } finally {
      deploying = false;
      notifyListeners();
    }
  }

  Future<void> verify() async {
    final project = current;
    if (project == null || project.deployment == null) return;
    if (wallet == null) {
      _toast('Sign in with local Anvil before verifying.', 'error');
      notifyListeners();
      return;
    }
    verifying = true;
    final public = project.deployment!.chainId != 31337;
    _toast(
      public ? 'Matching runtime bytecode on ${project.deployment!.network}.' : 'Matching runtime bytecode on local Anvil.',
      'info',
    );
    notifyListeners();
    try {
      final deployment = await _api.verify(projectId: project.id, contractName: project.deployment?.contractName);
      current = project.copyWith(deployment: deployment);
      final livePublic = deployment.chainId != 31337;
      _toast(
        deployment.verificationStatus == 'verified'
            ? livePublic
                ? 'Bytecode matched on ${deployment.network}.'
                : 'Local bytecode matched on Anvil.'
            : livePublic
                ? 'Bytecode did not match on ${deployment.network}.'
                : 'Local bytecode did not match.',
        deployment.verificationStatus == 'verified' ? 'success' : 'error',
      );
    } catch (error) {
      _toast('$error', 'error');
    } finally {
      verifying = false;
      notifyListeners();
    }
  }

  Future<void> createBot(String botType, String name) async {
    final project = current;
    if (project == null) return;
    if (wallet == null) {
      _toast('Sign in with local Anvil before attaching a keeper.', 'error');
      notifyListeners();
      return;
    }
    if (project.deployment == null) {
      _toast('Deploy to local Anvil before attaching a keeper.', 'error');
      notifyListeners();
      return;
    }
    if (project.deployment!.chainId != 31337) {
      _toast('Keepers watch local Anvil only. This deployment is on ${project.deployment!.network}.', 'error');
      notifyListeners();
      return;
    }
    try {
      final bot = await _api.createBot(
        projectId: project.id,
        contractAddress: project.deployment!.contractAddress,
        network: selectedChain,
        botType: botType,
        name: name,
        deploymentId: project.deployment?.id,
      );
      current = project.copyWith(bots: [bot, ...project.bots]);
      _toast(bot.live ? 'Keeper attached to local Anvil (${bot.transport ?? bot.engine}).' : 'Keeper configuration saved.', 'success');
      notifyListeners();
    } catch (error) {
      _toast('$error', 'error');
      notifyListeners();
    }
  }

  void _startBotPoll() {
    _botPoll ??= Timer.periodic(const Duration(seconds: 2), (_) {
      if (tab == WorkspaceTab.bots) {
        refreshBots();
      }
      if (tab == WorkspaceTab.telemetry) {
        refreshTelemetry();
      }
    });
  }

  Future<void> refreshIntegrations() async {
    if (!apiOnline) return;
    try {
      integrations = await _api.integrations();
      notifyListeners();
    } catch (_) {}
  }

  Future<void> refreshTelemetry() async {
    if (!apiOnline) return;
    try {
      telemetry = await _api.telemetry();
      notifyListeners();
    } catch (_) {}
  }

  Future<void> refreshBots() async {
    final project = current;
    if (project == null || !apiOnline) return;
    try {
      final bots = await _api.listBots(projectId: project.id);
      if (current?.id != project.id) return;
      current = project.copyWith(bots: bots);
      notifyListeners();
    } catch (_) {}
  }

  Future<void> probeKeepers() async {
    final project = current;
    if (project == null) return;
    if (wallet == null) {
      _toast('Sign in with local Anvil before probing keepers.', 'error');
      notifyListeners();
      return;
    }
    if (project.deployment == null) {
      _toast('Deploy to local Anvil before probing keepers.', 'error');
      notifyListeners();
      return;
    }
    try {
      final bots = await _api.probeBots(projectId: project.id);
      current = project.copyWith(bots: bots);
      _toast('Local Anvil pause/unpause probe sent. Public chains were not contacted.', 'success');
      notifyListeners();
    } catch (error) {
      _toast('$error', 'error');
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _botPoll?.cancel();
    super.dispose();
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
      description: 'Offline placeholder. Start the backend to load seeded projects and run the pipeline.',
      standard: 'ERC4626',
      targetChain: 'Base Sepolia',
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
      targetChain: 'Base Sepolia',
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
          code: '// Start the backend to generate Solidity from natural language.\npragma solidity 0.8.24;\n\ncontract AgentiVault4626 {}\n',
        ),
      ],
      bots: const [],
      traces: const [],
      createdAt: DateTime.now().toIso8601String(),
      updatedAt: DateTime.now().toIso8601String(),
    );
  }
}
