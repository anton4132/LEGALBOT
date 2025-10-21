import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:legalserviceapp/views/authentication/reset_password.dart';

import '../../constants/colors.dart';
import '../../widgets/custombtn.dart';
import '../../services/api_client.dart';
import '../../widgets/detailstext1.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  final TextEditingController _dniController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );

    _fadeAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.2),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );

    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    _dniController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _handleSendCode() async {
    if (_isSubmitting) return;

    FocusScope.of(context).unfocus();

    final dni = _dniController.text.trim();
    final correo = _emailController.text.trim();

    if (dni.isEmpty || correo.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Por favor completa todos los campos'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    final sanitizedDni = dni.replaceAll(RegExp('[^0-9]'), '');
    if (sanitizedDni.length != 8) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('El DNI debe tener 8 dígitos'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    final emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
    if (!emailPattern.hasMatch(correo)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Ingresa un correo electrónico válido'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      final normalizedEmail = correo.trim().toLowerCase();
      await ApiClient.validatePasswordRecoveryIdentity(
        dni: sanitizedDni,
        correo: normalizedEmail,
      );
      await ApiClient.requestPasswordRecoveryCode(
        dni: sanitizedDni,
        correo: normalizedEmail,
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content:
              Text('Te hemos enviado un código de verificación al correo registrado.'),
          backgroundColor: Colors.green,
        ),
      );

      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => ResetPasswordScreen(
            dni: sanitizedDni,
            correo: normalizedEmail,
          ),
        ),
      );
    } on ApiException catch (error) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.message),
          backgroundColor: Colors.red,
        ),
      );
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No se pudo iniciar la recuperación. Inténtalo nuevamente.'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }


  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Background color with app name
          Container(
            width: double.infinity,
            color: AppColors.buttonColor,
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: const Column(
                mainAxisAlignment: MainAxisAlignment.start,
                children: [
                  SizedBox(height: 100),
                  Text1(
                    text1: 'LegalBot',
                    color: Colors.white,
                    size: 32,
                  ),
                ],
              ),
            ),
          ),
          // Main content
          Positioned.fill(
            child: Align(
              alignment: Alignment.bottomCenter,
              child: SlideTransition(
                position: _slideAnimation,
                child: Container(
                  height: MediaQuery.of(context).size.height * 0.7,
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(30),
                      topRight: Radius.circular(30),
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20.0),
                    child: SingleChildScrollView(
                      child: Column(
                        children: [
                          const SizedBox(height: 20),
                          FadeTransition(
                            opacity: _fadeAnimation,
                            child: const Text1(
                              text1: 'Recuperar Clave',
                              size: 24,
                              color: AppColors.buttonColor,
                            ),
                          ),
                          const SizedBox(height: 20),
                          const Text(
                            'Ingresa tu DNI y correo electrónico registrado para recuperar tu clave',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 16,
                              color: Colors.grey,
                            ),
                          ),
                          const SizedBox(height: 30),
                          SlideTransition(
                            position: _slideAnimation,
                            child: TextFormField(
                              controller: _dniController,
                              keyboardType: TextInputType.number,
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                                LengthLimitingTextInputFormatter(8),
                              ],
                              decoration: const InputDecoration(
                                labelText: 'DNI',
                                prefixIcon: Icon(Icons.badge, color: AppColors.buttonColor),
                                border: OutlineInputBorder(),
                                focusedBorder: OutlineInputBorder(
                                  borderSide: BorderSide(color: AppColors.buttonColor, width: 2),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 20),
                          SlideTransition(
                            position: _slideAnimation,
                            child: TextFormField(
                              controller: _emailController,
                              keyboardType: TextInputType.emailAddress,
                              inputFormatters: [
                                FilteringTextInputFormatter.deny(RegExp(r'\s')),
                              ],
                              decoration: const InputDecoration(
                                labelText: 'Correo electrónico',
                                prefixIcon: Icon(Icons.email, color: AppColors.buttonColor),
                                border: OutlineInputBorder(),
                                focusedBorder: OutlineInputBorder(
                                  borderSide: BorderSide(color: AppColors.buttonColor, width: 2),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 30),
                          FadeTransition(
                            opacity: _fadeAnimation,
                            child: CustomButton(
                              text: _isSubmitting ? 'Enviando...' : 'Enviar Código',
                              onTap: _isSubmitting ? null : _handleSendCode,
                            ),
                          ),
                          const SizedBox(height: 20),
                          FadeTransition(
                            opacity: _fadeAnimation,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Text('¿Recordaste tu clave? '),
                                GestureDetector(
                                  onTap: () {
                                    Navigator.pop(context); // Go back to login
                                  },
                                  child: const Text(
                                    'Iniciar Sesión',
                                    style: TextStyle(
                                      color: AppColors.buttonColor,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 20),    
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
