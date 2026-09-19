import 'package:flutter/material.dart';

class AcColors {
  static const bg = Color(0xFF070B14);
  static const header = Color(0xFF0B101B);
  static const card = Color(0xFF0F172A);
  static const elevated = Color(0xFF111827);
  static const border = Color(0xFF1E293B);
  static const cyan = Color(0xFF22D3EE);
  static const blue = Color(0xFF60A5FA);
  static const indigo = Color(0xFFA5B4FC);
  static const emerald = Color(0xFF34D399);
  static const amber = Color(0xFFFBBF24);
  static const rose = Color(0xFFFB7185);
  static const muted = Color(0xFF94A3B8);
  static const text = Color(0xFFF1F5F9);
}

ThemeData buildAgentiTheme() {
  const scheme = ColorScheme.dark(
    primary: AcColors.cyan,
    secondary: AcColors.blue,
    surface: AcColors.card,
    error: AcColors.rose,
    onPrimary: Colors.black,
    onSecondary: Colors.black,
    onSurface: AcColors.text,
    onError: Colors.black,
  );
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: scheme,
    scaffoldBackgroundColor: AcColors.bg,
    fontFamily: 'Segoe UI',
    appBarTheme: const AppBarTheme(
      backgroundColor: AcColors.header,
      foregroundColor: AcColors.text,
      elevation: 0,
    ),
    cardTheme: CardThemeData(
      color: AcColors.card,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AcColors.border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFF020617),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AcColors.border)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AcColors.border)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AcColors.cyan)),
    ),
    dividerColor: AcColors.border,
  );
}
