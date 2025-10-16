import 'package:flutter/material.dart';
import '../../../constants/colors.dart';
import '../../../widgets/custombtn.dart';
import '../../../services/api_client.dart';
import 'confirmation_screen.dart';

class SecurityScreen extends StatefulWidget {
  final String userType;
  final Map<String, String> personalInfo;
  final Map<String, String> contactInfo;
  final Map<String, dynamic>? verification;

  
  const SecurityScreen({
    super.key,
    required this.userType,
    required this.personalInfo,
    required this.contactInfo,
    required this.verification,
  });

  @override
  State<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends State<SecurityScreen> {
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _isSubmitting = false;

   bool get _hasValidVerification {
    final verification = widget.verification;
    if (verification == null) return false;
    final dniMatch = verification['dniMatch'] == true;
    final conflictsCleared = verification['conflictsCleared'] == true;
    return dniMatch && conflictsCleared;
  }

  String get _verificationStatusMessage {
    if (widget.verification == null) {
      return 'Debes validar tu identidad con RENIEC antes de crear tu clave.';
    }
    if (widget.verification?['dniMatch'] != true) {
      return 'Los datos ingresados no coinciden con el padrón RENIEC.';
    }
    if (widget.verification?['conflictsCleared'] != true) {
      return 'Aún existen datos duplicados por resolver antes de continuar.';
    }
    return 'Identidad validada correctamente.';
  }


  Widget _buildCustomTextField({
    required TextEditingController controller,
    required String label,
    required bool obscureText,
    VoidCallback? onToggleVisibility,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      child: TextFormField(
        controller: controller,
        obscureText: obscureText,
        keyboardType: TextInputType.visiblePassword,
        enableSuggestions: false,
        autocorrect: false,
        decoration: InputDecoration(
          labelText: label,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade300),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade300),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: AppColors.buttonColor, width: 2),
          ),
          filled: true,
          fillColor: Colors.grey.shade50,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          suffixIcon: IconButton(
            icon: Icon(
              obscureText ? Icons.visibility : Icons.visibility_off,
              color: Colors.grey.shade600,
            ),
            onPressed: onToggleVisibility,
          ),
        ),
      ),
    );
  }

  Future<void> _submitRegistration() async {
    if (!_hasValidVerification) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_verificationStatusMessage),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    if (!_validateFields()) {
      return;
    }

    final password = _passwordController.text;

    setState(() {
      _isSubmitting = true;
    });

    try {
      await ApiClient.signup(
        userType: widget.userType,
        personalInfo: widget.personalInfo,
        contactInfo: widget.contactInfo,
        password: password,
      );

      if (!mounted) return;

      await Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => ConfirmationScreen(
            userType: widget.userType,
            personalInfo: widget.personalInfo,
            contactInfo: widget.contactInfo,
            verification: widget.verification,
            success: true,
            message:
                '¡Registro exitoso! Tu cuenta ha sido creada correctamente.',
          ),
        ),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      final message = error.message.isNotEmpty
          ? error.message
          : 'No se pudo completar el registro.';
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => ConfirmationScreen(
            userType: widget.userType,
            personalInfo: widget.personalInfo,
            contactInfo: widget.contactInfo,
            verification: widget.verification,
            success: false,
            message: message,
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      final message = error.toString().replaceFirst('Exception: ', '');
      final fallback = message.isNotEmpty
          ? message
          : 'No se pudo completar el registro. Inténtalo nuevamente.';
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => ConfirmationScreen(
            userType: widget.userType,
            personalInfo: widget.personalInfo,
            contactInfo: widget.contactInfo,
            verification: widget.verification,
            success: false,
            message: fallback,
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  bool _validateFields() {
    if (_passwordController.text.isEmpty || _confirmPasswordController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Por favor completa ambos campos de contraseña'),
          backgroundColor: Colors.red,
        ),
      );
      return false;
    }

    if (_passwordController.text.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('La clave debe tener al menos 6 caracteres'),
          backgroundColor: Colors.red,
        ),
      );
      return false;
    }

    if (_passwordController.text != _confirmPasswordController.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Las claves no coinciden'),
          backgroundColor: Colors.red,
        ),
      );
      return false;
    }

    return true;
  }

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.buttonColor,
        foregroundColor: Colors.white,
        title: Text(
          widget.userType == 'abogado' ? 'Registro de Abogado' : 'Registro de Cliente',
        ),
        elevation: 0,
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
                
                // Progress indicator
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
                      child: const Icon(Icons.security, color: Colors.white, size: 20),
                    ),
                  ],
                ),
                
                const SizedBox(height: 30),
                
                const Text(
                  'Seguridad',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Crea tu clave de acceso',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.white.withOpacity(0.8),
                  ),
                ),
                
                const SizedBox(height: 40),
                
                // Seguridad Container
                Container(
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
                          Icon(Icons.security, color: AppColors.buttonColor, size: 24),
                          const SizedBox(width: 10),
                          Text(
                            'Clave de Acceso',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: AppColors.buttonColor,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),

                       Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: _hasValidVerification
                              ? Colors.green.shade50
                              : Colors.orange.shade50,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: _hasValidVerification
                                ? Colors.green.shade200
                                : Colors.orange.shade200,
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              _hasValidVerification
                                  ? Icons.verified
                                  : Icons.warning_amber_outlined,
                              color: _hasValidVerification
                                  ? Colors.green.shade700
                                  : Colors.orange.shade700,
                              size: 20,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                _verificationStatusMessage,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: _hasValidVerification
                                      ? Colors.green.shade800
                                      : Colors.orange.shade800,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 20),
                      
                      // Contraseña
                      _buildCustomTextField(
                        controller: _passwordController,
                        label: 'Clave (mínimo 6 caracteres) *',
                        obscureText: _obscurePassword,
                        onToggleVisibility: () {
                          setState(() {
                            _obscurePassword = !_obscurePassword;
                          });
                        },
                      ),
                      
                      // Confirmar contraseña
                      _buildCustomTextField(
                        controller: _confirmPasswordController,
                        label: 'Confirmar Clave *',
                        obscureText: _obscureConfirmPassword,
                        onToggleVisibility: () {
                          setState(() {
                            _obscureConfirmPassword = !_obscureConfirmPassword;
                          });
                        },
                      ),
                      
                      const SizedBox(height: 15),
                      
                      // Información de seguridad
                      Container(
                        padding: const EdgeInsets.all(15),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Colors.blue.shade200),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.info_outline, color: Colors.blue.shade600, size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Tu clave debe tener al menos 6 caracteres.',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.blue.shade700,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: 30),
                
                // Botón siguiente
                SizedBox(
                  width: double.infinity,
                  height: 55,
                  child: CustomButton(
                    text: _isSubmitting ? 'Creando cuenta...' : 'Crear Cuenta',
                    onTap: _hasValidVerification && !_isSubmitting
                        ? _submitRegistration
                        : null,
                    color: _hasValidVerification && !_isSubmitting
                        ? AppColors.buttonColor
                        : Colors.grey.shade400,
                  ),
                ),
                
                const SizedBox(height: 20),
                
                // Botón volver
                SizedBox(
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
                      'Volver',
                      style: TextStyle(
                        color: AppColors.buttonColor,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
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
} 