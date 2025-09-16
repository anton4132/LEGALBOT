import 'package:flutter/material.dart';
import 'dart:async';
import '../../../constants/colors.dart';

// Enum para manejar los estados de la verificación de forma clara.
enum VerificationStatus { none, pending, approved, rejected, observed }

class BecomeLawyerScreen extends StatefulWidget {
  const BecomeLawyerScreen({super.key});

  @override
  State<BecomeLawyerScreen> createState() => _BecomeLawyerScreenState();
}

class _BecomeLawyerScreenState extends State<BecomeLawyerScreen> {
  final _linkedinController = TextEditingController();
  final _degreeLinkController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  VerificationStatus _status = VerificationStatus.none;
  String _observationMessage = '';

  @override
  void dispose() {
    _linkedinController.dispose();
    _degreeLinkController.dispose();
    super.dispose();
  }

  // Simula una llamada a un backend para verificar los datos.
  void _submitApplication() {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _status = VerificationStatus.pending;
        _observationMessage = '';
      });

      // Simulación de una revisión que toma tiempo
      Timer(const Duration(seconds: 3), () {
        // En un caso real, aquí recibirías la respuesta del servidor.
        // Para este ejemplo, simularemos un estado de "observada".
        setState(() {
          _status = VerificationStatus.observed;
          _observationMessage =
              'El link del título profesional no es accesible. Por favor, asegúrate de que el enlace sea público.';
        });
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgColor,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: AppColors.bgColor,
        foregroundColor: AppColors.text1Color,
        title: const Text('Postular como Abogado'),
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new_rounded,
            color: AppColors.text1Color,
          ),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Encabezado
              Row(
                children: const [
                  Icon(Icons.workspace_premium_rounded,
                      color: AppColors.buttonColor, size: 26),
                  SizedBox(width: 10),
                  Text(
                    'Completa tu postulación',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: AppColors.buttonColor,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'Envía tus datos para que nuestro equipo pueda verificar tu perfil profesional.',
                style: TextStyle(
                  fontSize: 14,
                  color: AppColors.text2Color,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 24),

              // Estado de la postulación (si aplica)
              if (_status != VerificationStatus.none) ...[
                _buildStatusIndicator(),
                const SizedBox(height: 24),
              ],

              // Formulario
              if (_status != VerificationStatus.approved) _buildApplicationForm(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildApplicationForm() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.buttonTextColor, // blanco de la paleta
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.strokeColor),
      ),
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // LinkedIn
          TextFormField(
            controller: _linkedinController,
            decoration: const InputDecoration(
              labelText: 'URL de tu perfil de LinkedIn',
              labelStyle: TextStyle(color: AppColors.textFormFieldLabelColor),
              prefixIcon: Icon(Icons.link_rounded, color: AppColors.text2Color),
              hintText: 'https://www.linkedin.com/in/usuario',
              hintStyle: TextStyle(color: AppColors.text2Color),
              enabledBorder: OutlineInputBorder(
                borderSide: BorderSide(color: AppColors.textFormFieldBorderColor),
                borderRadius: BorderRadius.all(Radius.circular(14)),
              ),
              focusedBorder: OutlineInputBorder(
                borderSide: BorderSide(color: AppColors.button2Color, width: 2),
                borderRadius: BorderRadius.all(Radius.circular(14)),
              ),
              filled: true,
              fillColor: AppColors.buttonTextColor,
              contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            ),
            validator: (value) {
              if (value == null ||
                  value.isEmpty ||
                  !value.trim().startsWith('https://')) {
                return 'Por favor, introduce una URL válida.';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),

          // Título profesional
          TextFormField(
            controller: _degreeLinkController,
            decoration: const InputDecoration(
              labelText: 'Link a tu Título (Google Drive, etc.)',
              labelStyle: TextStyle(color: AppColors.textFormFieldLabelColor),
              prefixIcon: Icon(Icons.school_rounded, color: AppColors.text2Color),
              hintText: 'Asegúrate de que sea un enlace público',
              hintStyle: TextStyle(color: AppColors.text2Color),
              enabledBorder: OutlineInputBorder(
                borderSide: BorderSide(color: AppColors.textFormFieldBorderColor),
                borderRadius: BorderRadius.all(Radius.circular(14)),
              ),
              focusedBorder: OutlineInputBorder(
                borderSide: BorderSide(color: AppColors.button2Color, width: 2),
                borderRadius: BorderRadius.all(Radius.circular(14)),
              ),
              filled: true,
              fillColor: AppColors.buttonTextColor,
              contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            ),
            validator: (value) {
              if (value == null ||
                  value.isEmpty ||
                  !value.trim().startsWith('https://')) {
                return 'Por favor, introduce una URL válida.';
              }
              return null;
            },
          ),
          const SizedBox(height: 22),

          // Botón enviar
          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: _submitApplication,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.buttonColor,
                foregroundColor: AppColors.buttonTextColor,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                elevation: 0,
              ),
              child: const Text(
                'Enviar Postulación',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  letterSpacing: .2,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusIndicator() {
    // Mapeo de estado -> color dentro de la paleta permitida
    Color statusColor;
    switch (_status) {
      case VerificationStatus.pending:
        statusColor = AppColors.text3Color; // naranja
        break;
      case VerificationStatus.approved:
        statusColor = AppColors.button2Color; // azul vivo
        break;
      case VerificationStatus.rejected:
        statusColor = AppColors.tabColor; // magenta
        break;
      case VerificationStatus.observed:
        statusColor = AppColors.buttonColor; // azul profundo
        break;
      default:
        statusColor = AppColors.text1Color; // fallback
    }

    IconData icon;
    String title;
    String subtitle;

    switch (_status) {
      case VerificationStatus.pending:
        icon = Icons.hourglass_top_rounded;
        title = 'Postulación Pendiente';
        subtitle = 'Hemos recibido tus datos. Nuestro equipo los revisará pronto.';
        break;
      case VerificationStatus.approved:
        icon = Icons.check_circle_rounded;
        title = '¡Felicidades! Postulación Aprobada';
        subtitle =
            'Tu perfil ha sido verificado. Ahora tienes acceso a las funciones de abogado.';
        break;
      case VerificationStatus.rejected:
        icon = Icons.cancel_rounded;
        title = 'Postulación Rechazada';
        subtitle =
            'Lamentablemente, no pudimos verificar tus datos en este momento.';
        break;
      case VerificationStatus.observed:
        icon = Icons.info_rounded;
        title = 'Postulación Observada';
        subtitle = 'Se requiere una acción de tu parte para continuar.';
        break;
      default:
        return const SizedBox.shrink();
    }

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: AppColors.buttonTextColor,
        border: Border.all(color: AppColors.strokeColor),
      ),
      padding: const EdgeInsets.all(16),
      child: Container(
        decoration: BoxDecoration(
          color: statusColor.withOpacity(0.12),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: statusColor, width: 1.2),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              children: [
                Icon(icon, color: statusColor, size: 30),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          color: statusColor,
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        // texto secundario con contraste suave
                        ' ',
                        style: TextStyle(fontSize: 0),
                      ),
                      Text(
                        subtitle,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.text2Color,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (_status == VerificationStatus.observed &&
                _observationMessage.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 14.0, left: 4, right: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.report_gmailerrorred_rounded,
                        color: AppColors.text3Color, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Observación: $_observationMessage',
                        style: const TextStyle(
                          color: AppColors.text1Color,
                          fontStyle: FontStyle.italic,
                          fontSize: 13,
                          height: 1.35,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
