import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../constants/colors.dart';
import '../../widgets/custombtn.dart';
import '../../services/api_client.dart';
import '../../widgets/detailstext1.dart';
import 'login_screen.dart';

class ResetPasswordScreen extends StatefulWidget {
  final String dni;
  final String correo;

  const ResetPasswordScreen({
    super.key,
    required this.dni,
    required this.correo,
  });

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final TextEditingController _codeController = TextEditingController();
  final TextEditingController _newPasswordController = TextEditingController();
  final TextEditingController _confirmPasswordController =
      TextEditingController();

  bool _isSubmitting = false;
  bool _codeVerified = false;

  @override
  void dispose() {
    _codeController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  bool _isPasswordStrong(String value) {
    if (value.trim().length < 8) {
      return false;
    }
    final hasLetter = RegExp(r'[A-Za-z]').hasMatch(value);
    final hasNumber = RegExp('[0-9]').hasMatch(value);
    return hasLetter && hasNumber;
  }

  Future<void> _handleSubmit() async {
    if (_isSubmitting) return;

    FocusScope.of(context).unfocus();

    final code = _codeController.text.trim();
    final sanitizedCode = code.replaceAll(RegExp('[^0-9]'), '');

    if (sanitizedCode.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('El código debe tener 6 dígitos'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    if (!_codeVerified) {
      await _verifyCode(sanitizedCode);
      return;
    }

    final newPassword = _newPasswordController.text;
    final confirmPassword = _confirmPasswordController.text;

    if (newPassword.isEmpty || confirmPassword.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Por favor completa todos los campos'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    if (newPassword != confirmPassword) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Las contraseñas no coinciden'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    if (!_isPasswordStrong(newPassword)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'La contraseña debe tener al menos 8 caracteres e incluir letras y números.',
          ),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      await ApiClient.resetPasswordWithCode(
        dni: widget.dni,
        correo: widget.correo,
        codigo: sanitizedCode,
        nuevaClave: newPassword.trim(),
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Tu contraseña ha sido actualizada correctamente.'),
          backgroundColor: Colors.green,
        ),
      );

      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
        (route) => false,
      );
    } on ApiException catch (error) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message), backgroundColor: Colors.red),
      );
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'No se pudo actualizar la contraseña. Inténtalo nuevamente.',
          ),
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

  Future<void> _verifyCode(String code) async {
    setState(() {
      _isSubmitting = true;
    });

    try {
      await ApiClient.verifyPasswordRecoveryCode(
        dni: widget.dni,
        correo: widget.correo,
        codigo: code,
      );

      if (!mounted) return;

      setState(() {
        _codeVerified = true;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Código verificado correctamente.'),
          backgroundColor: Colors.green,
        ),
      );
    } on ApiException catch (error) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message), backgroundColor: Colors.red),
      );
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'No se pudo verificar el código. Inténtalo nuevamente.',
          ),
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
    final buttonText =
        _codeVerified ? 'Actualizar Contraseña' : 'Verificar Código';

    return Scaffold(
      body: Stack(
        children: [
          Container(
            width: double.infinity,
            color: AppColors.buttonColor,
            child: const Column(
              mainAxisAlignment: MainAxisAlignment.start,
              children: [
                SizedBox(height: 100),
                Text1(text1: 'LegalBot', color: Colors.white, size: 32),
              ],
            ),
          ),
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
                        Text(
                          _codeVerified
                              ? 'Ingresa una nueva contraseña segura para tu cuenta.'
                              : 'Ingresa el código de 6 dígitos enviado a tu correo registrado.',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 16,
                            color: Colors.grey,
                          ),
                        ),
                        const SizedBox(height: 30),
                        TextFormField(
                          controller: _codeController,
                          readOnly: _codeVerified,
                          keyboardType: TextInputType.number,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(6),
                          ],
                          decoration: InputDecoration(
                            labelText: 'Código de verificación',
                            prefixIcon: Icon(
                              Icons.security,
                              color: AppColors.buttonColor,
                            ),
                            border: const OutlineInputBorder(),
                            focusedBorder: const OutlineInputBorder(
                              borderSide: BorderSide(
                                color: AppColors.buttonColor,
                                width: 2,
                              ),
                            ),
                            suffixIcon:
                                _codeVerified
                                    ? const Icon(
                                      Icons.check_circle,
                                      color: Colors.green,
                                    )
                                    : null,
                          ),
                        ),
                        if (_codeVerified)
                          const Padding(
                            padding: EdgeInsets.only(top: 12.0),
                            child: Text(
                              'Código validado. Ahora puedes actualizar tu contraseña.',
                              style: TextStyle(color: Colors.green),
                            ),
                          )
                        else
                          const SizedBox(height: 12),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _newPasswordController,
                          enabled: _codeVerified,
                          obscureText: true,
                          decoration: const InputDecoration(
                            labelText: 'Nueva contraseña',
                            prefixIcon: Icon(
                              Icons.lock,
                              color: AppColors.buttonColor,
                            ),
                            border: OutlineInputBorder(),
                            focusedBorder: OutlineInputBorder(
                              borderSide: BorderSide(
                                color: AppColors.buttonColor,
                                width: 2,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                        TextFormField(
                          controller: _confirmPasswordController,
                          enabled: _codeVerified,
                          obscureText: true,
                          decoration: const InputDecoration(
                            labelText: 'Confirmar nueva contraseña',
                            prefixIcon: Icon(
                              Icons.lock,
                              color: AppColors.buttonColor,
                            ),
                            border: OutlineInputBorder(),
                            focusedBorder: OutlineInputBorder(
                              borderSide: BorderSide(
                                color: AppColors.buttonColor,
                                width: 2,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 30),
                        CustomButton(
                          text: _isSubmitting ? 'Procesando...' : buttonText,
                          onTap: _isSubmitting ? null : _handleSubmit,
                        ),
                        const SizedBox(height: 20),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Text('¿Recordaste tu clave? '),
                            GestureDetector(
                              onTap: () {
                                Navigator.pushAndRemoveUntil(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => const LoginScreen(),
                                  ),
                                  (route) => false,
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
