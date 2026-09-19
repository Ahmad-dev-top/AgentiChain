import 'package:flutter_test/flutter_test.dart';

import 'package:agentichain/main.dart';

void main() {
  testWidgets('renders AgentiChain shell', (tester) async {
    await tester.pumpWidget(const AgentiChainApp());
    await tester.pump();
    expect(find.textContaining('AgentiChain'), findsWidgets);
  });
}
