import 'package:flutter/material.dart';
import '../../../constants/colors.dart';
import '../../../models/user_session.dart';
import '../../../services/api_client.dart';
import '../../../services/session_service.dart';
import '../../../widgets/consultation_input.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../../widgets/custom_drawer.dart';
import '../../../widgets/custombtn.dart';
import '../../../widgets/gradient_container.dart';
import '../../../widgets/option_card.dart';
import '../../../widgets/section_header.dart';
import '../../../widgets/shadow_card.dart';
import '../../authentication/login_screen.dart';
import '../../client/home/client_home.dart';
import '../profile/lawyer_profile_screen.dart';


class LawyerHome extends StatefulWidget {
  const LawyerHome({super.key});

  @override
  State<LawyerHome> createState() => _LawyerHomeState();
}

class _WarningDot extends StatelessWidget {
  const _WarningDot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 10,
      height: 10,
      decoration: const BoxDecoration(
        color: Colors.amber,
        shape: BoxShape.circle,
      ),
    );
  }
}

class _LawyerHomeState extends State<LawyerHome> {
  final TextEditingController _consultationController = TextEditingController();
  bool _isRecording = false;
  bool _isSwitchingAccount = false;
  bool _profileIncomplete = false;
  bool _loadingProfileStatus = false;
  bool _profileStatusScheduled = false;
  int? _profileStatusLoadedFor;

  @override
  void dispose() {
    _consultationController.dispose();
    super.dispose();
  }

