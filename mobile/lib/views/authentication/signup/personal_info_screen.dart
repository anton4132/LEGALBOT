import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:legalserviceapp/constants/colors.dart';
import 'package:legalserviceapp/widgets/custombtn.dart';
import 'contact_info_screen.dart';

class PersonalInfoScreen extends StatefulWidget {
  final String userType;
  
  const PersonalInfoScreen({super.key, required this.userType});

  @override
  State<PersonalInfoScreen> createState() => _PersonalInfoScreenState();
}

class _PersonalInfoScreenState extends State<PersonalInfoScreen> {
  final TextEditingController _primerNombreController = TextEditingController();
  final TextEditingController _segundoNombreController = TextEditingController();
  final TextEditingController _apellidoPaternoController = TextEditingController();
  final TextEditingController _apellidoMaternoController = TextEditingController();

  Widget _buildCustomTextField({
    required TextEditingController controller,
    required String label,
    TextInputType? keyboardType,
    List<TextInputFormatter>? inputFormatters,
    int? maxLength,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        inputFormatters: inputFormatters,
        maxLength: maxLength,
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
        ),
      ),
    );
  }

  void _nextStep() {
    if (_validateFields()) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => ContactInfoScreen(
            userType: widget.userType,
            personalInfo: {
              'primerNombre': _primerNombreController.text,
              'segundoNombre': _segundoNombreController.text,
              'apellidoPaterno': _apellidoPaternoController.text,
              'apellidoMaterno': _apellidoMaternoController.text,
            },
          ),
        ),
      );
    }
  }

  bool _validateFields() {
    if (_primerNombreController.text.isEmpty ||
        _apellidoPaternoController.text.isEmpty ||
        _apellidoMaternoController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Por favor completa los campos obligatorios'),
          backgroundColor: Colors.red,
        ),
      );
      return false;
    }
    return true;
  }

  @override
  void dispose() {
    _primerNombreController.dispose();
    _segundoNombreController.dispose();
    _apellidoPaternoController.dispose();
    _apellidoMaternoController.dispose();
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
                      child: const Icon(Icons.person, color: Colors.white, size: 20),
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
                      child: const Icon(Icons.security, color: Colors.white, size: 20),
                    ),
                  ],
                ),
                
                const SizedBox(height: 30),
                
                const Text(
                  'Información Personal',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Completa tus datos personales',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.white.withOpacity(0.8),
                  ),
                ),
                
                const SizedBox(height: 40),
                
                // Información Personal Container
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
                          Icon(Icons.person, color: AppColors.buttonColor, size: 24),
                          const SizedBox(width: 10),
                          Text(
                            'Datos Personales',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: AppColors.buttonColor,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      
                      // Nombres
                      Row(
                        children: [
                          Expanded(
                            child: _buildCustomTextField(
                              controller: _primerNombreController,
                              label: 'Primer Nombre *',
                            ),
                          ),
                          const SizedBox(width: 15),
                          Expanded(
                            child: _buildCustomTextField(
                              controller: _segundoNombreController,
                              label: 'Segundo Nombre',
                            ),
                          ),
                        ],
                      ),
                      
                      // Apellidos
                      Row(
                        children: [
                          Expanded(
                            child: _buildCustomTextField(
                              controller: _apellidoPaternoController,
                              label: 'Apellido Paterno *',
                            ),
                          ),
                          const SizedBox(width: 15),
                          Expanded(
                            child: _buildCustomTextField(
                              controller: _apellidoMaternoController,
                              label: 'Apellido Materno *',
                            ),
                          ),
                        ],
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
                    text: 'Siguiente',
                    onTap: _nextStep,
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