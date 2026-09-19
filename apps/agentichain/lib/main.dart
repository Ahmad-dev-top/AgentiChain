import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'command_center.dart';
import 'state.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const AgentiChainApp());
}

class AgentiChainApp extends StatelessWidget {
  const AgentiChainApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => CommandCenterState(),
      child: MaterialApp(
        title: 'AgentiChain',
        debugShowCheckedModeBanner: false,
        theme: buildAgentiTheme(),
        home: const CommandCenterPage(),
      ),
    );
  }
}
