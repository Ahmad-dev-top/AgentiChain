import 'package:flutter/material.dart';

import 'models.dart';
import 'state.dart';
import 'theme.dart';
import 'widgets.dart';

class AiWorkspace extends StatefulWidget {
  const AiWorkspace({super.key, required this.state});
  final CommandCenterState state;

  @override
  State<AiWorkspace> createState() => _AiWorkspaceState();
}

class _AiWorkspaceState extends State<AiWorkspace> {
  final prompt = TextEditingController();
  final name = TextEditingController();
  String? expandedTrace;

  @override
  void dispose() {
    prompt.dispose();
    name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final project = widget.state.current;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        PanelCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const StatusChip(label: 'Autonomous Multi-Agent Pipeline'),
              const SizedBox(height: 12),
              const Text('Design & Verify Production Smart Contracts', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              const Text(
                'Describe protocol mechanics in natural language. The local pipeline drafts the spec, writes Solidity, audits, and tests. Pick a network in the header, then deploy to local Anvil or broadcast to that network.',
                style: TextStyle(color: AcColors.muted, height: 1.4),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: prompt,
                minLines: 3,
                maxLines: 6,
                decoration: const InputDecoration(
                  hintText: 'e.g. Create an ERC4626 vault on Base with a 2% fee, virtual shares, pause, and a 3-day timelock...',
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  SizedBox(
                    width: 280,
                    child: TextField(
                      controller: name,
                      decoration: const InputDecoration(hintText: 'Contract name (optional)'),
                    ),
                  ),
                  const Text('Solidity 0.8.24', style: TextStyle(color: AcColors.muted, fontSize: 12)),
                  AcButton(
                    label: widget.state.processing ? 'Orchestrating' : 'Synthesize',
                    icon: Icons.auto_awesome,
                    primary: true,
                    busy: widget.state.processing,
                    onPressed: () => widget.state.synthesize(prompt.text, contractName: name.text.trim().isEmpty ? null : name.text.trim()),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const SectionLabel('Quick prompts'),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final item in quickPrompts)
              ActionChip(
                label: Text(item.title),
                onPressed: () {
                  prompt.text = item.prompt;
                  widget.state.selectChain(item.chain);
                  setState(() {});
                },
              ),
          ],
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            const Expanded(child: SectionLabel('Agent traces')),
            if (project?.orchestrationEngine != null && project!.orchestrationEngine.isNotEmpty)
              StatusChip(
                label: 'Agents ready',
                color: AcColors.emerald,
              ),
            TextButton(
              onPressed: () => widget.state.selectTab(WorkspaceTab.code),
              child: Text('Inspect code (${project?.contracts.length ?? 0} files)'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (project == null || project.traces.isEmpty)
          const PanelCard(child: Text('No traces yet. Run a synthesis prompt to populate the swarm log.', style: TextStyle(color: AcColors.muted)))
        else
          ...project.traces.map((trace) {
            final open = expandedTrace == trace.id;
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: PanelCard(
                child: InkWell(
                  onTap: () => setState(() => expandedTrace = open ? null : trace.id),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.smart_toy_outlined, color: AcColors.cyan, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(trace.agentName, style: const TextStyle(fontWeight: FontWeight.w700)),
                          ),
                          StatusChip(label: '${trace.latencyMs} ms'),
                          const SizedBox(width: 6),
                          StatusChip(label: '${trace.tokensUsed} tok', color: AcColors.indigo),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(trace.action, style: const TextStyle(color: AcColors.blue)),
                      if (open) ...[
                        const SizedBox(height: 8),
                        Text(trace.thought, style: const TextStyle(color: AcColors.muted, height: 1.4)),
                      ],
                    ],
                  ),
                ),
              ),
            );
          }),
      ],
    );
  }
}

