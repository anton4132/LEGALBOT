import 'package:flutter/material.dart';
import '../../../constants/colors.dart';
import '../../../widgets/custombtn.dart';
import '../login_screen.dart';

class ConfirmationScreen extends StatefulWidget {
  final String userType;
  final Map<String, String> personalInfo;
  final Map<String, String> contactInfo;
  final Map<String, dynamic>? verification;
  final bool success;
  final String message;

  const ConfirmationScreen({
    super.key,
    required this.userType,
    required this.personalInfo,
    required this.contactInfo,
    required this.success,
    required this.message,
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

  Color get _statusColor =>
      widget.success ? Colors.green.shade600 : Colors.red.shade600;

  Color get _statusBackground =>
      widget.success ? Colors.green.shade100 : Colors.red.shade100;

  IconData get _statusIcon =>
      widget.success ? Icons.check_circle : Icons.error_outline;

  String get _title => widget.success
      ? '¡Registro completado!'
      : 'No pudimos completar el registro';

  String get _subtitle => widget.success
      ? 'Tu cuenta fue creada exitosamente. Revisa el resumen de tus datos.'
      : 'El registro no se completó. Revisa la información y vuelve a intentarlo.';

  String get _primaryButtonLabel =>
      widget.success ? 'Ir al login' : 'Volver a intentar';

  String get _secondaryButtonLabel => widget.success
      ? 'Registrar otro usuario'
      : 'Cancelar registro';

  void _handlePrimaryAction() {
    if (widget.success) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
        (route) => false,
      );
    } else {
      Navigator.pop(context);
    }
  }

  void _handleSecondaryAction() {
    Navigator.popUntil(context, (route) => route.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.buttonColor,
        foregroundColor: Colors.white,
        title: const Text('Resultado del registro'),
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
                        color: _statusColor,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(_statusIcon, color: Colors.white, size: 20),
                    ),
                  ],
                ),
                const SizedBox(height: 40),
                Center(
                  child: SlideTransition(
                    position: _slideAnimation,
                    child: FadeTransition(
                      opacity: _fadeAnimation,
                      child: Container(
                        width: 120,
                        height: 120,
                        decoration: BoxDecoration(
                          color: _statusBackground,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          _statusIcon,
                          size: 80,
                          color: _statusColor,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 30),
                Center(
                  child: FadeTransition(
                    opacity: _fadeAnimation,
                    child: Text(
                      _title,
                      style: const TextStyle(
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
                      _subtitle,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 16,
                        color: Colors.white.withOpacity(0.8),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 40),
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
                            Icon(Icons.person_outline,
                                color: AppColors.buttonColor, size: 24),
                            const SizedBox(width: 10),
                            Text(
                              'Resumen de datos',
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
                            color: widget.success
                                ? Colors.green.shade50
                                : Colors.red.shade50,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: widget.success
                                  ? Colors.green.shade200
                                  : Colors.red.shade200,
                            ),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                widget.success
                                    ? Icons.verified
                                    : Icons.error_outline,
                                color: widget.success
                                    ? Colors.green.shade700
                                    : Colors.red.shade700,
                                size: 20,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  widget.message,
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: widget.success
                                        ? Colors.green.shade800
                                        : Colors.red.shade800,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
                        _buildInfoRow('Tipo de usuario',
                            widget.userType == 'abogado' ? 'Abogado' : 'Cliente'),
                        _buildInfoRow(
                            'Primer nombre', widget.personalInfo['primerNombre'] ?? ''),
                        _buildInfoRow(
                            'Segundo nombre', widget.personalInfo['segundoNombre'] ?? ''),
                        _buildInfoRow('Apellido paterno',
                            widget.personalInfo['apellidoPaterno'] ?? ''),
                        _buildInfoRow('Apellido materno',
                            widget.personalInfo['apellidoMaterno'] ?? ''),
                        _buildInfoRow('DNI', widget.contactInfo['dni'] ?? ''),
                        _buildInfoRow('Teléfono', widget.contactInfo['phone'] ?? ''),
                        _buildInfoRow('Correo', widget.contactInfo['email'] ?? ''),
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
                SlideTransition(
                  position: _slideAnimation,
                  child: SizedBox(
                    width: double.infinity,
                    height: 55,
                    child: CustomButton(
                      text: _primaryButtonLabel,
                      onTap: _handlePrimaryAction,
                      color: widget.success
                          ? AppColors.buttonColor
                          : Colors.red.shade400,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                SlideTransition(
                  position: _slideAnimation,
                  child: SizedBox(
                    width: double.infinity,
                    height: 55,
                    child: OutlinedButton(
                      onPressed: _handleSecondaryAction,
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: AppColors.buttonColor),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Text(
                        _secondaryButtonLabel,
                        style: const TextStyle(
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
            width: 140,
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