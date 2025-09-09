import 'package:flutter/material.dart';
import '../../../Constants/colors.dart';
import '../../../Widgets/custombtn.dart';
import '../login_screen.dart';

class ConfirmationScreen extends StatefulWidget {
  final String userType;
  final Map<String, String> personalInfo;
  final Map<String, String> contactInfo;
  final String password;
  
  const ConfirmationScreen({
    super.key, 
    required this.userType, 
    required this.personalInfo,
    required this.contactInfo,
    required this.password,
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

  void _completeRegistration() {
    // Aquí iría la lógica para enviar datos al backend
    // Por ahora solo simulamos el registro exitoso
    
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('¡Registro exitoso! Redirigiendo al login...'),
        backgroundColor: Colors.green,
      ),
    );
    
    // Redirigir al login después de 2 segundos
    Future.delayed(const Duration(seconds: 2), () {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(
          builder: (context) => const LoginScreen(),
        ),
        (route) => false, // Esto elimina todas las pantallas anteriores
      );
    });
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
                        
                        // Especialidad solo para abogados
                        if (widget.userType == 'abogado')
                          _buildInfoRow('Especialidad', widget.contactInfo['especialidad'] ?? ''),
                        
                        // Información de contacto
                        _buildInfoRow('DNI', widget.contactInfo['dni'] ?? ''),
                        _buildInfoRow('Teléfono', widget.contactInfo['phone'] ?? ''),
                        _buildInfoRow('Email', widget.contactInfo['email'] ?? ''),
                        _buildInfoRow('Dirección', widget.contactInfo['direccion'] ?? ''),
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
                      text: 'Confirmar Registro',
                      onTap: _completeRegistration,
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
} 