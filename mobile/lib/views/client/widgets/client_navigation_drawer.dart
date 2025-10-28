import 'package:flutter/material.dart';

import '../../../constants/colors.dart';
import '../../../models/lawyer_application.dart';
import '../../../models/user_session.dart';
import '../../../services/api_client.dart';
import '../../../services/session_service.dart';
import '../../../widgets/custom_drawer.dart';
import '../../lawyer/home/lawyer_home.dart';
import '../../authentication/login_screen.dart';
import '../home/client_settings_screen.dart';

enum ClientDrawerDestination { dashboard, search, settings }

class ClientNavigationDrawer extends StatelessWidget {
  final ClientDrawerDestination activeDestination;
  final ClientSettingsSubsection activeSettingsSubsection;
  final VoidCallback? onSelectDashboard;
  final VoidCallback? onSelectSearch;
  final ValueChanged<ClientSettingsSubsection>? onSelectSettingsSubsection;
  final Future<void> Function(BuildContext context)? onSelectLawyerPanel;
  final VoidCallback? onLogout;
  final bool isSwitchingAccount;

  const ClientNavigationDrawer({
    super.key,
    required this.activeDestination,
    this.activeSettingsSubsection = ClientSettingsSubsection.overview,
    this.onSelectDashboard,
    this.onSelectSearch,
    this.onSelectSettingsSubsection,
    this.onSelectLawyerPanel,
    this.onLogout,
    this.isSwitchingAccount = false,
  });

  @override
  Widget build(BuildContext context) {
    final session = SessionService.instance.session;
    final hasLawyerAccount = session?.hasLawyerAccount ?? false;
    final displayName =
        (session?.nombreCompleto?.trim().isNotEmpty ?? false)
            ? session!.nombreCompleto!.trim()
            : 'Cliente';
    final subtitle = hasLawyerAccount
        ? 'Gestiona tus roles desde LegalBot'
        : 'Bienvenido a LegalBot';

    return CustomDrawer(
      userType: 'Cliente',
      userIcon: Icons.person,
      userName: displayName,
      subtitle: subtitle,
      items: [
        DrawerItem(
          icon: Icons.home,
          title: 'Inicio',
          selected: activeDestination == ClientDrawerDestination.dashboard,
          onTap: onSelectDashboard,
        ),
        DrawerItem(
          icon: Icons.search,
          title: 'Buscar Abogados',
          selected: activeDestination == ClientDrawerDestination.search,
          onTap: onSelectSearch,
        ),
        const DrawerItem(
          icon: Icons.question_answer,
          title: 'Consultas Legales',
        ),
        const DrawerItem(
          icon: Icons.directions_car,
          title: 'Búsqueda Vehicular',
        ),
        const DrawerItem(
          icon: Icons.history,
          title: 'Historial',
        ),
        DrawerItem(
          icon: Icons.workspace_premium_rounded,
          title: 'Panel Abogado',
          trailing: isSwitchingAccount
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : null,
          onTap: isSwitchingAccount
              ? null
              : () async {
                  if (onSelectLawyerPanel != null) {
                    await onSelectLawyerPanel!(context);
                  } else {
                    await _defaultNavigateToLawyerPanel(context);
                  }
                },
        ),
        DrawerItem(
          icon: Icons.settings,
          title: 'Configuración',
          selected: activeDestination == ClientDrawerDestination.settings,
          initiallyExpanded: activeDestination == ClientDrawerDestination.settings,
          children: ClientSettingsSubsection.values
              .map(
                (subsection) => DrawerItem(
                  title: _labelForSubsection(subsection),
                  selected: activeDestination == ClientDrawerDestination.settings &&
                      activeSettingsSubsection == subsection,
                  onTap: () => onSelectSettingsSubsection?.call(subsection),
                ),
              )
              .toList(),
        ),
      ],
      onLogout: onLogout,
    );
  }

  Future<void> _defaultNavigateToLawyerPanel(BuildContext context) async {
    final session = SessionService.instance.session;
    if (session == null) {
      _showSnackBar(
        context,
        'Inicia sesión nuevamente para acceder al panel de abogado',
        AppColors.text3Color,
      );
      return;
    }

    final lawyerAccount = SessionService.instance.accountForRole('abogado');
    if (lawyerAccount == null) {
      _showSnackBar(
        context,
        'No tienes una cuenta de abogado activa',
        AppColors.text3Color,
      );
      return;
    }

    final application = session.application;
    final restrictionMessage = _restrictionMessage(application, lawyerAccount);
    if (restrictionMessage != null) {
      _showSnackBar(context, restrictionMessage, AppColors.text3Color);
      return;
    }

    try {
      final result = await ApiClient.switchAccount(
        token: session.token,
        usuarioId: lawyerAccount.usuarioId,
      );
      final updatedSession = session.applySwitchResult(result);
      SessionService.instance.setSession(updatedSession);
      if (!context.mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const LawyerHome()),
      );
    } on UnauthorizedException catch (error) {
      _handleUnauthorized(context, error.message);
    } catch (error) {
      if (!context.mounted) return;
      final resolved = error.toString().replaceFirst('Exception: ', '');
      _showSnackBar(
        context,
        resolved.isEmpty
            ? 'No se pudo cambiar a la cuenta de abogado'
            : resolved,
        AppColors.text3Color,
      );
    }
  }

  String _labelForSubsection(ClientSettingsSubsection subsection) {
    switch (subsection) {
      case ClientSettingsSubsection.overview:
        return 'Resumen general';
      case ClientSettingsSubsection.contact:
        return 'Edición de datos de contacto';
      case ClientSettingsSubsection.security:
        return 'Seguridad';
    }
  }

  String? _restrictionMessage(
    LawyerApplicationStatus application,
    UserAccount account,
  ) {
    if (!account.activo) {
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
        return null;
    }
  }

  void _handleUnauthorized(BuildContext context, String message) {
    SessionService.instance.clear();
    if (!context.mounted) return;
    final resolved = message.trim().isEmpty
        ? 'Tu sesión ha expirado. Inicia sesión nuevamente.'
        : message.trim();
    _showSnackBar(context, resolved, AppColors.text3Color);
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  void _showSnackBar(BuildContext context, String message, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: color,
      ),
    );
  }
}
