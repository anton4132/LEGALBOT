import 'package:flutter/material.dart';

import '../../../constants/colors.dart';
import '../../../models/lawyer_application.dart';
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
import '../../lawyer/home/lawyer_home.dart';
import '../lawyers/client_lawyer_search_screen.dart';
import 'become_lawyer_screen.dart';
import 'client_settings_screen.dart';


class ClientHome extends StatefulWidget {
  const ClientHome({super.key});

  @override
  State<ClientHome> createState() => _ClientHomeState();
}
enum _ClientHomeView { dashboard, settings }

class _ClientHomeState extends State<ClientHome> {
  final TextEditingController _consultationController = TextEditingController();
  bool _isRecording = false;
  bool _isSwitchingAccount = false;
  _ClientHomeView _activeView = _ClientHomeView.dashboard;
  ClientSettingsSubsection _activeSettingsSubsection =
      ClientSettingsSubsection.overview;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _refreshApplicationStatus(),
    );
  }

  @override
  void dispose() {
    _consultationController.dispose();
    super.dispose();
  }

  Future<void> _refreshApplicationStatus() async {
    final session = SessionService.instance.session;
    if (session == null) return;

    try {
      final status = await ApiClient.fetchLawyerApplicationStatus(
        token: session.token,
      );
      SessionService.instance.updateApplication(status);
        try {
        final accounts = await ApiClient.fetchMobileAccounts(
          token: session.token,
        );
        SessionService.instance.updateAccounts(accounts.accounts);
      } catch (_) {
        // Ignorar fallos al refrescar cuentas; no bloquear UI
      }
    } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
    } catch (_) {
      // Ignorar fallos silenciosamente; el usuario puede actualizar manualmente en la pantalla de postulación
    }
  }

  void _handleSendConsultation() {
    final text = _consultationController.text.trim();
    if (text.isNotEmpty) {
      // TODO: Implementar envío de consulta al backend
      // ignore: avoid_print
      print('Consulta enviada: $text');
      _consultationController.clear();
    }
  }

  void _showSnackBar(String message,
      {Color color = AppColors.tabColor}) {
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
    });

    final messenger = ScaffoldMessenger.of(context);
    messenger.showSnackBar(
      SnackBar(
        content: Text(resolvedMessage),
        backgroundColor: AppColors.tabColor,
      ),
    );

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  Future<void> _switchToLawyerAccount(UserSession session) async {
    if (_isSwitchingAccount) return;

    final lawyerAccount = SessionService.instance.accountForRole('abogado');
    if (lawyerAccount == null) {
      _showSnackBar(
        'No tienes una cuenta de abogado activa',
        color: AppColors.text3Color,
      );
      return;
    }

    final LawyerApplicationStatus application =
        SessionService.instance.session?.application ??
            LawyerApplicationStatus.empty;
    final String? restrictionMessage =
        _lawyerRestrictionMessage(application, lawyerAccount);
    if (restrictionMessage != null) {
      _showSnackBar(
        restrictionMessage,
        color: AppColors.text3Color,
      );
      return;
    }

    setState(() => _isSwitchingAccount = true);
    try {
      final result = await ApiClient.switchAccount(
        token: session.token,
        usuarioId: lawyerAccount.usuarioId,
      );
      final updatedSession = session.applySwitchResult(result);
      SessionService.instance.setSession(updatedSession);

      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const LawyerHome()),
      );
      } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
    } catch (error) {
      if (!mounted) return;
      final message = error.toString().replaceFirst('Exception: ', '');
      _showSnackBar(
        message.isEmpty ? 'No se pudo cambiar a la cuenta de abogado' : message,
      );
    } finally {
      if (mounted) {
        setState(() => _isSwitchingAccount = false);
      }
    }
  }

  void _handleMicPressed() {
    setState(() => _isRecording = !_isRecording);
    // TODO: Implementar grabación de voz
    // ignore: avoid_print
    print(_isRecording ? 'Iniciando grabación...' : 'Deteniendo grabación...');
  }


  void _showHomeView() {
    if (_activeView == _ClientHomeView.dashboard) return;
    setState(() {
      _activeView = _ClientHomeView.dashboard;
    });
  }

  void _openSettingsSubsection(ClientSettingsSubsection subsection) {
    setState(() {
      _activeView = _ClientHomeView.settings;
      _activeSettingsSubsection = subsection;
    });
  }
  UserAccount? _lawyerAccountForSession(UserSession? session) {
    if (session == null) {
      return null;
    }
    for (final account in session.accounts) {
      if (account.isLawyer) {
        return account;
      }
    }
    return null;
  }

  String? _lawyerRestrictionMessage(
    LawyerApplicationStatus application,
    UserAccount? lawyerAccount,
  ) {
    if (lawyerAccount != null && !lawyerAccount.activo) {
      final detail = application.observation?.trim();
      if (detail != null && detail.isNotEmpty) {
        return detail;
      }
      return 'Tu cuenta de abogado está deshabilitada hasta regularizar la documentación solicitada.';
    }

    switch (application.state) {
      case LawyerApplicationState.pendiente:
        return 'Tu postulación como abogado está en revisión. Recibirás una notificación cuando sea aprobada.';
      case LawyerApplicationState.observada:
        final detail = application.observation?.trim();
        if (detail != null && detail.isNotEmpty) {
          return detail;
        }
        return 'Tu postulación fue observada. Corrige la información solicitada para continuar.';
      case LawyerApplicationState.rechazada:
        final detail = application.observation?.trim();
        if (detail != null && detail.isNotEmpty) {
          return detail;
        }
        return 'Tu postulación fue rechazada. Contáctanos para obtener más detalles.';
      case LawyerApplicationState.aprobada:
      case LawyerApplicationState.none:
      default:
        return null;
    }
  }
  Widget _buildDashboardContent(
    UserSession? session,
    LawyerApplicationStatus application,
    String displayName,
    UserAccount? lawyerAccount,

  ) {
    final String? restrictionMessage =
        _lawyerRestrictionMessage(application, lawyerAccount);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ShadowCard(
          padding: const EdgeInsets.all(15),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.waving_hand,
                    color: AppColors.buttonColor,
                    size: 24,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '¡Hola, $displayName!',
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
                '¿En qué puedo ayudarte hoy?',
                style: TextStyle(
                  fontSize: 14,
                  color: AppColors.text2Color,
                ),
              ),
            ],
          ),
        ),

        if (restrictionMessage != null) ...[
          const SizedBox(height: 16),
          ShadowCard(
            padding: const EdgeInsets.all(15),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.warning_amber_rounded,
                  color: AppColors.tabColor,
                  size: 28,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Atención sobre tu verificación',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.buttonColor,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        restrictionMessage,
                        style: const TextStyle(
                          fontSize: 13,
                          height: 1.35,
                          color: AppColors.text2Color,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 20),
        ShadowCard(
          padding: const EdgeInsets.all(15),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: const [
                  Icon(
                    Icons.chat_bubble_outline,
                    color: AppColors.buttonColor,
                    size: 20,
                  ),
                  SizedBox(width: 8),
                  Text(
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
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.text2Color,
                ),
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
        const SectionHeader(title: 'Servicios'),
        const SizedBox(height: 15),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          crossAxisSpacing: 15,
          mainAxisSpacing: 15,
          childAspectRatio: 1.1,
          children: [
            OptionCard(
              icon: Icons.question_answer,
              title: 'Consultas\nLegales',
              color: AppColors.button2Color,
              onTap: () {
                // TODO
              },
            ),
            OptionCard(
              icon: Icons.directions_car,
              title: 'Búsqueda\nVehicular',
              color: AppColors.tabColor,
              onTap: () {
                // TODO
              },
            ),
            OptionCard(
              icon: Icons.search,
              title: 'Buscar\nAbogados',
              color: AppColors.buttonColor,
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const ClientLawyerSearchScreen(),
                  ),
                );
              },
            ),
            OptionCard(
              icon: Icons.history,
              title: 'Mi\nHistorial',
              color: AppColors.text3Color,
              onTap: () {
                // TODO
              },
            ),
          ],
        ),
        const SizedBox(height: 20),
        ShadowCard(
          padding: const EdgeInsets.all(15),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: const [
                  Icon(
                    Icons.help_outline,
                    color: AppColors.buttonColor,
                    size: 20,
                  ),
                  SizedBox(width: 8),
                  Text(
                    '¿Necesitas ayuda?',
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
                'Nuestro equipo legal está disponible 24/7 para ayudarte con cualquier consulta.',
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.text2Color,
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: CustomButton(
                  text: 'Contactar Soporte',
                  onTap: () {
                    // TODO
                  },
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _buildBecomeLawyerCard(session, application),
      ],
    );
  }


  void _handleLogout() async {
    final bool? shouldLogout = await showDialog<bool>(
      context: context,
      builder:
          (context) => AlertDialog(
            title: const Text('Cerrar sesión'),
            content: const Text('¿Estás seguro de que deseas cerrar sesión?'),
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

  void _navigateToBecomeLawyer(UserSession? session) {
    if (_isSwitchingAccount) return;

    if (session?.hasLawyerAccount ?? false) {
      if (session != null) {
        _switchToLawyerAccount(session);
      }
      return;
    }

    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const BecomeLawyerScreen()),
    );
  }

  void _navigateToLawyerPanel(UserSession? session) {
    if (_isSwitchingAccount) return;

    if (session == null) {
      _showSnackBar(
        'Inicia sesión nuevamente para acceder al panel de abogado',
      );
      return;
    }

    if (!session.hasLawyerAccount) {
      _showSnackBar(
        'Solicita tu verificación para acceder al panel de abogado',
        color: AppColors.text3Color,
      );
      return;
    }

    _switchToLawyerAccount(session);
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<UserSession?>(
      valueListenable: SessionService.instance.notifier,
      builder: (context, session, _) {
        final LawyerApplicationStatus application =
            session?.application ?? LawyerApplicationStatus.empty;
        final bool hasLawyerAccount = session?.hasLawyerAccount ?? false;
        final String displayName =
            (session?.nombreCompleto?.trim().isNotEmpty ?? false)
                ? session!.nombreCompleto!.trim()
                : 'Cliente';
        final String drawerSubtitle =
            hasLawyerAccount
                ? 'Gestiona tus roles desde LegalBot'
                : 'Bienvenido a LegalBot';
final UserAccount? lawyerAccount = _lawyerAccountForSession(session);
        final bool settingsActive = _activeView == _ClientHomeView.settings;
        return Scaffold(
          appBar: const CustomAppBar(title: 'LegalBot - Cliente'),
          drawer: CustomDrawer(
            userType: 'Cliente',
            userIcon: Icons.person,
            userName: displayName,
            subtitle: drawerSubtitle,
            items: [
DrawerItem(
                icon: Icons.home,
                title: 'Inicio',
                selected: _activeView == _ClientHomeView.dashboard,
                onTap: _showHomeView,
              ),              DrawerItem(
                icon: Icons.search,
                title: 'Buscar Abogados',
                onTap: () {
                  Navigator.of(context).pop();
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const ClientLawyerSearchScreen(),
                    ),
                  );
                },
              ),
              DrawerItem(
                icon: Icons.question_answer,
                title: 'Consultas Legales',
                onTap: () {
                  // TODO
                },
              ),
              DrawerItem(
                icon: Icons.directions_car,
                title: 'Búsqueda Vehicular',
                onTap: () {
                  // TODO
                },
              ),
              DrawerItem(
                icon: Icons.history,
                title: 'Historial',
                onTap: () {
                  // TODO
                },
              ),
              DrawerItem(
                icon: Icons.workspace_premium_rounded,
                title: 'Panel Abogado',
                onTap:
                    _isSwitchingAccount
                        ? null
                        : () => _navigateToLawyerPanel(session),
              ),
              DrawerItem(
                icon: Icons.settings,
                title: 'Configuración',
                         selected: settingsActive,
                initiallyExpanded: settingsActive,
                children: [
                  DrawerItem(
                    title: 'Resumen general',
                    selected: settingsActive &&
                        _activeSettingsSubsection ==
                            ClientSettingsSubsection.overview,
                    onTap: () =>
                        _openSettingsSubsection(ClientSettingsSubsection.overview),
                  ),
                  DrawerItem(
                    title: 'Edición de datos de contacto',
                    selected: settingsActive &&
                        _activeSettingsSubsection ==
                            ClientSettingsSubsection.contact,
                    onTap: () =>
                        _openSettingsSubsection(ClientSettingsSubsection.contact),
                  ),
                  DrawerItem(
                    title: 'Seguridad',
                    selected: settingsActive &&
                        _activeSettingsSubsection ==
                            ClientSettingsSubsection.security,
                    onTap: () =>
                        _openSettingsSubsection(ClientSettingsSubsection.security),
                  ),
                ],
              ),
            ],
            onLogout: _handleLogout,
          ),
          body: GradientContainer(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
            child: IndexedStack(
                  index: _activeView.index,
                  children: [
                    _buildDashboardContent(
                      session,
                      application,
                      displayName,
                      lawyerAccount,
                    ),
                    ClientSettingsScreen(
                      key: const ValueKey('client-settings'),
                  subsection: _activeSettingsSubsection,
                  embedded: true,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildBecomeLawyerCard(
    UserSession? session,
    LawyerApplicationStatus application,
  ) {
    final bool hasLawyerAccount = session?.hasLawyerAccount ?? false;
    final _StatusDisplay display = _statusDisplayFor(
      application,
      hasLawyerAccount,
    );

    final Gradient gradient = LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        display.color.withOpacity(0.92),
        AppColors.button2Color.withOpacity(0.95),
      ],
    );
    final String actionText =
        hasLawyerAccount
            ? 'Ir al panel de abogado'
            : (application.state == LawyerApplicationState.none
                ? 'Postular ahora'
                : 'Ver detalles');

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: gradient,
        boxShadow: [
          BoxShadow(
            color: display.color.withOpacity(0.28),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap:
              _isSwitchingAccount
                  ? null
                  : () {
                    if (hasLawyerAccount && session != null) {
                      _switchToLawyerAccount(session);
                    } else {
                      _navigateToBecomeLawyer(session);
                    }
                  },
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      display.icon,
                      color: AppColors.buttonTextColor,
                      size: 40,
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            display.title,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 20,
                              color: AppColors.buttonTextColor,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            display.description,
                            style: const TextStyle(
                              color: AppColors.buttonTextColor,
                              fontSize: 14,
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: CustomButton(
                    text: _isSwitchingAccount ? 'Procesando...' : actionText,
                    onTap:
                        _isSwitchingAccount
                            ? null
                            : () {
                              if (hasLawyerAccount && session != null) {
                                _switchToLawyerAccount(session);
                              } else {
                                _navigateToBecomeLawyer(session);
                              }
                            },
                    color: display.color,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  _StatusDisplay _statusDisplayFor(
    LawyerApplicationStatus status,
    bool hasLawyerAccount,
  ) {
    switch (status.state) {
      case LawyerApplicationState.pendiente:
        return _StatusDisplay(
          title: 'Solicitud en revisión',
          description: 'Estamos verificando tu información profesional.',
          color: AppColors.text3Color,
          icon: Icons.hourglass_top_rounded,
        );
      case LawyerApplicationState.observada:
        final String detail =
            (status.observation?.trim().isNotEmpty ?? false)
                ? status.observation!.trim()
                : 'Actualiza la evidencia solicitada y vuelve a enviar tu solicitud.';
        return _StatusDisplay(
          title: 'Solicitud observada',
          description: detail,
          color: AppColors.buttonColor,
          icon: Icons.fact_check_rounded,
        );
      case LawyerApplicationState.aprobada:
        return _StatusDisplay(
          title: 'Solicitud aprobada',
          description:
              'Tu verificación fue exitosa. Cambia al panel de abogado para comenzar.',
          color: AppColors.button2Color,
          icon: Icons.verified_user,
        );
      case LawyerApplicationState.rechazada:
        final String detail =
            (status.observation?.trim().isNotEmpty ?? false)
                ? status.observation!.trim()
                : 'No pudimos validar la solicitud. Contáctanos para mayor detalle.';
        return _StatusDisplay(
          title: 'Solicitud rechazada',
          description: detail,
          color: AppColors.tabColor,
          icon: Icons.cancel_rounded,
        );
      case LawyerApplicationState.none:
      default:
        if (hasLawyerAccount) {
          return _StatusDisplay(
            title: 'Perfil de abogado activo',
            description:
                'Tu cuenta de abogado está lista. Ingresa para gestionar tus casos.',
            color: AppColors.button2Color,
            icon: Icons.workspace_premium,
          );
        }
        return _StatusDisplay(
          title: 'Conviértete en Abogado',
          description:
              'Únete a nuestra red de profesionales y amplía tus oportunidades.',
          color: AppColors.button2Color,
          icon: Icons.school_rounded,
        );
    }
  }
}

class _StatusDisplay {
  final String title;
  final String description;
  final Color color;
  final IconData icon;

  const _StatusDisplay({
    required this.title,
    required this.description,
    required this.color,
    required this.icon,
  });
}
