import 'package:flutter/material.dart';
import 'dart:async';
import '../../constants/colors.dart';

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
          _observationMessage = 'El link del título profesional no es accesible. Por favor, asegúrate de que el enlace sea público.';
        });
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Postular como Abogado'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
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
              Text(
                'Completa tu postulación',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primaryColor
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                'Envía tus datos para que nuestro equipo pueda verificar tu perfil profesional.',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: AppTheme.textSecondaryColor,
                    ),
              ),
              const SizedBox(height: 30),
              
              // Widget que muestra el estado actual de la postulación
              if (_status != VerificationStatus.none) ...[
                _buildStatusIndicator(),
                const SizedBox(height: 30),
              ],

              // Solo muestra el formulario si no ha sido aprobado
              if (_status != VerificationStatus.approved)
                _buildApplicationForm(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildApplicationForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextFormField(
          controller: _linkedinController,
          decoration: const InputDecoration(
            labelText: 'URL de tu perfil de LinkedIn',
            prefixIcon: Icon(Icons.link_rounded),
          ),
          validator: (value) {
            if (value == null || value.isEmpty || !value.startsWith('https://')) {
              return 'Por favor, introduce una URL válida.';
            }
            return null;
          },
        ),
        const SizedBox(height: 20),
        TextFormField(
          controller: _degreeLinkController,
          decoration: const InputDecoration(
            labelText: 'Link a tu Título (Google Drive, etc.)',
            prefixIcon: Icon(Icons.school_rounded),
            hintText: 'Asegúrate de que sea un enlace público'
          ),
          validator: (value) {
            if (value == null || value.isEmpty || !value.startsWith('https://')) {
              return 'Por favor, introduce una URL válida.';
            }
            return null;
          },
        ),
        const SizedBox(height: 40),
        ElevatedButton(
          onPressed: _submitApplication,
          child: const Text('Enviar Postulación'),
        ),
      ],
    );
  }

  Widget _buildStatusIndicator() {
    IconData icon;
    String title;
    String subtitle;
    Color color;

    switch (_status) {
      case VerificationStatus.pending:
        icon = Icons.hourglass_top_rounded;
        title = 'Postulación Pendiente';
        subtitle = 'Hemos recibido tus datos. Nuestro equipo los revisará pronto.';
        color = AppTheme.pendingColor;
        break;
      case VerificationStatus.approved:
        icon = Icons.check_circle_rounded;
        title = '¡Felicidades! Postulación Aprobada';
        subtitle = 'Tu perfil ha sido verificado. Ahora tienes acceso a las funciones de abogado.';
        color = AppTheme.approvedColor;
        break;
      case VerificationStatus.rejected:
        icon = Icons.cancel_rounded;
        title = 'Postulación Rechazada';
        subtitle = 'Lamentablemente, no pudimos verificar tus datos en este momento.';
        color = AppTheme.rejectedColor;
        break;
      case VerificationStatus.observed:
        icon = Icons.info_rounded;
        title = 'Postulación Observada';
        subtitle = 'Se requiere una acción de tu parte para continuar.';
        color = AppTheme.observedColor;
        break;
      default:
        return const SizedBox.shrink();
    }

    return Card(
      color: color.withOpacity(0.15),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: color, width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            Row(
              children: [
                Icon(icon, color: color, size: 30),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              color: color,
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: AppTheme.textSecondaryColor,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            // Muestra la observación si existe
            if (_status == VerificationStatus.observed && _observationMessage.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 16.0),
                child: Text(
                  'Observación: $_observationMessage',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppTheme.textColor,
                    fontStyle: FontStyle.italic
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}