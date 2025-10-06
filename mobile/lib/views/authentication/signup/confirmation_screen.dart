import 'package:flutter/material.dart';
import '../../../constants/colors.dart';
import '../../../widgets/custombtn.dart';
import '../../../services/api_client.dart';
import '../login_screen.dart';

class ConfirmationScreen extends StatefulWidget {
  final String userType;
  final Map<String, String> personalInfo;
  final Map<String, String> contactInfo;
  final String password;
  final Map<String, dynamic>? verification;


  
  const ConfirmationScreen({
     super.key,
    required this.userType, 
    required this.personalInfo,
    required this.contactInfo,
    required this.password,
    this.verification,

  });

  @override
  State<ConfirmationScreen> createState() => _ConfirmationScreenState();
}

class _ConfirmationScreenState extends State<ConfirmationScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    );
    _fadeAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 1),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOut,
    ));
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool _isSubmitting = false;

  Future<void> _completeRegistration() async {
    setState(() => _isSubmitting = true);
    try {
      await ApiClient.signup(
        userType: widget.userType,
        personalInfo: widget.personalInfo,
        contactInfo: widget.contactInfo,
        password: widget.password,
      );
      if (!mounted) return;
      _showSnackBar(
        '¡Registro exitoso! Redirigiendo al login...',
        backgroundColor: Colors.green,
      );
      Future.delayed(const Duration(seconds: 2), () {
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(
            builder: (context) => const LoginScreen(),
          ),
          (route) => false,
        );
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      final friendlyMessage = _mapSignupError(error);
      _showSnackBar(friendlyMessage);
    } catch (error) {
      if (!mounted) return;
      final message = error.toString().replaceFirst('Exception: ', '');
      _showSnackBar(
        message.isNotEmpty
            ? message
            : 'No se pudo completar el registro. Inténtalo nuevamente.',

      );
    }finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  

  void _showSnackBar(String message, {Color backgroundColor = Colors.red}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: backgroundColor,
      ),
    );
  }

  String _mapSignupError(ApiException error) {
    final rawMessage = error.message.trim();
    final statusCode = error.statusCode;
    final message = rawMessage.isNotEmpty ? rawMessage : 'No se pudo completar el registro.';

    if (statusCode == 409) {
      if (message.contains('ya posee un usuario con ese rol') ||
          message.contains('ya tiene una cuenta con ese rol')) {
        return 'La persona ya se encuentra registrada.';
      }
      if (message.contains('DNI y correo pertenecen a personas diferentes')) {
        return 'El DNI y el correo corresponden a distintas personas registradas.';
      }
    }

    if (statusCode == 400) {
      if (message.contains('DNI')) return message;
      if (message.contains('correo') || message.contains('rol_id') || message.contains('Faltan')) {
        return message;
      }
    }

    if (statusCode == 404 &&
        message.contains('Persona no encontrada')) {
      return 'No se encontró la persona para completar el registro.';
    }

    if (statusCode == 500) {
      return 'Ocurrió un error en el servidor al crear la cuenta. Inténtalo más tarde.';
    }

    return message;
  }


  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.buttonColor,
        foregroundColor: Colors.white,
        title: const Text('Confirmar Registro'),
        elevation: 0,
        automaticallyImplyLeading: false,
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.buttonColor, Colors.white],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 20),
                
                // Progress indicator - Todos completados
                Row(
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: AppColors.buttonColor,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.check, color: Colors.white, size: 20),
                    ),
                    Expanded(
                      child: Container(
                        height: 3,
                        color: AppColors.buttonColor,
                        margin: const EdgeInsets.symmetric(horizontal: 10),
                      ),
                    ),
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: AppColors.buttonColor,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.check, color: Colors.white, size: 20),
                    ),
                    Expanded(
                      child: Container(
                        height: 3,
                        color: AppColors.buttonColor,
                        margin: const EdgeInsets.symmetric(horizontal: 10),
                      ),
                    ),
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: AppColors.buttonColor,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.check, color: Colors.white, size: 20),
                    ),
                  ],
                ),
                
                const SizedBox(height: 40),
                
                // Icono de éxito
                Center(
                  child: SlideTransition(
                    position: _slideAnimation,
                    child: FadeTransition(
                      opacity: _fadeAnimation,
                      child: Container(
                        width: 120,
                        height: 120,
                        decoration: BoxDecoration(
                          color: Colors.green.shade100,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.check_circle,
                          size: 80,
                          color: Colors.green.shade600,
                        ),
                      ),
                    ),
                  ),
                ),
                
                const SizedBox(height: 30),
                
                // Título de confirmación
                Center(
                  child: FadeTransition(
                    opacity: _fadeAnimation,
                    child: const Text(
                      '¡Registro Completado!',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
                
                const SizedBox(height: 10),
                
                Center(
                  child: FadeTransition(
                    opacity: _fadeAnimation,
                    child: Text(
                      'Revisa tus datos antes de confirmar',
                      style: TextStyle(
                        fontSize: 16,
                        color: Colors.white.withOpacity(0.8),
                      ),
                    ),
                  ),
                ),
                
                const SizedBox(height: 40),
                
                // Resumen de datos
                SlideTransition(
                  position: _slideAnimation,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(15),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.grey.withOpacity(0.2),
                          spreadRadius: 1,
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.person, color: AppColors.buttonColor, size: 24),
                            const SizedBox(width: 10),
                            Text(
                              'Resumen de Datos',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: AppColors.buttonColor,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),
                        
                        // Tipo de usuario
                        _buildInfoRow('Tipo de Usuario', widget.userType == 'abogado' ? 'Abogado' : 'Cliente'),
                        
                        // Información personal
                        _buildInfoRow('Primer Nombre', widget.personalInfo['primerNombre'] ?? ''),
                        _buildInfoRow('Segundo Nombre', widget.personalInfo['segundoNombre'] ?? ''),
                        _buildInfoRow('Apellido Paterno', widget.personalInfo['apellidoPaterno'] ?? ''),
                        _buildInfoRow('Apellido Materno', widget.personalInfo['apellidoMaterno'] ?? ''),
                        
                                             
                        // Información de contacto
                        _buildInfoRow('DNI', widget.contactInfo['dni'] ?? ''),
                        _buildInfoRow('Teléfono', widget.contactInfo['phone'] ?? ''),
                        _buildInfoRow('Email', widget.contactInfo['email'] ?? ''),
                        _buildInfoRow('Dirección exacta',
                            widget.contactInfo['lineaExactaDireccion'] ?? ''),
                        _buildInfoRow(
                          'Código Ubigeo',
                          widget.contactInfo['ubigeoCodigo'] ?? '',
                        ),

                        if (widget.verification != null) ...[
                          const Divider(height: 32),
                          _buildVerificationSummary(),
                        ]
                      ],
                    ),
                  ),
                ),
                
                const SizedBox(height: 30),
                
                // Botón confirmar
                SlideTransition(
                  position: _slideAnimation,
                  child: SizedBox(
                    width: double.infinity,
                    height: 55,
                    child: CustomButton(
                      text: _isSubmitting
                          ? 'Enviando...'
                          : 'Confirmar Registro',
                      onTap: _isSubmitting ? null : _completeRegistration,
                       color: _isSubmitting
                          ? Colors.grey.shade400
                          : AppColors.buttonColor,
                    ),
                  ),
                ),
                
                const SizedBox(height: 20),
                
                // Botón volver
                SlideTransition(
                  position: _slideAnimation,
                  child: SizedBox(
                    width: double.infinity,
                    height: 55,
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: AppColors.buttonColor),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text(
                        'Editar Datos',
                        style: TextStyle(
                          color: AppColors.buttonColor,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              '$label:',
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                color: Colors.grey,
                fontSize: 14,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value.isNotEmpty ? value : 'No especificado',
              style: const TextStyle(
                fontSize: 14,
                color: Colors.black87,
              ),
            ),
          ),
        ],
      ),
    );
  }
 Widget _buildVerificationSummary() {
    final lookup = (widget.verification?['dniLookup'] as Map<String, dynamic>?) ??
        const <String, dynamic>{};
    final numero = (lookup['numero'] ?? widget.contactInfo['dni'] ?? '').toString();
    final padronNombre = [
      lookup['primerNombre'],
      lookup['segundoNombre'],
      lookup['apellidoPaterno'],
      lookup['apellidoMaterno'],
    ]
        .map((value) => value is String ? value.trim() : (value?.toString().trim() ?? ''))
        .where((value) => value.isNotEmpty)
        .join(' ');

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.green.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.green.shade200),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.verified, color: Colors.green.shade700, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Identidad verificada',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Colors.green.shade800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'DNI validado: $numero',
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.green.shade700,
                  ),
                ),
                if (padronNombre.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    'Nombres según padrón: $padronNombre',
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.green.shade700,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}