import 'package:flutter/material.dart';

/// HookahCRM brand (light Dodo system): warm orange accent on a light surface.
class Brand {
  static const accent = Color(0xFFF26722);
  static const accentDeep = Color(0xFFC9531A);
  static const bg = Color(0xFFEEF0F3);
  static const surface = Color(0xFFFFFFFF);
  static const ink = Color(0xFF1C1D22);
  static const muted = Color(0xFF8A8D96);
  static const success = Color(0xFF2BB673);

  static ThemeData theme() {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: accent,
        primary: accent,
        surface: surface,
      ),
      scaffoldBackgroundColor: bg,
    );
    return base.copyWith(
      appBarTheme: const AppBarTheme(
        backgroundColor: surface,
        foregroundColor: ink,
        elevation: 0,
        centerTitle: false,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: accent,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
      ),
    );
  }
}
