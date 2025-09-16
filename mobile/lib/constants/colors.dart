import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Paleta ÚNICA (solo estos colores).
/// Armonía: azul profundo como primario, azul vivo para estados/focus,
/// magenta (tabColor) como acento llamativo, gris cálido de fondo y
/// grises para tipografía secundaria/bordes. Naranja (text3Color) como acento cálido puntual.
class AppColors {
  // --- Colores base (tu lista) ---
  static const Color tabColor = Color(0xffEE2D7A);                 // Acento vibrante
  static const Color bgColor = Color(0xffECF0F1);                   // Fondo claro
  static const Color buttonColor = Color(0xff002366);               // Primario (azul profundo)
  static const Color button2Color = Color(0xff3498DB);              // Secundario (azul vivo)
  static const Color buttonTextColor = Color(0xffFFFFFF);           // Texto sobre botones
  static const Color textFormFieldBorderColor = Color(0xffBDC3C7);  // Borde inputs
  static const Color textFormFieldLabelColor = Color(0xff2C3E50);   // Label inputs
  static const Color text1Color = Color(0xff2C3E50);                // Texto principal
  static const Color text2Color = Color(0xff7F8C8D);                // Texto secundario
  static const Color text3Color = Colors.orange;                    // Acento cálido puntual
  static const Color strokeColor = Color(0xffD5D8DC);               // Bordes/surcos

  /// Tema claro armónico basado **solo** en los colores de arriba.
  static ThemeData get lightTheme {
    // Esquema de color coherente con la paleta
    const colorScheme = ColorScheme(
      brightness: Brightness.light,
      primary: buttonColor,        // acciones y énfasis principal
      onPrimary: buttonTextColor,  // contraste legible sobre primario
      secondary: tabColor,         // acento vibrante (tabs/llamados puntuales)
      onSecondary: buttonTextColor,
      surface: Colors.white,       // superficies (cards, sheets)
      onSurface: text1Color,
      background: bgColor,         // fondo de app
      onBackground: text1Color,
      error: text3Color,           // usamos el acento cálido para errores/avisos
      onError: Colors.white,
      tertiary: button2Color,      // apoyo/focus/estados informativos
      onTertiary: Colors.white,
    );

    final base = ThemeData(
      useMaterial3: true, // tipografías y espaciados modernos
      colorScheme: colorScheme,
      scaffoldBackgroundColor: bgColor,
      primaryColor: buttonColor,
      // Tipografías: Poppins limpia y jerárquica
      textTheme: GoogleFonts.poppinsTextTheme().apply(
        bodyColor: text1Color,
        displayColor: text1Color,
      ),

      // AppBar: fondo claro, texto en primario para jerarquía
      appBarTheme: const AppBarTheme(
        elevation: 0,
        backgroundColor: bgColor,
        foregroundColor: text1Color,
        centerTitle: true,
        titleTextStyle: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          color: text1Color,
        ),
        iconTheme: IconThemeData(color: text1Color),
      ),

      // Cards limpias con borde sutil y radios amables
      cardTheme: const CardTheme(
        color: Colors.white,
        elevation: 4,
        margin: EdgeInsets.symmetric(vertical: 8.0),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(16.0)),
        ),
      ),

      // Botones elevados: primario sólido; contenidos legibles
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: buttonColor,
          foregroundColor: buttonTextColor,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            letterSpacing: .2,
          ),
        ),
      ),

      // Botones de texto/ícono con colores de apoyo
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: button2Color,
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
      iconTheme: const IconThemeData(color: text2Color),

      // Campos de texto: bordes grises, focus azul vivo, labels legibles
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        labelStyle: const TextStyle(color: textFormFieldLabelColor),
        hintStyle: const TextStyle(color: text2Color),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: textFormFieldBorderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: button2Color, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: text3Color, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: text3Color, width: 2),
        ),
      ),

      // Chips/pastillas opcionales con acentos consistentes
      chipTheme: ChipThemeData(
        backgroundColor: Colors.white,
        selectedColor: button2Color.withOpacity(.12),
        disabledColor: strokeColor,
        labelStyle: const TextStyle(color: text1Color),
        secondaryLabelStyle: const TextStyle(color: buttonTextColor),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: strokeColor),
        ),
      ),

      // Dividers suaves para separar secciones
      dividerTheme: const DividerThemeData(
        color: strokeColor,
        thickness: 1,
        space: 24,
      ),

      // BottomNavigation / NavigationBar con acentos de la paleta
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: button2Color.withOpacity(.12),
        labelTextStyle: MaterialStateProperty.resolveWith((states) {
          final isSelected = states.contains(MaterialState.selected);
          return TextStyle(
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            color: isSelected ? buttonColor : text2Color,
          );
        }),
        iconTheme: MaterialStateProperty.resolveWith((states) {
          final isSelected = states.contains(MaterialState.selected);
          return IconThemeData(
            color: isSelected ? buttonColor : text2Color,
          );
        }),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
      ),

      // SnackBars: legibles y con jerarquía
      snackBarTheme: SnackBarThemeData(
        backgroundColor: text1Color,
        contentTextStyle: const TextStyle(color: Colors.white),
        actionTextColor: button2Color,
        behavior: SnackBarBehavior.floating,
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );

    // Pequeño ajuste para títulos fuertes (jerarquía visual)
    return base.copyWith(
      textTheme: base.textTheme.copyWith(
        titleLarge: base.textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w800,
          color: text1Color,
        ),
        headlineSmall: base.textTheme.headlineSmall?.copyWith(
          fontWeight: FontWeight.w700,
          color: text1Color,
        ),
        bodyMedium: base.textTheme.bodyMedium?.copyWith(
          color: text1Color,
        ),
        bodySmall: base.textTheme.bodySmall?.copyWith(
          color: text2Color,
        ),
      ),
    );
  }
}
