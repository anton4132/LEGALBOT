import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  static const Color tabColor = Color(0xffEE2D7A);   // Dark Slate Blue
  static const Color bgColor = Color(0xffECF0F1);    // Light Gray
  static const Color buttonColor =Color(0xff002366); // Bright Red for primary buttons
  static const Color button2Color = Color(0xff3498DB); // Vivid Blue for secondary buttons
  static const Color buttonTextColor = Color(0xffFFFFFF); // White for text on buttons
  static const Color textFormFieldBorderColor = Color(0xffBDC3C7); // Light Gray for input borders
  static const Color textFormFieldLabelColor = Color(0xff2C3E50); // Dark Slate Blue for labels
  static const Color text1Color = Color(0xff2C3E50);  // Dark Slate Blue for main text
  static const Color text2Color = Color(0xff7F8C8D);  // Medium Gray for secondary text
  static const Color text3Color = Colors.orange;  // Bright Red for accents
  static const Color strokeColor = Color(0xffD5D8DC); // Warm Gray for strokes and borders
  

   // Paleta de colores moderna y oscura
  static const Color primaryColor = Color(0xFF00C5A4); // Un verde azulado vibrante
  static const Color accentColor = Color(0xFF7A57D1); // Un morado como acento secundario
  static const Color backgroundColor = Color(0xFF121212); // Negro casi puro para el fondo
  static const Color cardColor = Color(0xFF1E1E1E); // Un gris oscuro para las tarjetas
  static const Color textColor = Color(0xFFE0E0E0); // Un blanco suave para el texto
  static const Color textSecondaryColor = Color(0xFFB0B0B0); // Gris claro para texto secundario
  static const Color errorColor = Color(0xFFCF6679);

  // Colores para los estados de verificación
  static const Color pendingColor = Colors.orangeAccent;
  static const Color approvedColor = Colors.greenAccent;
  static const Color rejectedColor = Colors.redAccent;
  static const Color observedColor = Colors.lightBlueAccent;
   static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      primaryColor: primaryColor,
      scaffoldBackgroundColor: backgroundColor,
      cardColor: cardColor,
      hintColor: textSecondaryColor,
      textTheme: GoogleFonts.poppinsTextTheme(
        ThemeData.dark().textTheme,
      ).apply(
        bodyColor: textColor,
        displayColor: textColor,
      ),
      
      appBarTheme: const AppBarTheme(
        backgroundColor: backgroundColor,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: primaryColor,
        ),
        iconTheme: IconThemeData(color: primaryColor),
      ),

      cardTheme: const CardThemeData(
        color: cardColor,
        elevation: 4,
        margin: EdgeInsets.symmetric(vertical: 8.0),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(
            Radius.circular(16.0),
          ),
        ),
      ),

      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(30.0),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: cardColor,
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16.0),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16.0),
          borderSide: const BorderSide(color: primaryColor, width: 2.0),
        ),
        labelStyle: const TextStyle(color: textSecondaryColor),
        hintStyle: const TextStyle(color: textSecondaryColor),
      ),

      iconTheme: const IconThemeData(color: textSecondaryColor),

      colorScheme: const ColorScheme.dark(
        primary: primaryColor,
        secondary: accentColor,
        surface: cardColor,
        background: backgroundColor,
        error: errorColor,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: textColor,
        onBackground: textColor,
        onError: Colors.black,
      ),
    );
  }
}


