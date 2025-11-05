import 'package:flutter/material.dart';
import '../../../constants/colors.dart';
import '../../../widgets/custombtn.dart';
import 'security_screen.dart';

class PersonalInfoScreen extends StatelessWidget {
  final String userType;
  final Map<String, String> personalInfo;
  final Map<String, String> contactInfo;
  final Map<String, dynamic>? verification;

  const PersonalInfoScreen({
    super.key,
    required this.userType,
    required this.personalInfo,
    required this.contactInfo,
    this.verification,
  });

  String _fallback(Map<String, String> source, String key) {
    return source[key]?.trim() ?? '';
  }

  Map<String, String> _normalizedPersonalInfo() {
    return {
      'primerNombre': _fallback(personalInfo, 'primerNombre'),
      'segundoNombre': _fallback(personalInfo, 'segundoNombre'),
      'apellidoPaterno': _fallback(personalInfo, 'apellidoPaterno'),
      'apellidoMaterno': _fallback(personalInfo, 'apellidoMaterno'),
    };
  }

  Widget _buildReadOnlyField(String label, String value) {
    final displayValue = value.isNotEmpty ? value : 'No disponible';
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      child: TextFormField(
        initialValue: displayValue,
        readOnly: true,
        enableInteractiveSelection: false,
        decoration: InputDecoration(
          labelText: label,
          suffixIcon: const Icon(Icons.lock_outline, color: Colors.grey),
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
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        ),
      ),
    );
  }

  List<Widget> _buildNameFields(String primerNombre, String segundoNombre) {
    final hasPrimer = primerNombre.isNotEmpty;
    final hasSegundo = segundoNombre.isNotEmpty;

    if (hasPrimer && hasSegundo) {
      return [
        Row(
          children: [
            Expanded(
              child: _buildReadOnlyField('Primer Nombre', primerNombre),
            ),
            const SizedBox(width: 15),
            Expanded(
              child: _buildReadOnlyField('Segundo Nombre', segundoNombre),
            ),
          ],
        ),
      ];
    }

    if (hasPrimer) {
      return [_buildReadOnlyField('Nombre', primerNombre)];
    }

    if (hasSegundo) {
      return [_buildReadOnlyField('Nombre', segundoNombre)];
    }

    return [_buildReadOnlyField('Nombre', '')];
  }

  List<Widget> _buildLastNameFields(String apellidoPaterno, String apellidoMaterno) {
    final hasPaterno = apellidoPaterno.isNotEmpty;
    final hasMaterno = apellidoMaterno.isNotEmpty;

    if (hasPaterno && hasMaterno) {
      return [
        Row(
          children: [
            Expanded(
              child: _buildReadOnlyField('Apellido Paterno', apellidoPaterno),
            ),
            const SizedBox(width: 15),
            Expanded(
              child: _buildReadOnlyField('Apellido Materno', apellidoMaterno),
            ),
          ],
        ),
      ];
    }

    final fields = <Widget>[];
    if (hasPaterno) {
      fields.add(_buildReadOnlyField('Apellido Paterno', apellidoPaterno));
    }
    if (hasMaterno) {
      fields.add(_buildReadOnlyField('Apellido Materno', apellidoMaterno));
    }

    if (fields.isEmpty) {
      fields.add(_buildReadOnlyField('Apellidos', ''));
    }

    return fields;
  }

  void _goToSecurity(BuildContext context, Map<String, String> sanitizedPersonalInfo) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => SecurityScreen(
          userType: userType,
          personalInfo: sanitizedPersonalInfo,
          contactInfo: contactInfo,
          verification: verification,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final sanitizedPersonalInfo = _normalizedPersonalInfo();
    final primerNombre = sanitizedPersonalInfo['primerNombre'] ?? '';
    final segundoNombre = sanitizedPersonalInfo['segundoNombre'] ?? '';
    final apellidoPaterno = sanitizedPersonalInfo['apellidoPaterno'] ?? '';
    final apellidoMaterno = sanitizedPersonalInfo['apellidoMaterno'] ?? '';
    final dni = contactInfo['dni'] ?? '';

    final helperText = dni.isNotEmpty
        ? 'Datos obtenidos automáticamente para el DNI $dni.'
        : 'Datos obtenidos automáticamente del padrón oficial.';

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.buttonColor,
        foregroundColor: Colors.white,
        title: Text(
          userType == 'abogado' ? 'Registro de Abogado' : 'Registro de Cliente',
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
                Row(
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: AppColors.buttonColor,
                        shape: BoxShape.circle,
                      ),
                      child:
                          const Icon(Icons.check, color: Colors.white, size: 20),
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
                      child:
                          const Icon(Icons.person, color: Colors.white, size: 20),
                    ),
                    Expanded(
                      child: Container(
                        height: 3,
                        color: Colors.grey.shade300,
                        margin: const EdgeInsets.symmetric(horizontal: 10),
                      ),
                    ),
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.security,
                          color: Colors.white, size: 20),
                    ),
                  ],
                ),
                const SizedBox(height: 30),
                const Text(
                  'Verifica tu identidad',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Confirma que los datos mostrados coinciden contigo.',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.white.withOpacity(0.8),
                  ),
                ),
                const SizedBox(height: 40),
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
                          Icon(Icons.badge,
                              color: AppColors.buttonColor, size: 24),
                          const SizedBox(width: 10),
                          Text(
                            'Datos personales',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: AppColors.buttonColor,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      ..._buildNameFields(primerNombre, segundoNombre),
                      ..._buildLastNameFields(apellidoPaterno, apellidoMaterno),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Colors.blue.shade200),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.info_outline,
                                color: Colors.blue.shade600, size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                helperText,
                                style: TextStyle(
                                  fontSize: 13,
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
                SizedBox(
                  width: double.infinity,
                  height: 55,
                  child: CustomButton(
                    text: 'Sí, soy yo',
                    onTap: () => _goToSecurity(context, sanitizedPersonalInfo),
                  ),
                ),
                const SizedBox(height: 20),
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
                      'No soy yo',
                      style: TextStyle(
                        color: AppColors.buttonColor,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Si los datos no coinciden, regresa y verifica tu DNI.',
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.white.withOpacity(0.8),
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}