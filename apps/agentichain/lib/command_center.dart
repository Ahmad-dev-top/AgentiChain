import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'models.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';
import 'workspaces.dart';

class CommandCenterPage extends StatefulWidget {
  const CommandCenterPage({super.key});

  @override
  State<CommandCenterPage> createState() => _CommandCenterPageState();
}

class _CommandCenterPageState extends State<CommandCenterPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CommandCenterState>().bootstrap();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<CommandCenterState>();
    if (state.notice != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final message = state.notice;
        if (message == null || !mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: state.noticeKind == 'error'
                ? const Color(0xFF7F1D1D)
                : state.noticeKind == 'success'
                    ? const Color(0xFF064E3B)
                    : const Color(0xFF1E3A5F),
          ),
        );
        state.clearNotice();
      });
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 1280;
        return Scaffold(
          drawer: compact ? _NavDrawer(state: state) : null,
          appBar: PreferredSize(
            preferredSize: Size.fromHeight(compact ? 64 : 72),
            child: _Header(state: state, compact: compact),
          ),
          body: Column(
            children: [
              const _DisclaimerBanner(),
              if (!compact) _TabStrip(state: state),
              Expanded(
                child: state.loading
                    ? const Center(child: CircularProgressIndicator())
                    : ColoredBox(
                        color: AcColors.bg,
                        child: Align(
                          alignment: Alignment.topCenter,
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 1280),
                            child: _WorkspaceHost(state: state),
                          ),
                        ),
                      ),
              ),
              const _Footer(),
            ],
          ),
          bottomNavigationBar: compact ? _MobileNav(state: state) : null,
        );
      },
    );
  }
}

class _DisclaimerBanner extends StatelessWidget {
  const _DisclaimerBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: const Color(0xFF422006),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: const Text(
        'Local command center. Server credentials are not entered or shown here.',
        style: TextStyle(color: Color(0xFFFDE68A), fontSize: 12),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.state, required this.compact});
  final CommandCenterState state;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AcColors.header,
        border: Border(bottom: BorderSide(color: AcColors.border)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: [
          if (compact)
            IconButton(onPressed: () => Scaffold.of(context).openDrawer(), icon: const Icon(Icons.menu))
          else
            const SizedBox(width: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.asset(
              'assets/logo.png',
              width: 40,
              height: 40,
              fit: BoxFit.cover,
            ),
          ),
          const SizedBox(width: 10),
          const Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('AgentiChain', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AcColors.cyan)),
              Text('Flutter command center', style: TextStyle(color: AcColors.muted, fontSize: 11)),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              reverse: true,
              child: Row(
                children: [
                  if (!compact) ...[
                    StatusChip(label: state.processing ? 'Orchestrating' : '7 Agents Ready', color: AcColors.emerald),
                    const SizedBox(width: 8),
                    StatusChip(label: state.apiOnline ? 'API online' : 'API offline', color: state.apiOnline ? AcColors.emerald : AcColors.rose),
                    const SizedBox(width: 8),
                    StatusChip(
                      label: state.wallet == null ? 'wallet off' : '${state.wallet!.shortAddress} · ${state.wallet!.chainId}',
                      color: state.wallet == null ? AcColors.amber : AcColors.emerald,
                    ),
                    const SizedBox(width: 8),
                  ],
                  DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: supportedChains.any((item) => item.name == state.selectedChain) ? state.selectedChain : 'Base Sepolia',
                      dropdownColor: AcColors.card,
                      items: [
                        for (final chain in supportedChains)
                          DropdownMenuItem(value: chain.name, child: Text('${chain.icon} ${chain.name}')),
                      ],
                      onChanged: (value) {
                        if (value != null) state.selectChain(value);
                      },
                    ),
                  ),
                  IconButton(
                    tooltip: 'Templates',
                    onPressed: () => _openTemplates(context, state),
                    icon: const Icon(Icons.layers_outlined),
                  ),
                  FilledButton.icon(
                    onPressed: state.connectingWallet
                        ? null
                        : () => state.wallet == null ? state.connectAnvilWallet() : state.disconnectWallet(),
                    icon: Icon(state.wallet == null ? Icons.account_balance_wallet_outlined : Icons.link_off, size: 16),
                    label: Text(compact ? (state.wallet == null ? 'Anvil' : 'Out') : (state.wallet == null ? 'Sign in Anvil' : 'Disconnect')),
                  ),
                  if (state.wallet == null) ...[
                    const SizedBox(width: 8),
                    OutlinedButton.icon(
                      onPressed: state.connectingWallet ? null : state.connectBrowserWallet,
                      icon: const Icon(Icons.language, size: 16),
                      label: Text(compact ? 'Browser' : 'Browser wallet'),
                    ),
                  ],
                  const SizedBox(width: 8),
                  FilledButton.icon(
                    onPressed: () => state.selectTab(WorkspaceTab.chat),
                    icon: const Icon(Icons.auto_awesome, size: 16),
                    label: Text(compact ? 'New' : 'New Prompt'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TabStrip extends StatelessWidget {
  const _TabStrip({required this.state});
  final CommandCenterState state;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: const Color(0xFF020617),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (final item in _tabs)
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  selected: state.tab == item.tab,
                  label: Text(item.label),
                  avatar: Icon(item.icon, size: 16),
                  onSelected: (_) => state.selectTab(item.tab),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _MobileNav extends StatelessWidget {
  const _MobileNav({required this.state});
  final CommandCenterState state;

  @override
  Widget build(BuildContext context) {
    final primary = _tabs.take(5).toList();
    final index = primary.indexWhere((item) => item.tab == state.tab);
    return NavigationBar(
      selectedIndex: index < 0 ? 0 : index,
      onDestinationSelected: (value) => state.selectTab(primary[value].tab),
      destinations: [
        for (final item in primary) NavigationDestination(icon: Icon(item.icon), label: item.label),
      ],
    );
  }
}

class _NavDrawer extends StatelessWidget {
  const _NavDrawer({required this.state});
  final CommandCenterState state;

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: AcColors.header,
      child: ListView(
        children: [
          const DrawerHeader(
            child: Text('AgentiChain workspaces', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          ),
          for (final item in _tabs)
            ListTile(
              leading: Icon(item.icon, color: state.tab == item.tab ? AcColors.cyan : AcColors.muted),
              title: Text(item.label),
              selected: state.tab == item.tab,
              onTap: () {
                state.selectTab(item.tab);
                Navigator.pop(context);
              },
            ),
        ],
      ),
    );
  }
}

class _WorkspaceHost extends StatelessWidget {
  const _WorkspaceHost({required this.state});
  final CommandCenterState state;

  @override
  Widget build(BuildContext context) {
    final project = state.current;
    if (project == null) {
      return const Center(child: Text('No project loaded'));
    }
    switch (state.tab) {
      case WorkspaceTab.chat:
        return AiWorkspace(state: state);
      case WorkspaceTab.spec:
        return SpecWorkspace(spec: project.specJson);
      case WorkspaceTab.code:
        return CodeWorkspace(state: state);
      case WorkspaceTab.graph:
        return GraphWorkspace(state: state);
      case WorkspaceTab.audit:
        return AuditWorkspace(state: state);
      case WorkspaceTab.simulation:
        return FoundryWorkspace(state: state);
      case WorkspaceTab.deploy:
        return DeployWorkspace(state: state);
      case WorkspaceTab.bots:
        return BotsWorkspace(state: state);
      case WorkspaceTab.telemetry:
        return TelemetryWorkspace(state: state);
    }
  }
}

class _Footer extends StatelessWidget {
  const _Footer();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: Color(0xFF060A12),
        border: Border(top: BorderSide(color: AcColors.border)),
      ),
      child: const Text(
        'AgentiChain command center',
        style: TextStyle(color: AcColors.muted, fontSize: 11),
      ),
    );
  }
}

