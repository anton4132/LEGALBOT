import 'package:flutter/material.dart';
import 'signup/user_type_screen.dart';

class SignUpScreen extends StatelessWidget {
  const SignUpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // Redirigir directamente a la primera pantalla del nuevo flujo
    return const UserTypeScreen();
  }
} 