class SpecWorkspace extends StatelessWidget {
  const SpecWorkspace({super.key, required this.spec});
  final ContractSpec spec;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        PanelCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(spec.title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Text(spec.description, style: const TextStyle(color: AcColors.muted, height: 1.4)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  StatusChip(label: spec.standard),
                  StatusChip(label: spec.targetChain, color: AcColors.blue),
                  StatusChip(label: 'Solidity ${spec.solidityVersion}', color: AcColors.indigo),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        PanelCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SectionLabel('Features'),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final entry in spec.features.asMap.entries)
                    StatusChip(label: entry.key, color: entry.value ? AcColors.emerald : AcColors.muted),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _notes('Roles', spec.roles),
        _notes('Invariants', spec.invariants),
        _notes('Functions', spec.functions),
        _notes('Events', spec.events),
        _notes('Custom errors', spec.customErrors),
        _notes('State variables', spec.stateVariables),
      ],
    );
  }

  Widget _notes(String title, List<NamedNote> notes) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: PanelCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionLabel(title),
            const SizedBox(height: 12),
            if (notes.isEmpty)
              const Text('None generated', style: TextStyle(color: AcColors.muted))
            else
              ...notes.map(
                (note) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(note.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                      if (note.extra.isNotEmpty) Text(note.extra, style: const TextStyle(color: AcColors.cyan, fontSize: 12, fontFamily: 'Consolas')),
                      Text(note.description, style: const TextStyle(color: AcColors.muted)),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class CodeWorkspace extends StatelessWidget {
  const CodeWorkspace({super.key, required this.state});
  final CommandCenterState state;

  @override
  Widget build(BuildContext context) {
    final project = state.current;
    if (project == null || project.contracts.isEmpty) {
      return const Center(child: Text('No Solidity files yet.'));
    }
    return DefaultTabController(
      length: project.contracts.length,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Row(
              children: [
                AcButton(label: 'Audit & patch', icon: Icons.security, onPressed: () {
                  state.selectTab(WorkspaceTab.audit);
                  state.autoPatch();
                }),
                const SizedBox(width: 8),
                AcButton(label: 'Simulate', icon: Icons.science, onPressed: () {
                  state.selectTab(WorkspaceTab.simulation);
                  state.runSimulation();
                }),
                const Spacer(),
                AcButton(
                  label: 'Copy core',
                  icon: Icons.copy,
                  onPressed: () => copyText(context, project.contracts.first.code, 'Solidity'),
                ),
              ],
            ),
          ),
          TabBar(
            isScrollable: true,
            tabs: [for (final file in project.contracts) Tab(text: file.name)],
          ),
          Expanded(
            child: TabBarView(
              children: [
                for (final file in project.contracts)
                  ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Text('${file.filePath}  •  v${file.version}  •  ${file.contractType}', style: const TextStyle(color: AcColors.muted)),
                      const SizedBox(height: 8),
                      CodeView(code: file.code),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class GraphWorkspace extends StatelessWidget {
  const GraphWorkspace({super.key, required this.state});
  final CommandCenterState state;

  @override
  Widget build(BuildContext context) {
    final project = state.current;
    final spec = project?.specJson;
    if (spec == null) {
      return const Center(child: Text('No specification loaded'));
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        PanelCard(
          child: Text(
            project?.orchestrationEngine == 'langgraph'
                ? 'Node path: ${(project?.nodePath.isEmpty ?? true) ? 'architect → solidity → auditor → foundry → gas' : project!.nodePath.join(' → ')}. Contract boxes below are from the spec, not a compiled AST.'
                : 'Contract architecture is derived from the formal spec. This is a local graph, not a compiled AST.',
            style: TextStyle(color: project?.orchestrationEngine == 'langgraph' ? AcColors.emerald : AcColors.muted),
          ),
        ),
        const SizedBox(height: 12),
        PanelCard(
          padding: EdgeInsets.zero,
          child: SizedBox(
            height: 360,
            child: CustomPaint(
              painter: ArchitecturePainter(spec),
              child: const SizedBox.expand(),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final role in spec.roles) StatusChip(label: role.name, color: AcColors.indigo),
            for (final fn in spec.functions) StatusChip(label: fn.name, color: AcColors.cyan),
            for (final event in spec.events) StatusChip(label: event.name, color: AcColors.emerald),
          ],
        ),
      ],
    );
  }
}

class ArchitecturePainter extends CustomPainter {
  ArchitecturePainter(this.spec);
  final ContractSpec spec;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final core = Paint()..color = const Color(0xFF164E63);
    canvas.drawCircle(center, 54, core);
    final text = TextPainter(
      text: TextSpan(text: spec.name, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: 90);
    text.paint(canvas, center - Offset(text.width / 2, text.height / 2));

    final nodes = [
      ...spec.roles.take(3).map((item) => (item.name, const Color(0xFF6366F1))),
      ...spec.functions.take(3).map((item) => (item.name, const Color(0xFF22D3EE))),
      ...spec.events.take(2).map((item) => (item.name, const Color(0xFF34D399))),
    ];
    for (var i = 0; i < nodes.length; i++) {
      final nodeCenter = Offset(
        (center.dx + 140 * (i + 1) / (nodes.length + 1) - 70).clamp(70, size.width - 70),
        (80.0 + (i % 3) * 90).clamp(50, size.height - 50),
      );
      canvas.drawLine(center, nodeCenter, Paint()..color = const Color(0xFF334155)..strokeWidth = 1.4);
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromCenter(center: nodeCenter, width: 120, height: 36), const Radius.circular(10)),
        Paint()..color = nodes[i].$2.withOpacity(0.18),
      );
      final label = TextPainter(
        text: TextSpan(text: nodes[i].$1, style: TextStyle(color: nodes[i].$2, fontSize: 10, fontWeight: FontWeight.w700)),
        textDirection: TextDirection.ltr,
      )..layout(maxWidth: 110);
      label.paint(canvas, nodeCenter - Offset(label.width / 2, label.height / 2));
    }
  }

  @override
  bool shouldRepaint(covariant ArchitecturePainter oldDelegate) => oldDelegate.spec.name != spec.name;
}

class AuditWorkspace extends StatelessWidget {
  const AuditWorkspace({super.key, required this.state});
  final CommandCenterState state;

  Color _sev(String severity) {
    switch (severity) {
      case 'Critical':
        return AcColors.rose;
      case 'High':
        return const Color(0xFFFB923C);
      case 'Medium':
        return AcColors.amber;
      case 'Gas':
        return AcColors.indigo;
      default:
        return AcColors.muted;
    }
  }

  @override
  Widget build(BuildContext context) {
    final audit = state.current?.audit;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            SizedBox(width: 160, child: MetricTile(label: 'Score', value: '${audit?.securityScore ?? 100}/100', color: AcColors.emerald)),
            SizedBox(width: 140, child: MetricTile(label: 'Critical', value: '${audit?.criticalCount ?? 0}', color: AcColors.rose)),
            SizedBox(width: 140, child: MetricTile(label: 'High', value: '${audit?.highCount ?? 0}', color: const Color(0xFFFB923C))),
            SizedBox(width: 140, child: MetricTile(label: 'Gas', value: '${audit?.gasCount ?? 0}', color: AcColors.indigo)),
          ],
        ),
        const SizedBox(height: 12),
        AcButton(
          label: state.patching ? 'Patching' : 'Run auto-patch',
          icon: Icons.healing,
          primary: true,
          busy: state.patching,
          onPressed: state.autoPatch,
        ),
        const SizedBox(height: 12),
        PanelCard(
          child: Text(
            audit?.live == true
                ? 'Live security audit on this machine.'
                : 'Local pattern scan until a live report is available.',
            style: TextStyle(color: audit?.live == true ? AcColors.emerald : AcColors.amber),
          ),
        ),
        const SizedBox(height: 12),
        if (audit == null)
          const PanelCard(child: Text('No audit yet. Synthesize a contract or run auto-patch.', style: TextStyle(color: AcColors.muted)))
        else
          ...audit.vulnerabilities.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: PanelCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        StatusChip(label: item.severity, color: _sev(item.severity)),
                        const SizedBox(width: 8),
                        StatusChip(label: item.status, color: item.status == 'patched' ? AcColors.emerald : AcColors.muted),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(item.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text(item.description, style: const TextStyle(color: AcColors.muted)),
                    const SizedBox(height: 6),
                    Text('Fix: ${item.recommendation}', style: const TextStyle(color: AcColors.cyan, fontSize: 12)),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class FoundryWorkspace extends StatelessWidget {
  const FoundryWorkspace({super.key, required this.state});
  final CommandCenterState state;

  @override
  Widget build(BuildContext context) {
    final sim = state.current?.simulation;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            AcButton(
              label: state.simulating ? 'Running forge' : 'Run live forge test',
              icon: Icons.play_arrow,
              primary: true,
              busy: state.simulating,
              onPressed: state.runSimulation,
            ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            SizedBox(width: 160, child: MetricTile(label: 'Passed', value: '${sim?.passedTests ?? 0}', color: AcColors.emerald)),
            SizedBox(width: 160, child: MetricTile(label: 'Failed', value: '${sim?.failedTests ?? 0}', color: AcColors.rose)),
            SizedBox(width: 160, child: MetricTile(label: 'Duration', value: '${sim?.durationMs ?? 0} ms')),
          ],
        ),
        const SizedBox(height: 12),
        PanelCard(
          child: Text(
            sim?.live == true
                ? 'Live forge build/test on this machine.'
                : 'No live Foundry result yet. Run forge test against the current project sources.',
            style: TextStyle(color: sim?.live == true ? AcColors.emerald : AcColors.amber),
          ),
        ),
        const SizedBox(height: 12),
        if (sim != null) ...[
          const SectionLabel('Tests'),
          const SizedBox(height: 8),
          ...sim.tests.map(
            (test) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: PanelCard(
                child: Row(
                  children: [
                    Icon(test.status == 'PASS' ? Icons.check_circle : Icons.error, color: test.status == 'PASS' ? AcColors.emerald : AcColors.rose, size: 18),
                    const SizedBox(width: 8),
                    Expanded(child: Text(test.name)),
                    Text('${test.gasUsed} gas', style: const TextStyle(color: AcColors.muted, fontFamily: 'Consolas')),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          const SectionLabel('Gas benchmarks'),
          const SizedBox(height: 8),
          ...sim.gasBenchmarks.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: PanelCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.functionName, style: const TextStyle(fontFamily: 'Consolas', fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text('avg ${item.avgGas} → ${item.optimizedAvgGas}  (${item.savingsPercentage.toStringAsFixed(1)}% save)', style: const TextStyle(color: AcColors.emerald)),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          CodeView(code: sim.traceLogs.join('\n')),
        ],
      ],
    );
  }
}

class DeployWorkspace extends StatelessWidget {
  const DeployWorkspace({super.key, required this.state});
  final CommandCenterState state;

  @override
  Widget build(BuildContext context) {
    final deployment = state.current?.deployment;
    final public = deployment != null && deployment.chainId != 31337;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        PanelCard(
          child: Text(
            deployment != null && deployment.live
                ? public
                    ? 'Last broadcast was ${deployment.network} at ${deployment.explorerUrl} (chainId ${deployment.chainId}). ${deployment.note ?? ''}'
                    : 'Last broadcast was local Anvil at ${deployment.explorerUrl} (chainId ${deployment.chainId}). ${deployment.note ?? ''} Live verification is local bytecode matching.'
                : 'Local Anvil stays on this machine. Broadcast to ${state.selectedChain} is a real public transaction on that network. The app never stores a private key.',
            style: TextStyle(color: deployment?.live == true ? AcColors.emerald : AcColors.amber),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          state.publicBroadcastReady
              ? 'Each header network has its own HTTPS RPC. Broadcast uses the selected chain. Mainnet names spend real funds when the server mainnet flag is on.'
              : 'Each header network can broadcast once a throwaway deployer key and ALLOW_PUBLIC_BROADCAST=true are set in the server env file.',
          style: const TextStyle(color: AcColors.muted, fontSize: 12),
        ),
        if (state.publicDeployerAddress != null) ...[
          const SizedBox(height: 8),
          Text(
            'Fund ${state.publicDeployerAddress} on ${state.selectedChain} before a public broadcast.',
            style: const TextStyle(color: AcColors.muted, fontSize: 12, fontFamily: 'Consolas'),
          ),
        ],
        const SizedBox(height: 12),
        AcButton(
          label: state.deploying ? 'Broadcasting to Anvil' : 'Broadcast to local Anvil',
          icon: Icons.rocket_launch_outlined,
          primary: true,
          busy: state.deploying,
          onPressed: () => state.deploy(state.selectedChain),
        ),
        const SizedBox(height: 8),
        AcButton(
          label: state.deploying ? 'Broadcasting to ${state.selectedChain}' : 'Broadcast to ${state.selectedChain}',
          icon: Icons.public_outlined,
          busy: state.deploying,
          onPressed: () => state.deploy(state.selectedChain, broadcastPublic: true),
        ),
        const SizedBox(height: 8),
        AcButton(
          label: state.verifying
              ? 'Matching bytecode'
              : public
                  ? 'Verify on ${deployment!.network}'
                  : 'Verify bytecode on Anvil',
          icon: Icons.verified_outlined,
          busy: state.verifying,
          onPressed: deployment == null ? null : () => state.verify(),
        ),
        const SizedBox(height: 8),
        Text(
          'Selected: ${state.selectedChain}. Anvil is chain 31337. Public broadcast is a real transaction on the selected network.',
          style: const TextStyle(color: AcColors.muted, fontSize: 12),
        ),
        const SizedBox(height: 16),
        if (deployment == null)
          const PanelCard(child: Text('No deployment record yet.', style: TextStyle(color: AcColors.muted)))
        else
          PanelCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(deployment.contractName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    StatusChip(
                      label: deployment.live
                          ? (public ? 'live ${deployment.network}' : 'live Anvil')
                          : 'simulated',
                      color: deployment.live ? AcColors.emerald : AcColors.amber,
                    ),
                    StatusChip(label: 'chainId ${deployment.chainId}'),
                    StatusChip(label: deployment.network),
                    StatusChip(
                      label: deployment.verificationStatus,
                      color: deployment.verificationStatus == 'verified'
                          ? AcColors.emerald
                          : deployment.verificationStatus == 'failed'
                              ? AcColors.rose
                              : AcColors.amber,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _kv('Address', deployment.contractAddress),
                _kv('Tx', deployment.transactionHash),
                _kv('Block', '${deployment.blockNumber}'),
                _kv('Gas', deployment.gasUsed),
                _kv('Verification', deployment.verificationStatus),
                _kv('Verify engine', deployment.verificationEngine),
                _kv(public ? 'Explorer' : 'RPC', deployment.explorerUrl),
                if (deployment.verificationNote != null && deployment.verificationNote!.isNotEmpty)
                  _kv('Verify note', deployment.verificationNote!),
                if (deployment.note != null && deployment.note!.isNotEmpty) _kv('Note', deployment.note!),
              ],
            ),
          ),
      ],
    );
  }

  Widget _kv(String key, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 110, child: Text(key, style: const TextStyle(color: AcColors.muted))),
          Expanded(child: SelectableText(value, style: const TextStyle(fontFamily: 'Consolas'))),
        ],
      ),
    );
  }
}

class BotsWorkspace extends StatelessWidget {
  const BotsWorkspace({super.key, required this.state});
  final CommandCenterState state;

  @override
  Widget build(BuildContext context) {
    const types = [
      ('event_watcher', 'Event watcher'),
      ('tvl_monitor', 'TVL monitor'),
      ('gas_spike_alert', 'Gas spike alert'),
      ('health_keeper', 'Health keeper'),
      ('circuit_breaker', 'Circuit breaker'),
    ];
    final bots = state.current?.bots ?? const <MonitoringBotRecord>[];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const PanelCard(
          child: Text(
            'Keepers subscribe to local Anvil (WebSocket when available, otherwise HTTP log poll). They do not watch public RPCs. Pause is an explicit Anvil probe, not an automatic circuit-breaker broadcast.',
            style: TextStyle(color: AcColors.amber),
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final item in types)
              AcButton(
                label: item.$2,
                icon: Icons.smart_toy_outlined,
                onPressed: () => state.createBot(item.$1, item.$2),
              ),
            AcButton(label: 'Probe pause on Anvil', icon: Icons.bolt, onPressed: state.probeKeepers),
          ],
        ),
        const SizedBox(height: 12),
        if (bots.isEmpty)
          const PanelCard(child: Text('No keeper configs yet.', style: TextStyle(color: AcColors.muted)))
        else
          ...bots.map(
            (bot) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: PanelCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text(bot.name, style: const TextStyle(fontWeight: FontWeight.w700))),
                        StatusChip(
                          label: bot.live ? 'live ${bot.transport ?? bot.engine}' : bot.status,
                          color: bot.live ? AcColors.emerald : AcColors.amber,
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text('${bot.botType} • tag ${bot.network} • Anvil 31337', style: const TextStyle(color: AcColors.muted)),
                    Text(bot.triggerCondition, style: const TextStyle(color: AcColors.muted)),
                    const SizedBox(height: 6),
                    Text('Events ${bot.eventsCaptured} • Alerts ${bot.alertsFired}', style: const TextStyle(color: AcColors.cyan)),
                    if (bot.note != null && bot.note!.isNotEmpty)
                      Text(bot.note!, style: const TextStyle(fontSize: 12, color: AcColors.muted)),
                    if (bot.logs.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      ...bot.logs.take(3).map(
                            (log) => Text('${log.level}: ${log.message}', style: const TextStyle(fontSize: 12, color: AcColors.muted)),
                          ),
                    ],
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class TelemetryWorkspace extends StatelessWidget {
  const TelemetryWorkspace({super.key, required this.state});
  final CommandCenterState state;

  Color _probeColor(String status) {
    if (status == 'ok' || status == 'live') return AcColors.emerald;
    if (status == 'not_installed' || status == 'not_deployed' || status == 'not_configured') return AcColors.amber;
    return AcColors.rose;
  }

  @override
  Widget build(BuildContext context) {
    final snapshot = state.telemetry;
    final traces = state.current?.traces ?? const <AgentTraceItem>[];
    final host = snapshot?.host;
    final uptime = host == null ? '—' : (host.uptimeSeconds >= 60 ? '${(host.uptimeSeconds / 60).toStringAsFixed(1)} min' : '${host.uptimeSeconds.toStringAsFixed(0)} s');
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            SizedBox(width: 180, child: MetricTile(label: 'API', value: state.apiOnline ? 'online' : 'offline', color: state.apiOnline ? AcColors.emerald : AcColors.rose)),
            SizedBox(width: 160, child: MetricTile(label: 'Telemetry', value: snapshot == null ? 'idle' : (snapshot.live ? 'live' : 'degraded'), color: snapshot?.live == true ? AcColors.emerald : AcColors.amber)),
            SizedBox(width: 160, child: MetricTile(label: 'Uptime', value: uptime)),
            SizedBox(width: 160, child: MetricTile(label: 'CPU cores', value: host == null ? '—' : '${host.cpuCount}')),
            SizedBox(width: 180, child: MetricTile(label: 'Memory', value: host?.memoryUsedPercent == null ? '—' : '${host!.memoryUsedPercent}%', color: AcColors.indigo)),
          ],
        ),
        const SizedBox(height: 12),
        PanelCard(
          child: Text(
            snapshot?.note ?? 'Local process telemetry for this command center.',
            style: const TextStyle(color: AcColors.muted),
          ),
        ),
        if (host != null) ...[
          const SizedBox(height: 12),
          PanelCard(
            child: Text(
              '${host.system} ${host.release} • ${host.hostname} • pid ${host.pid}',
              style: const TextStyle(fontFamily: 'Consolas', fontSize: 12, color: Color(0xFFCBD5E1)),
            ),
          ),
        ],
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: (snapshot?.probes.entries.toList() ?? const <MapEntry<String, String>>[])
              .where((entry) => const {'database', 'foundry', 'anvil', 'slither', 'keeper', 'walletAuth'}.contains(entry.key))
              .map((entry) => StatusChip(label: '${entry.key} ${entry.value}', color: _probeColor(entry.value)))
              .toList(),
        ),
        const SizedBox(height: 12),
        const SectionLabel('Request log'),
        const SizedBox(height: 8),
        if (snapshot == null || snapshot.requestLogs.isEmpty)
          const PanelCard(child: Text('No local request logs yet. Run the pipeline or refresh after API calls.', style: TextStyle(color: AcColors.muted)))
        else
          ...snapshot.requestLogs.map(
            (log) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: PanelCard(
                child: Text(
                  '[${log.createdAt}] ${log.method} ${log.path} ${log.statusCode} (${log.latencyMs}ms) ${log.correlationId}',
                  style: const TextStyle(fontFamily: 'Consolas', fontSize: 12, color: Color(0xFFCBD5E1)),
                ),
              ),
            ),
          ),
        const SizedBox(height: 16),
        const SectionLabel('Agent traces'),
        const SizedBox(height: 8),
        ...traces.map(
          (trace) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: PanelCard(
              child: Text(
                '[${trace.createdAt}] ${trace.agentName} ${trace.action} (${trace.latencyMs}ms, ${trace.tokensUsed} tok)',
                style: const TextStyle(fontFamily: 'Consolas', fontSize: 12, color: Color(0xFFCBD5E1)),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
