import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../Constants/colors.dart';
import '../../Widgets/custombtn.dart';
import '../../widgets/detailstext1.dart';
import 'login_screen.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final TextEditingController _codeController = TextEditingController();
  final TextEditingController _newPasswordController = TextEditingController();
  final TextEditingController _confirmPasswordController = TextEditingController();

  @override
  void dispose() {
    _codeController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Background color with News Wave text
          Container(
            width: double.infinity,
            color: AppColors.buttonColor,
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
          // Main content
          Positioned.fill(
            child: Align(
              alignment: Alignment.bottomCenter,
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
                        const Text1(
                          text1: 'Restablecer Clave',
                          size: 24,
                          color: AppColors.buttonColor,
                        ),
                        const SizedBox(height: 20),
                        const Text(
                          'Ingresa el código de 6 dígitos enviado a tu teléfono',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 16,
                            color: Colors.grey,
                          ),
                        ),
                        const SizedBox(height: 30),
                        
                        // Código de verificación
                        TextFormField(
                          controller: _codeController,
                          keyboardType: TextInputType.number,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(6),
                          ],
                          decoration: const InputDecoration(
                            labelText: 'Código de Verificación',
                            prefixIcon: Icon(Icons.security, color: AppColors.buttonColor),
                            border: OutlineInputBorder(),
                            focusedBorder: OutlineInputBorder(
                              borderSide: BorderSide(color: AppColors.buttonColor, width: 2),
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                        
                        // Nueva clave
                        TextFormField(
                          controller: _newPasswordController,
                          obscureText: true,
                          keyboardType: TextInputType.number,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(6),
                          ],
                          decoration: const InputDecoration(
                            labelText: 'Nueva Clave (6 dígitos)',
                            prefixIcon: Icon(Icons.lock, color: AppColors.buttonColor),
                            border: OutlineInputBorder(),
                            focusedBorder: OutlineInputBorder(
                              borderSide: BorderSide(color: AppColors.buttonColor, width: 2),
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                        
                        // Confirmar nueva clave
                        TextFormField(
                          controller: _confirmPasswordController,
                          obscureText: true,
                          keyboardType: TextInputType.number,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(6),
                          ],
                          decoration: const InputDecoration(
                            labelText: 'Confirmar Nueva Clave',
                            prefixIcon: Icon(Icons.lock, color: AppColors.buttonColor),
                            border: OutlineInputBorder(),
                            focusedBorder: OutlineInputBorder(
                              borderSide: BorderSide(color: AppColors.buttonColor, width: 2),
                            ),
                          ),
                        ),
                        const SizedBox(height: 30),
                        
                        CustomButton(
                          text: 'Restablecer Clave',
                          onTap: () {
                            // Validar campos
                            if (_codeController.text.isEmpty ||
                                _newPasswordController.text.isEmpty ||
                                _confirmPasswordController.text.isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Por favor completa todos los campos'),
                                  backgroundColor: Colors.red,
                                ),
                              );
                              return;
                            }

                            if (_codeController.text.length != 6) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('El código debe tener 6 dígitos'),
                                  backgroundColor: Colors.red,
                                ),
                              );
                              return;
                            }

                            if (_newPasswordController.text.length != 6) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('La nueva clave debe tener 6 dígitos'),
                                  backgroundColor: Colors.red,
                                ),
                              );
                              return;
                            }

                            if (_newPasswordController.text != _confirmPasswordController.text) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Las claves no coinciden'),
                                  backgroundColor: Colors.red,
                                ),
                              );
                              return;
                            }

                            // Mostrar mensaje de éxito
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Clave restablecida exitosamente'),
                                backgroundColor: Colors.green,
                              ),
                            );

                            // Navegar al login
                            Navigator.pushReplacement(
                              context,
                              MaterialPageRoute(builder: (context) => const LoginScreen()),
                            );
                          },
                        ),
                        const SizedBox(height: 20),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Text('¿Recordaste tu clave? '),
                            GestureDetector(
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (context) => const LoginScreen()),
                                );
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
                        const SizedBox(height: 20),
                      ],
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
