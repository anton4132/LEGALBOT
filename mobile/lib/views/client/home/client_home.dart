import 'package:flutter/material.dart';
import '../../../constants/colors.dart';
import '../../../widgets/custombtn.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../../widgets/custom_drawer.dart';
import '../../../widgets/gradient_container.dart';
import '../../../widgets/shadow_card.dart';
import '../../../widgets/option_card.dart';
import '../../../widgets/section_header.dart';
import '../../../widgets/consultation_input.dart';
import '../../authentication/login_screen.dart';

class ClientHome extends StatefulWidget {
  const ClientHome({super.key});

  @override
  State<ClientHome> createState() => _ClientHomeState();
}

class _ClientHomeState extends State<ClientHome> {
  final TextEditingController _consultationController = TextEditingController();
  bool _isRecording = false;

  @override
  void dispose() {
    _consultationController.dispose();
    super.dispose();
  }

  void _handleSendConsultation() {
    final text = _consultationController.text.trim();
    if (text.isNotEmpty) {
      // TODO: Implementar envío de consulta
      print('Consulta enviada: $text');
      _consultationController.clear();
    }
  }

  void _handleMicPressed() {
    setState(() {
      _isRecording = !_isRecording;
    });
    // TODO: Implementar grabación de voz
    if (_isRecording) {
      print('Iniciando grabación...');
    } else {
      print('Deteniendo grabación...');
    }
  }

  void _handleLogout() async {
    final bool? shouldLogout = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
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
            ),
            child: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );

    if (!(shouldLogout ?? false) || !mounted) {
      return;
    }

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(
        title: 'LegalBot - Cliente',
      ),
      drawer: CustomDrawer(
        userType: 'Cliente',
        userIcon: Icons.person,
        userName: 'Cliente',
        subtitle: 'Bienvenido a LegalBot',
        items: [
          DrawerItem(
            icon: Icons.home,
            title: 'Inicio',
            onTap: () {
              // Ya estamos en inicio
            },
          ),
          DrawerItem(
            icon: Icons.search,
            title: 'Buscar Abogados',
            onTap: () {
              // TODO: Navegar a búsqueda de abogados
            },
          ),
          DrawerItem(
            icon: Icons.question_answer,
            title: 'Consultas Legales',
            onTap: () {
              // TODO: Navegar a consultas legales
            },
          ),
          DrawerItem(
            icon: Icons.directions_car,
            title: 'Búsqueda Vehicular',
            onTap: () {
              // TODO: Navegar a búsqueda vehicular
            },
          ),
          DrawerItem(
            icon: Icons.history,
            title: 'Historial',
            onTap: () {
              // TODO: Navegar a historial
            },
          ),
          DrawerItem(
            icon: Icons.settings,
            title: 'Configuración',
            onTap: () {
              // TODO: Navegar a configuración
            },
          ),
        ],
        onLogout: _handleLogout,

      ),
      body: GradientContainer(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Saludo (más delgado)
            ShadowCard(
              padding: const EdgeInsets.all(15),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.waving_hand, color: AppColors.buttonColor, size: 24),
                      const SizedBox(width: 8),
                      const Text(
                        '¡Hola!',
                        style: TextStyle(
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
                      color: Colors.grey,
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 20),
            
            // Input de consulta rápida (más delgado)
            ShadowCard(
              padding: const EdgeInsets.all(15),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.chat_bubble_outline, color: AppColors.buttonColor, size: 20),
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
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey,
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
            
            // Opciones principales
            const SectionHeader(title: 'Servicios'),
            const SizedBox(height: 15),
            
            // Grid de opciones
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
                  color: Colors.blue,
                  onTap: () {
                    // TODO: Navegar a consultas legales
                  },
                ),
                OptionCard(
                  icon: Icons.directions_car,
                  title: 'Búsqueda\nVehicular',
                  color: Colors.orange,
                  onTap: () {
                    // TODO: Navegar a búsqueda vehicular
                  },
                ),
                OptionCard(
                  icon: Icons.search,
                  title: 'Buscar\nAbogados',
                  color: Colors.green,
                  onTap: () {
                    // TODO: Navegar a búsqueda de abogados
                  },
                ),
                OptionCard(
                  icon: Icons.history,
                  title: 'Mi\nHistorial',
                  color: Colors.purple,
                  onTap: () {
                    // TODO: Navegar a historial
                  },
                ),
              ],
            ),
            
            const SizedBox(height: 20),
            
            // Sección de ayuda rápida (más delgado)
            ShadowCard(
              padding: const EdgeInsets.all(15),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.help_outline, color: AppColors.buttonColor, size: 20),
                      const SizedBox(width: 8),
                      const Text(
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
                      color: Colors.grey,
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: CustomButton(
                      text: 'Contactar Soporte',
                      onTap: () {
                        // TODO: Implementar contacto con soporte
                      },
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