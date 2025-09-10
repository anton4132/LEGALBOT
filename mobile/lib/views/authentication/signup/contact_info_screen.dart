import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../Constants/colors.dart';
import '../../../Widgets/custombtn.dart';
import '../../../services/api_client.dart';
import 'security_screen.dart';

class ContactInfoScreen extends StatefulWidget {
  final String userType;
  final Map<String, String> personalInfo;
  
  const ContactInfoScreen({
    super.key, 
    required this.userType, 
    required this.personalInfo,
  });

  @override
  State<ContactInfoScreen> createState() => _ContactInfoScreenState();
}

class _ContactInfoScreenState extends State<ContactInfoScreen> {
  final TextEditingController _dniController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _direccionController = TextEditingController();
  List<Map<String, dynamic>> _especialidades = [];
  int? _selectedEspecialidadId;
  String? _selectedEspecialidadNombre;
  bool _loadingEspecialidades = false;


  @override
  void initState() {
    super.initState();
    if (widget.userType == 'abogado') {
      _fetchEspecialidades();
    }
  }

  Future<void> _fetchEspecialidades() async {
    setState(() => _loadingEspecialidades = true);
    try {
      final data = await ApiClient.fetchEspecialidades();
      setState(() => _especialidades = data);
    } catch (_) {
      // ignore error
    } finally {
      setState(() => _loadingEspecialidades = false);
    }
  }
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
          builder: (context) => SecurityScreen(
            userType: widget.userType,
            personalInfo: widget.personalInfo,
            contactInfo: {
              'dni': _dniController.text,
              'phone': _phoneController.text,
              'email': _emailController.text,
              'direccion': _direccionController.text,
              'especialidadId': widget.userType == 'abogado'
                  ? (_selectedEspecialidadId?.toString() ?? '')
                  : '',
              'especialidadNombre': widget.userType == 'abogado'
                  ? (_selectedEspecialidadNombre ?? '')
                  : '',
            },
          ),
        ),
      );
    }
  }

  bool _validateFields() {
    if (_dniController.text.isEmpty ||
        _phoneController.text.isEmpty ||
        _emailController.text.isEmpty ||
        _direccionController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Por favor completa todos los campos obligatorios'),
          backgroundColor: Colors.red,
        ),
      );
      return false;
    }

        if (widget.userType == 'abogado' && _selectedEspecialidadId == null) {     
        ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Por favor selecciona tu especialidad legal'),
          backgroundColor: Colors.red,
        ),
      );
      return false;
    }

    return true;
  }

  @override
  void dispose() {
    _dniController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _direccionController.dispose();
    super.dispose();
  }
  Widget _buildEspecialidadDropdown() {
    if (_loadingEspecialidades) {
      return const Center(child: CircularProgressIndicator());
    }
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      child: DropdownButtonFormField<int>(
        value: _selectedEspecialidadId,
        items: _especialidades
            .map<DropdownMenuItem<int>>((e) => DropdownMenuItem<int>(
                  value: e['id'] as int,
                  child: Text(e['nombre'] as String),
                ))
            .toList(),
          onChanged: (value) => setState(() {
              _selectedEspecialidadId = value;
              _selectedEspecialidadNombre =
                  _especialidades.firstWhere((e) => e['id'] == value)['nombre']
                      as String;
            }),
          decoration: InputDecoration(
          labelText: 'Especialidad',
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade300),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade300),
          ),
          focusedBorder: const OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(12)),
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
                  'Información de Contacto',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Completa tus datos de contacto',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.white.withOpacity(0.8),
                  ),
                ),
                
                const SizedBox(height: 40),
                
                // Especialidad solo para abogados
                if (widget.userType == 'abogado') ...[
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
                            Icon(Icons.work, color: AppColors.buttonColor, size: 24),
                            const SizedBox(width: 10),
                            Text(
                              'Información Profesional',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: AppColors.buttonColor,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),
                        _buildEspecialidadDropdown(),
                      ],
                    ),
                  ),
                  const SizedBox(height: 25),
                ],
                
                // Información de Contacto
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
                          Icon(Icons.contact_phone, color: AppColors.buttonColor, size: 24),
                          const SizedBox(width: 10),
                          Text(
                            'Datos de Contacto',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: AppColors.buttonColor,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      
                      // DNI
                      _buildCustomTextField(
                        controller: _dniController,
                        label: 'DNI *',
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(8),
                        ],
                        maxLength: 8,
                      ),
                      
                      // Teléfono
                      _buildCustomTextField(
                        controller: _phoneController,
                        label: 'Número de Teléfono *',
                        keyboardType: TextInputType.phone,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(10),
                        ],
                        maxLength: 10,
                      ),
                      
                      // Email
                      _buildCustomTextField(
                        controller: _emailController,
                        label: 'Correo Electrónico *',
                        keyboardType: TextInputType.emailAddress,
                      ),
                      
                      // Dirección
                      _buildCustomTextField(
                        controller: _direccionController,
                        label: 'Dirección *',
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