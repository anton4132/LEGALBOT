import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:legalserviceapp/constants/colors.dart';
import 'package:legalserviceapp/widgets/custombtn.dart';
import 'package:legalserviceapp/views/authentication/login_screen.dart';
import 'package:legalserviceapp/services/api_client.dart';

class ConfirmationScreen extends StatefulWidget {
  final String userType;
  final Map<String, String> personalInfo; // vienen como strings
  final Map<String, String> contactInfo;  // vienen como strings
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

  bool _loading = false;

  Map<String, dynamic>? _contactInfoRaw; // estructuras reales (List<int>, List<Map>, Map)

  @override
  void initState() {
    super.initState();
    // Animaciones
    _controller = AnimationController(duration: const Duration(milliseconds: 1000), vsync: this);
    _fadeAnimation = CurvedAnimation(parent: _controller, curve: Curves.easeInOut);
    _slideAnimation = Tween<Offset>(begin: const Offset(0, 1), end: Offset.zero)
        .animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
    _controller.forward();

    // Lee argumentos con estructuras reales si existen
    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is Map<String, dynamic>) {
      _contactInfoRaw = args['contactInfoRaw'] as Map<String, dynamic>?;
    }
  }

  @override
  void didChangeDependencies() {
    // En algunos entornos, ModalRoute no está aún en initState; refuerzo aquí:
    if (_contactInfoRaw == null) {
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is Map<String, dynamic>) {
        _contactInfoRaw = args['contactInfoRaw'] as Map<String, dynamic>?;
      }
    }
    super.didChangeDependencies();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  // Helpers de parseo (fallback si vinieron como strings)
  List<int> _parseIdsCsv(String? csv) {
    if (csv == null || csv.trim().isEmpty) return [];
    return csv.split(',').map((e) => int.tryParse(e.trim()) ?? -1).where((e) => e > 0).toList();
  }

  List<Map<String, dynamic>> _parseDisponibilidad(String? s) {
    if (s == null) return [];
    try {
      final v = jsonDecode(s);
      if (v is List) return v.cast<Map<String, dynamic>>();
      return [];
    } catch (_) {
      return [];
    }
  }

  Map<String, dynamic>? _parseEstudio(String? s) {
    if (s == null) return null;
    try {
      final v = jsonDecode(s);
      if (v is Map) return v.cast<String, dynamic>();
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<void> _completeRegistration() async {
    if (_loading) return;
    setState(() => _loading = true);

    try {
      final rolCodigo = widget.userType; // 'abogado' | 'cliente'

      // Lee comunes desde contactInfoRaw si existe, si no desde widget.contactInfo
      final ciRaw = _contactInfoRaw ?? {};
      final persona = {
        "dni":       (ciRaw['dni'] ?? widget.contactInfo['dni']),
        "telefono":  (ciRaw['phone'] ?? widget.contactInfo['phone']),
        "primer_nombre":  widget.personalInfo['primerNombre'],
        "segundo_nombre": widget.personalInfo['segundoNombre'],
        "apellido_paterno": widget.personalInfo['apellidoPaterno'],
        "apellido_materno": widget.personalInfo['apellidoMaterno'],
        "correo":    (ciRaw['email'] ?? widget.contactInfo['email']),
        "direccion": (ciRaw['direccion'] ?? widget.contactInfo['direccion']),
      };

      final payload = {
        "rolCodigo": rolCodigo,
        "persona": persona,
        "usuario": { "clave": widget.password },
      };

      if (rolCodigo == 'abogado') {
        // Preferir estructuras reales desde contactInfoRaw
        final tarifaBase       = (ciRaw['tarifaBase'] ?? widget.contactInfo['tarifaBase']);
        final duracionMinutos  = (ciRaw['duracionMinutos'] ?? widget.contactInfo['duracionMinutos']);
        final direccionAt      = (ciRaw['direccionAtencion'] ?? widget.contactInfo['direccionAtencion']);
        final bio              = (ciRaw['bio'] ?? widget.contactInfo['bio']);

        // Especialidades, disponibilidad y estudio como estructuras reales
        final especialidadesIds = (ciRaw['especialidadesIds'] is List)
            ? (ciRaw['especialidadesIds'] as List).map((e) => (e as num).toInt()).toList()
            : _parseIdsCsv(widget.personalInfo['especialidadesIds']);

        final disponibilidad = (ciRaw['disponibilidad'] is List)
            ? (ciRaw['disponibilidad'] as List).cast<Map<String, dynamic>>()
            : _parseDisponibilidad(widget.personalInfo['disponibilidad']);

        final estudio = (ciRaw['estudio'] is Map)
            ? (ciRaw['estudio'] as Map).cast<String, dynamic>()
            : _parseEstudio(widget.personalInfo['estudio']);

        payload["perfilAbogado"] = {
          "tarifa_base": tarifaBase, // string decimal; backend la convierte a Decimal
          "duracion_minutos": int.tryParse(duracionMinutos?.toString() ?? '60'),
          "direccion_atencion": direccionAt,
          "bio": bio,
          "especialidades_ids": especialidadesIds,
          "disponibilidad": disponibilidad,
          "estudio": estudio,
        };
      }

      await ApiClient.signup(payload);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('¡Registro exitoso!'), backgroundColor: Colors.green),
      );

      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ---------------- UI ----------------
  @override
  Widget build(BuildContext context) {
    final resumen = _buildResumen(); // usa widget.* y _contactInfoRaw si existe

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
          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [AppColors.buttonColor, Colors.white]),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 20),

                // Progress completado
                Row(
                  children: List.generate(3, (i) => Expanded(
                    child: Row(
                      children: [
                        Container(
                          width: 30, height: 30,
                          decoration: const BoxDecoration(color: AppColors.buttonColor, shape: BoxShape.circle),
                          child: const Icon(Icons.check, color: Colors.white, size: 20),
                        ),
                        if (i < 2) Expanded(child: Container(height: 3, color: AppColors.buttonColor, margin: const EdgeInsets.symmetric(horizontal: 10))),
                      ],
                    ),
                  )),
                ),

                const SizedBox(height: 40),

                // Icono
                Center(
                  child: SlideTransition(
                    position: _slideAnimation,
                    child: FadeTransition(
                      opacity: _fadeAnimation,
                      child: Container(
                        width: 120, height: 120,
                        decoration: BoxDecoration(color: Colors.green.shade100, shape: BoxShape.circle),
                        child: Icon(Icons.check_circle, size: 80, color: Colors.green.shade600),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 30),

                // Título
                Center(
                  child: FadeTransition(
                    opacity: _fadeAnimation,
                    child: const Text('¡Registro Completado!', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white)),
                  ),
                ),
                const SizedBox(height: 10),
                Center(
                  child: FadeTransition(
                    opacity: _fadeAnimation,
                    child: Text('Revisa tus datos antes de confirmar',
                      style: TextStyle(fontSize: 16, color: Colors.white.withOpacity(0.8))),
                  ),
                ),

                const SizedBox(height: 40),

                // Resumen
                SlideTransition(
                  position: _slideAnimation,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white, borderRadius: BorderRadius.circular(15),
                      boxShadow: [BoxShadow(color: Colors.grey.withOpacity(0.2), spreadRadius: 1, blurRadius: 10, offset: const Offset(0, 4))],
                    ),
                    child: resumen,
                  ),
                ),

                const SizedBox(height: 30),

                // Confirmar (llama API)
                SlideTransition(
                  position: _slideAnimation,
                  child: SizedBox(
                    width: double.infinity, height: 55,
                    child: CustomButton(
                      text: _loading ? 'Creando...' : 'Confirmar Registro',
                      onTap: _loading ? null : () { _completeRegistration(); },
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Editar
                SlideTransition(
                  position: _slideAnimation,
                  child: SizedBox(
                    width: double.infinity, height: 55,
                    child: OutlinedButton(
                      onPressed: _loading ? null : () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppColors.buttonColor),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Editar Datos', style: TextStyle(color: AppColors.buttonColor, fontSize: 16, fontWeight: FontWeight.bold)),
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

  Widget _buildResumen() {
    // Toma de _contactInfoRaw cuando exista, si no de widget.contactInfo
    final ci = _contactInfoRaw ?? widget.contactInfo;

    final esAbogado = widget.userType == 'abogado';

    List<Widget> rows = [
      _infoRow('Tipo de Usuario', esAbogado ? 'Abogado' : 'Cliente'),
      _infoRow('Primer Nombre', widget.personalInfo['primerNombre'] ?? ''),
      _infoRow('Segundo Nombre', widget.personalInfo['segundoNombre'] ?? ''),
      _infoRow('Apellido Paterno', widget.personalInfo['apellidoPaterno'] ?? ''),
      _infoRow('Apellido Materno', widget.personalInfo['apellidoMaterno'] ?? ''),
      if (esAbogado && (ci['especialidadesIds'] is List))
        _infoRow('Especialidades', (ci['especialidadesIds'] as List).join(', ')),
      _infoRow('DNI', (ci['dni'] ?? widget.contactInfo['dni'])?.toString() ?? ''),
      _infoRow('Teléfono', (ci['phone'] ?? widget.contactInfo['phone'])?.toString() ?? ''),
      _infoRow('Email', (ci['email'] ?? widget.contactInfo['email'])?.toString() ?? ''),
      _infoRow('Dirección', (ci['direccion'] ?? widget.contactInfo['direccion'])?.toString() ?? ''),
    ];

    if (esAbogado) {
      rows.addAll([
        _infoRow('Tarifa base', (ci['tarifaBase'] ?? widget.contactInfo['tarifaBase'])?.toString() ?? ''),
        _infoRow('Duración (min)', (ci['duracionMinutos'] ?? widget.contactInfo['duracionMinutos'])?.toString() ?? ''),
        _infoRow('Dirección atención', (ci['direccionAtencion'] ?? widget.contactInfo['direccionAtencion'])?.toString() ?? ''),
        _infoRow('Bio', (ci['bio'] ?? widget.contactInfo['bio'])?.toString() ?? ''),
        if (ci['disponibilidad'] is List && (ci['disponibilidad'] as List).isNotEmpty)
          _infoRow('Disponibilidad', '${(ci['disponibilidad'] as List).length} bloques'),
        if (ci['estudio'] is Map && (ci['estudio'] as Map)['nombre_comercial'] != null)
          _infoRow('Estudio', (ci['estudio'] as Map)['nombre_comercial'].toString()),
      ]);
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: rows);
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text('$label:',
              style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.grey, fontSize: 14)),
          ),
          Expanded(
            child: Text(value.isNotEmpty ? value : 'No especificado',
              style: const TextStyle(fontSize: 14, color: Colors.black87)),
          ),
        ],
      ),
    );
  }
}
