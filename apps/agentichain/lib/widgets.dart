import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'theme.dart';

class PanelCard extends StatelessWidget {
  const PanelCard({super.key, required this.child, this.padding});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AcColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AcColors.border),
      ),
      child: child,
    );
  }
}

class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: const TextStyle(color: AcColors.muted, fontSize: 11, letterSpacing: 1.1, fontWeight: FontWeight.w700),
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.label, this.color = AcColors.cyan});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withOpacity(0.45)),
      ),
      child: Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }
}

class AcButton extends StatelessWidget {
  const AcButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.primary = false,
    this.busy = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool primary;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final child = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (busy)
          const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
        else if (icon != null)
          Icon(icon, size: 16),
        if (icon != null || busy) const SizedBox(width: 8),
        Text(label),
      ],
    );
    if (primary) {
      return FilledButton(onPressed: busy ? null : onPressed, child: child);
    }
    return OutlinedButton(onPressed: busy ? null : onPressed, child: child);
  }
}

class MetricTile extends StatelessWidget {
  const MetricTile({super.key, required this.label, required this.value, this.color = AcColors.cyan});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return PanelCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: AcColors.muted, fontSize: 12)),
          const SizedBox(height: 8),
          Text(value, style: TextStyle(color: color, fontSize: 22, fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}

class CodeView extends StatelessWidget {
  const CodeView({super.key, required this.code});
  final String code;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(minHeight: 280),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF020617),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AcColors.border),
      ),
      child: SelectableText(
        code,
        style: const TextStyle(fontFamily: 'Consolas', fontSize: 12.5, height: 1.45, color: Color(0xFFCBD5E1)),
      ),
    );
  }
}

Future<void> copyText(BuildContext context, String value, String label) async {
  await Clipboard.setData(ClipboardData(text: value));
  if (context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$label copied')));
  }
}
