import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../Constants/colors.dart';
import '../../../Widgets/custombtn.dart';
import 'security_screen.dart';

// Widgets que creamos antes:
import 'widgets/especialidades_selector.dart';
import 'widgets/disponibilidad_modal.dart';
import 'widgets/estudio_modal.dart';

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
  // Comunes
  final TextEditingController _dniController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _direccionController = TextEditingController();

  // Perfil Abogado
  final TextEditingController _tarifaBaseController = TextEditingController();
  final TextEditingController _duracionMinController = TextEditingController(text: '60');
  final TextEditingController _direccionAtencionController = TextEditingController();
  final TextEditingController _bioController = TextEditingController();

  // Estado para elementos compuestos (sólo abogado)
  List<int> _especialidadesIds = [];
  List<Map<String, dynamic>> _disponibilidad = []; // [{dia_semana, hora_inicio, hora_fin}, ...]
  Map<String, dynamic>? _estudio; // {ruc, nombre_comercial, ...}

  // ---------- Helpers UI ----------
  Widget _buildCustomTextField({
    required TextEditingController controller,
    required String label,
    TextInputType? keyboardType,
    List<TextInputFormatter>? inputFormatters,
    int? maxLength,
    int? maxLines,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        inputFormatters: inputFormatters,
        maxLength: maxLength,
        maxLines: maxLines ?? 1,
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

  // ---------- Validaciones ----------
  bool _validateFields() {
    // Comunes
    if (_dniController.text.isEmpty ||
        _phoneController.text.isEmpty ||
        _emailController.text.isEmpty ||
        _direccionController.text.isEmpty) {
      _err('Por favor completa todos los campos obligatorios');
      return false;
    }
    if (_dniController.text.length != 8) {
      _err('El DNI debe tener 8 dígitos');
      return false;
    }
    if (_phoneController.text.length < 9) {
      _err('El teléfono debe tener al menos 9 dígitos');
      return false;
    }

    // Abogado
    if (widget.userType == 'abogado') {
      // Tarifa base (decimal positivo)
      if (_tarifaBaseController.text.trim().isEmpty) {
        _err('La tarifa base es obligatoria');
        return false;
      }
      final tarifa = double.tryParse(_tarifaBaseController.text.replaceAll(',', '.'));
      if (tarifa == null || tarifa <= 0) {
        _err('Tarifa base inválida');
        return false;
      }

      // Duración
      final dur = int.tryParse(_duracionMinController.text);
      if (dur == null || dur < 15 || dur > 180) {
        _err('La duración por cita debe estar entre 15 y 180 minutos');
        return false;
      }

      // Dirección de atención
      if (_direccionAtencionController.text.trim().isEmpty) {
        _err('La dirección de atención es obligatoria');
        return false;
      }

      // Especialidades (opcional pero recomendado)
      if (_especialidadesIds.isEmpty) {
        // No bloquea, pero avisa
        _warn('No seleccionaste especialidades. Puedes agregarlas luego en tu perfil.');
      }

      // Disponibilidad (opcional, puede configurarse luego)
      // if (_disponibilidad.isEmpty) { ... } // opcional
    }

    return true;
  }

  void _err(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: Colors.red),
    );
  }

  void _warn(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: Colors.orange),
    );
  }

  // ---------- Navegación ----------
  void _nextStep() {
    if (!_validateFields()) return;

    final contactInfo = <String, dynamic>{
      // Comunes
      'dni': _dniController.text,
      'phone': _phoneController.text,
      'email': _emailController.text,
      'direccion': _direccionController.text,

      // Perfil abogado
      if (widget.userType == 'abogado') ...{
        'tarifaBase': _tarifaBaseController.text, // se convierte a Decimal en backend
        'duracionMinutos': _duracionMinController.text,
        'direccionAtencion': _direccionAtencionController.text,
        'bio': _bioController.text,
        'especialidadesIds': _especialidadesIds, // List<int>
        'disponibilidad': _disponibilidad,       // List<Map<String,dynamic>>
        'estudio': _estudio,                     // Map<String,dynamic>?
      }
    };

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => SecurityScreen(
          userType: widget.userType,
          personalInfo: widget.personalInfo,
          contactInfo: contactInfo.map((k, v) => MapEntry(k, v?.toString() ?? v)), // mantiene compat, pero pasaremos estructuras reales también
        ),
        settings: RouteSettings(
          // Para que ConfirmationScreen pueda leer estructuras reales sin parsear strings:
          arguments: {
            'contactInfoRaw': contactInfo, // envia el mapa crudo
          },
        ),
      ),
    );
  }

  // ---------- Lifecycle ----------
  @override
  void dispose() {
    _dniController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _direccionController.dispose();
    _tarifaBaseController.dispose();
    _duracionMinController.dispose();
    _direccionAtencionController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  // ---------- UI ----------
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
                      width: 30, height: 30,
                      decoration: const BoxDecoration(color: AppColors.buttonColor, shape: BoxShape.circle),
                      child: const Icon(Icons.check, color: Colors.white, size: 20),
                    ),
                    Expanded(child: Container(height: 3, color: AppColors.buttonColor, margin: const EdgeInsets.symmetric(horizontal: 10))),
                    Container(
                      width: 30, height: 30,
                      decoration: const BoxDecoration(color: AppColors.buttonColor, shape: BoxShape.circle),
                      child: const Icon(Icons.person, color: Colors.white, size: 20),
                    ),
                    Expanded(child: Container(height: 3, color: Colors.grey.shade300, margin: const EdgeInsets.symmetric(horizontal: 10))),
                    Container(
                      width: 30, height: 30,
                      decoration: BoxDecoration(color: Colors.grey.shade300, shape: BoxShape.circle),
                      child: const Icon(Icons.security, color: Colors.white, size: 20),
                    ),
                  ],
                ),

                const SizedBox(height: 30),

                const Text(
                  'Información de Contacto',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 10),
                Text(
                  'Completa tus datos de contacto',
                  style: TextStyle(fontSize: 16, color: Colors.white.withOpacity(0.8)),
                ),

                const SizedBox(height: 40),

                // ----- Sección Profesional (solo abogado) -----
                if (widget.userType == 'abogado') ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: _cardDecoration(),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _cardTitle(icon: Icons.work, title: 'Información Profesional'),
                        const SizedBox(height: 20),

                        // Tarifa base + duración
                        Row(
                          children: [
                            Expanded(
                              child: _buildCustomTextField(
                                controller: _tarifaBaseController,
                                label: 'Tarifa base (S/.) *',
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                inputFormatters: [
                                  FilteringTextInputFormatter.allow(RegExp(r'[0-9\.,]')),
                                  LengthLimitingTextInputFormatter(10),
                                ],
                              ),
                            ),
                            const SizedBox(width: 15),
                            Expanded(
                              child: _buildCustomTextField(
                                controller: _duracionMinController,
                                label: 'Duración por cita (min) *',
                                keyboardType: TextInputType.number,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                  LengthLimitingTextInputFormatter(3),
                                ],
                              ),
                            ),
                          ],
                        ),

                        // Dirección de atención
                        _buildCustomTextField(
                          controller: _direccionAtencionController,
                          label: 'Dirección de atención *',
                        ),

                        // Bio
                        _buildCustomTextField(
                          controller: _bioController,
                          label: 'Biografía / Presentación',
                          maxLines: 4,
                          maxLength: 600,
                        ),

                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 8, runSpacing: 8,
                          children: [
                            OutlinedButton.icon(
                              icon: const Icon(Icons.local_library),
                              label: Text(_especialidadesIds.isEmpty
                                  ? 'Seleccionar Especialidades'
                                  : 'Especialidades (${_especialidadesIds.length})'),
                              onPressed: () async {
                                final seleccion = await showModalBottomSheet<List<int>>(
                                  context: context,
                                  isScrollControlled: true,
                                  builder: (_) => Padding(
                                    padding: EdgeInsets.only(
                                      bottom: MediaQuery.of(context).viewInsets.bottom,
                                      left: 16, right: 16, top: 16),
                                    child: const SingleChildScrollView(
                                      child: EspecialidadesSelector(inicial: []),
                                    ),
                                  ),
                                );
                                if (seleccion != null) {
                                  setState(() => _especialidadesIds = seleccion);
                                }
                              },
                            ),
                            OutlinedButton.icon(
                              icon: const Icon(Icons.schedule),
                              label: Text(_disponibilidad.isEmpty
                                  ? 'Configurar Disponibilidad'
                                  : 'Disponibilidad (${_disponibilidad.length})'),
                              onPressed: () async {
                                final data = await showModalBottomSheet<List<Map<String, dynamic>>>(
                                  context: context,
                                  isScrollControlled: true,
                                  builder: (_) => const DraggableScrollableSheet(
                                    expand: false,
                                    initialChildSize: 0.8,
                                    minChildSize: 0.5,
                                    maxChildSize: 0.95,
                                    builder: (ctx, sc) => SingleChildScrollView(
                                      controller: sc,
                                      child: DisponibilidadModal(inicial: []),
                                    ),
                                  ),
                                );
                                if (data != null) {
                                  setState(() => _disponibilidad = data);
                                }
                              },
                            ),
                            OutlinedButton.icon(
                              icon: const Icon(Icons.business),
                              label: Text(_estudio == null
                                  ? 'Asociar Estudio/Despacho'
                                  : 'Editar Estudio (${_estudio!['nombre_comercial'] ?? 'Definido'})'),
                              onPressed: () async {
                                final estudio = await showModalBottomSheet<Map<String, dynamic>>(
                                  context: context,
                                  isScrollControlled: true,
                                  builder: (_) => EstudioModal(inicial: _estudio),
                                );
                                if (estudio != null) {
                                  setState(() => _estudio = estudio);
                                }
                              },
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 25),
                ],

                // ----- Datos de Contacto Comunes -----
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: _cardDecoration(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _cardTitle(icon: Icons.contact_phone, title: 'Datos de Contacto'),
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
                      side: const BorderSide(color: AppColors.buttonColor),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
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

  BoxDecoration _cardDecoration() => BoxDecoration(
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
  );

  Widget _cardTitle({required IconData icon, required String title}) {
    return Row(
      children: [
        Icon(icon, color: AppColors.buttonColor, size: 24),
        const SizedBox(width: 10),
        Text(
          title,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: AppColors.buttonColor,
          ),
        ),
      ],
    );
  }
}
