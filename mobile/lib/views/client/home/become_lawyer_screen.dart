import 'package:flutter/material.dart';

import '../../../constants/colors.dart';
import '../../../models/lawyer_application.dart';
import '../../../models/user_session.dart';
import '../../../services/api_client.dart';
import '../../../services/session_service.dart';

class BecomeLawyerScreen extends StatefulWidget {
  const BecomeLawyerScreen({super.key});

  @override
  State<BecomeLawyerScreen> createState() => _BecomeLawyerScreenState();
}

class _BecomeLawyerScreenState extends State<BecomeLawyerScreen> {
  final TextEditingController _linkedinController = TextEditingController();
  final TextEditingController _degreeLinkController = TextEditingController();
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  LawyerApplicationStatus _status = LawyerApplicationStatus.empty;
  bool _isLoading = true;
  bool _isSubmitting = false;
  UserSession? _session;

  @override
  void initState() {
    super.initState();
    _session = SessionService.instance.session;

    if (_session == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _showSnack('Debes iniciar sesión nuevamente.');
        Navigator.of(context).pop();
      });
      return;
    }

    if (_session!.hasLawyerAccount) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _showSnack('Ya cuentas con un rol de abogado activo.',
            color: AppColors.button2Color);
        Navigator.of(context).pop();
      });
      return;
    }

    _loadStatus();
  }

  @override
  void dispose() {
    _linkedinController.dispose();
    _degreeLinkController.dispose();
    super.dispose();
  }

  void _showSnack(String message, {Color color = Colors.red}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: color,
      ),
    );
  }

  Future<void> _loadStatus() async {
    final session = _session;
    if (session == null) return;

    setState(() => _isLoading = true);
    try {
      final status =
          await ApiClient.fetchLawyerApplicationStatus(token: session.token);
      SessionService.instance.updateApplication(status);
      setState(() {
        _status = status;
        _isLoading = false;
      });

      if ((status.linkedinUrl?.isNotEmpty ?? false)) {
        _linkedinController.text = status.linkedinUrl!;
      }
      if ((status.tituloUrl?.isNotEmpty ?? false)) {
        _degreeLinkController.text = status.tituloUrl!;
      }
    } catch (error) {
      setState(() => _isLoading = false);
      final message = error.toString().replaceFirst('Exception: ', '');
      _showSnack(
        message.isEmpty
            ? 'No se pudo obtener el estado de tu solicitud'
            : message,
      );
    }
  }

  Future<void> _submitApplication() async {
    final session = _session;
    if (session == null || !_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final status = await ApiClient.submitLawyerApplication(
        token: session.token,
        linkedinUrl: _linkedinController.text.trim(),
        tituloUrl: _degreeLinkController.text.trim(),
      );
      SessionService.instance.updateApplication(status);
      setState(() {
        _status = status;
        _isSubmitting = false;
      });

      _showSnack(
        status.state == LawyerApplicationState.pendiente
            ? 'Solicitud enviada. Revisaremos tu información pronto.'
            : 'Solicitud actualizada correctamente.',
        color: AppColors.button2Color,
      );
    } catch (error) {
      setState(() => _isSubmitting = false);
      final message = error.toString().replaceFirst('Exception: ', '');
      _showSnack(
        message.isEmpty
            ? 'No se pudo enviar la solicitud'
            : message,
      );
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
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20.0),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
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
                    if (_status.state != LawyerApplicationState.none) ...[
                      _buildStatusIndicator(),
                      const SizedBox(height: 24),
                    ],
                    if (!_status.isFinalized) _buildApplicationForm(),
                    if (_status.isFinalized)
                      const Text(
                        'Tu solicitud ha sido cerrada. Si necesitas asistencia adicional, contacta a soporte.',
                        style: TextStyle(
                          color: AppColors.text2Color,
                          fontSize: 13,
                          height: 1.35,
                        ),
                      ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildApplicationForm() {
    final bool isEditable = _status.canEdit;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.buttonTextColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.strokeColor),
      ),
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _linkedinController,
            enabled: isEditable && !_isSubmitting,
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
              final trimmed = value?.trim() ?? '';
              if (trimmed.isEmpty || !trimmed.startsWith('http')) {
                return 'Por favor, introduce una URL válida.';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _degreeLinkController,
            enabled: isEditable && !_isSubmitting,
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
              final trimmed = value?.trim() ?? '';
              if (trimmed.isEmpty || !trimmed.startsWith('http')) {
                return 'Por favor, introduce una URL válida.';
              }
              return null;
            },
          ),
          const SizedBox(height: 22),
          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: isEditable && !_isSubmitting ? _submitApplication : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.buttonColor,
                foregroundColor: AppColors.buttonTextColor,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                elevation: 0,
              ),
              child: Text(
                _isSubmitting
                    ? 'Enviando...'
                    : (_status.state == LawyerApplicationState.observada
                        ? 'Reenviar solicitud'
                        : 'Enviar postulación'),
                style: const TextStyle(
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
    final state = _status.state;
    Color statusColor;
    IconData icon;
    String title;
    String subtitle;

    switch (state) {
      case LawyerApplicationState.pendiente:
        statusColor = AppColors.text3Color;
        icon = Icons.hourglass_top_rounded;
        title = 'Postulación pendiente';
        subtitle = 'Hemos recibido tus datos y los revisaremos pronto.';
        break;
      case LawyerApplicationState.aprobada:
        statusColor = AppColors.button2Color;
        icon = Icons.check_circle_rounded;
        title = '¡Postulación aprobada!';
        subtitle =
            'Tu perfil fue verificado. Cambia al panel de abogado para comenzar a trabajar.';
        break;
      case LawyerApplicationState.rechazada:
        statusColor = AppColors.tabColor;
        icon = Icons.cancel_rounded;
        title = 'Postulación rechazada';
        subtitle =
            'No pudimos validar tu solicitud. Contacta a soporte para más información.';
        break;
      case LawyerApplicationState.observada:
        statusColor = AppColors.buttonColor;
        icon = Icons.info_rounded;
        title = 'Postulación observada';
        subtitle = 'Actualiza tu información para continuar con la revisión.';
        break;
      case LawyerApplicationState.none:
      default:
        return const SizedBox.shrink();
    }

    final String observation = _status.observation?.trim() ?? '';

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
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
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
            if (observation.isNotEmpty)
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
                        observation,
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