class _TabSpec {
  const _TabSpec(this.tab, this.label, this.icon);
  final WorkspaceTab tab;
  final String label;
  final IconData icon;
}

const _tabs = [
  _TabSpec(WorkspaceTab.chat, 'AI Workspace', Icons.auto_awesome),
  _TabSpec(WorkspaceTab.spec, 'Formal Spec', Icons.rule),
  _TabSpec(WorkspaceTab.code, 'Solidity IDE', Icons.code),
  _TabSpec(WorkspaceTab.graph, 'Architecture', Icons.account_tree_outlined),
  _TabSpec(WorkspaceTab.audit, 'Security Audit', Icons.security),
  _TabSpec(WorkspaceTab.simulation, 'Foundry EVM', Icons.terminal),
  _TabSpec(WorkspaceTab.deploy, 'Multi-Chain Deploy', Icons.rocket_launch_outlined),
  _TabSpec(WorkspaceTab.bots, 'Keeper Bots', Icons.smart_toy_outlined),
  _TabSpec(WorkspaceTab.telemetry, 'Telemetry', Icons.monitor_heart_outlined),
];

Future<void> _openTemplates(BuildContext context, CommandCenterState state) async {
  await showModalBottomSheet<void>(
    context: context,
    backgroundColor: AcColors.card,
    showDragHandle: true,
    builder: (context) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Seeded projects', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          for (final project in state.projects)
            ListTile(
              title: Text(project.name),
              subtitle: Text('${project.contractStandard} • ${project.targetChain}'),
              selected: state.current?.id == project.id,
              onTap: () {
                state.selectProject(project);
                Navigator.pop(context);
              },
            ),
        ],
      );
    },
  );
}
