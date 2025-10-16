
import 'package:flutter/material.dart';
import 'signup/contact_info_screen.dart';

class SignUpScreen extends StatelessWidget {
  const SignUpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // Inicia el flujo de registro directamente como cliente
    return const ContactInfoScreen(userType: 'cliente');
  }
}