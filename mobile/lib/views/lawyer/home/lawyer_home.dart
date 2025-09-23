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

class LawyerHome extends StatefulWidget {
  const LawyerHome({super.key});

  @override
  State<LawyerHome> createState() => _LawyerHomeState();
}

class _LawyerHomeState extends State<LawyerHome> {
  final TextEditingController _consultationController = TextEditingController();
  bool _isRecording = false;
  bool _isSwitchingAccount = false;

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

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<UserSession?>(
      valueListenable: SessionService.instance.notifier,
      builder: (context, session, _) {
        final displayName =
            (session?.nombreCompleto?.trim().isNotEmpty ?? false)
                ? session!.nombreCompleto!.trim()
                : 'Abogado';

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
                Expanded(
                  child: GridView.count(
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
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