  void _showSnack(String message, {Color color = Colors.red}) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message), backgroundColor: color));
  }

  void _handleUnauthorized(String? message) {
    SessionService.instance.clear();

    if (!mounted) {
      return;
    }

    final resolvedMessage = (() {
      final trimmed = message?.trim();
      if (trimmed != null && trimmed.isNotEmpty) {
        return trimmed;
      }
      return 'Tu sesión ha expirado. Inicia sesión nuevamente.';
    })();

    setState(() {
      _isRecording = false;
      _isSwitchingAccount = false;
      _consultationController.clear();
        _loadingProfileStatus = false;
      _profileStatusLoadedFor = null;
      _profileIncomplete = false;
    });

    final messenger = ScaffoldMessenger.of(context);
    messenger.showSnackBar(
      SnackBar(
        content: Text(resolvedMessage),
        backgroundColor: Colors.red,
      ),
    );

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  void _handleSendConsultation() {
    final text = _consultationController.text.trim();
    if (text.isNotEmpty) {
      // TODO: Implementar envío de consulta
      // ignore: avoid_print
      print('Consulta enviada: $text');
      _consultationController.clear();
    }
  }

  void _handleMicPressed() {
    setState(() => _isRecording = !_isRecording);
    // TODO: Implementar grabación de voz
    // ignore: avoid_print
    print(_isRecording ? 'Iniciando grabación...' : 'Deteniendo grabación...');
  }

  Future<void> _switchToClientAccount(UserSession session) async {
    if (_isSwitchingAccount) return;

    final clientAccount = SessionService.instance.accountForRole('cliente');
    if (clientAccount == null) {
      _showSnack(
        'No encontramos una cuenta de cliente asociada.',
        color: AppColors.text3Color,
      );
      return;
    }

    setState(() => _isSwitchingAccount = true);
    try {
      final result = await ApiClient.switchAccount(
        token: session.token,
        usuarioId: clientAccount.usuarioId,
      );
      final updated = session.applySwitchResult(result);
      SessionService.instance.setSession(updated);

      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const ClientHome()),
        (route) => false,
      );
        } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
    } catch (error) {
      final message = error.toString().replaceFirst('Exception: ', '');
      _showSnack(
        message.isEmpty ? 'No se pudo cambiar a la cuenta de cliente' : message,
      );
    } finally {
      if (mounted) {
        setState(() => _isSwitchingAccount = false);
      }
    }
  }

  Future<void> _handleLogout() async {
    final bool? shouldLogout = await showDialog<bool>(
      context: context,
      builder:
          (context) => AlertDialog(
            title: const Text('Cerrar sesión'),
            content: const Text('¿Deseas cerrar sesión?'),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancelar'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.of(context).pop(true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.buttonColor,
                  foregroundColor: AppColors.buttonTextColor,
                ),
                child: const Text('Cerrar sesión'),
              ),
            ],
          ),
    );

    if (!(shouldLogout ?? false) || !mounted) return;

    SessionService.instance.clear();
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  Future<void> _updateProfileStatus({bool force = false}) async {
    final session = SessionService.instance.session;
    if (session == null) {
      if (!mounted) return;
      setState(() {
        _loadingProfileStatus = false;
        _profileStatusLoadedFor = null;
        _profileIncomplete = false;
      });
      return;
    }
    if (!force) {
      if (_loadingProfileStatus) return;
      if (_profileStatusLoadedFor == session.usuarioId) return;
    }
    setState(() {
      _loadingProfileStatus = true;
      _profileStatusLoadedFor = session.usuarioId;
    });
    try {
      final snapshot = await ApiClient.fetchLawyerProfileSnapshot(
        token: session.token,
        userId: session.usuarioId,
      );
      if (!mounted) return;
      setState(() {
        _profileIncomplete = !snapshot.isComplete;
        _loadingProfileStatus = false;
      });
    } on UnauthorizedException catch (error) {
      if (!mounted) return;
      setState(() => _loadingProfileStatus = false);
      _handleUnauthorized(error.message);
    } catch (error) {
      if (!mounted) return;
      setState(() => _loadingProfileStatus = false);
    }
  }

  Future<void> _openLawyerProfile() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const LawyerProfileScreen()),
    );
    if (!mounted) return;
    await _updateProfileStatus(force: true);
  }

  Widget _buildProfileReminderCard(String name) {
    return ShadowCard(
      padding: const EdgeInsets.all(15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.warning_amber, color: Colors.amber),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Completa tu perfil, $name',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: AppColors.buttonColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Tu perfil de abogado está incompleto. Completa tus datos profesionales para que los clientes puedan encontrarte.',
            style: TextStyle(fontSize: 13, color: Colors.black87),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: _openLawyerProfile,
              icon: const Icon(Icons.edit, color: AppColors.buttonColor),
              label: const Text('Completar perfil'),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<UserSession?>(
      valueListenable: SessionService.instance.notifier,
      builder: (context, session, _) {
        final displayName =
            (session?.nombreCompleto?.trim().isNotEmpty ?? false)
                ? session!.nombreCompleto!.trim()
                : 'Abogado';
    if (session != null &&
            !_loadingProfileStatus &&
            _profileStatusLoadedFor != session.usuarioId) {
          Future.microtask(() => _updateProfileStatus());
        } else if (session == null &&
            !_loadingProfileStatus &&
            _profileStatusLoadedFor != null) {
          Future.microtask(() {
            if (!mounted) return;
            setState(() {
              _profileStatusLoadedFor = null;
              _profileIncomplete = false;
            });
          });
        }

        return Scaffold(
          appBar: const CustomAppBar(title: 'LegalBot - Abogado'),
          drawer: CustomDrawer(
            userType: 'Abogado',
            userIcon: Icons.gavel,
            userName: displayName,
            subtitle: 'Panel de Control',
            items: [
              const DrawerItem(icon: Icons.home, title: 'Inicio'),
               DrawerItem(
                icon: Icons.verified_user,
                title: 'Perfil de Abogado',
                trailing:
                    _profileIncomplete ? const _WarningDot() : null,
                onTap: _openLawyerProfile,
              ),
              DrawerItem(
                icon: Icons.info,
                title: 'Información Legal',
                onTap: () {
                  // TODO
                },
              ),
              DrawerItem(
                icon: Icons.description,
                title: 'Formatos y Plantillas',
                onTap: () {
                  // TODO
                },
              ),
              DrawerItem(
                icon: Icons.folder,
                title: 'Archivo de Procesos',
                onTap: () {
                  // TODO
                },
              ),
              DrawerItem(
                icon: Icons.people,
                title: 'Perfil de Clientes',
                onTap: () {
                  // TODO
                },
              ),
              DrawerItem(
                icon: Icons.calendar_today,
                title: 'Calendario',
                onTap: () {
                  // TODO
                },
              ),
              DrawerItem(
                icon: Icons.attach_money,
                title: 'Ganancias',
                onTap: () {
                  // TODO
                },
              ),
              DrawerItem(
                icon: Icons.person,
                title: 'Panel Cliente',
                onTap:
                    session == null
                        ? null
                        : () => _switchToClientAccount(session),
              ),
            ],
            onLogout: _handleLogout,
          ),
          body: GradientContainer(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ShadowCard(
                  padding: const EdgeInsets.all(15),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.gavel,
                            color: AppColors.buttonColor,
                            size: 24,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '¡Bienvenido, $displayName!',
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: AppColors.buttonColor,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 5),
                      const Text(
                        'Gestiona tus casos y clientes de manera eficiente.',
                        style: TextStyle(fontSize: 14, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
                 if (_profileIncomplete) ...[
                  const SizedBox(height: 16),
                  _buildProfileReminderCard(displayName),
                ],
                const SizedBox(height: 20),
                ShadowCard(
                  padding: const EdgeInsets.all(15),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.chat_bubble_outline,
                            color: AppColors.buttonColor,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          const Text(
                            'Consulta Rápida',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: AppColors.buttonColor,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Escribe tu consulta legal o usa el micrófono para dictar',
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                      const SizedBox(height: 10),
                      ConsultationInput(
                        controller: _consultationController,
                        hintText: 'Escribe tu consulta legal aquí...',
                        onSendPressed: _handleSendConsultation,
                        onMicPressed: _handleMicPressed,
                        isRecording: _isRecording,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                const SectionHeader(title: 'Herramientas'),
                const SizedBox(height: 15),
                    GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  crossAxisSpacing: 15,
                  mainAxisSpacing: 15,
                  childAspectRatio: 1.1,
                  padding: const EdgeInsets.symmetric(horizontal: 15),
                  children: [
                    OptionCard(
                      icon: Icons.info_outline,
                      title: 'Información\nLegal',
                      color: Colors.blue,
                      onTap: () {
                        // TODO: Navegar a la sección de información legal.
                      },
                    ),
                    OptionCard(
                      icon: Icons.description,
                      title: 'Formatos\ny Plantillas',
                      color: Colors.orange,
                      onTap: () {
                        // TODO: Navegar a los formatos y plantilla disponibles
                      },
                    ),
                    OptionCard(
                      icon: Icons.people_alt,
                      title: 'Clientes',
                      color: Colors.green,
                      onTap: () {
                        // TODO: Mostrar la lista de clientes.
                      },
                    ),
                    OptionCard(
                      icon: Icons.calendar_today,
                      title: 'Agenda',
                      color: Colors.purple,
                      onTap: () {
                        // TODO: Abrir la agenda de citas.
                      },
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}