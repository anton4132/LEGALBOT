import 'package:flutter/material.dart';
import '../../../constants/colors.dart'; // Debe exportar AppTheme
import '../../../widgets/custombtn.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../../widgets/custom_drawer.dart';
import '../../../widgets/gradient_container.dart';
import '../../../widgets/shadow_card.dart';
import '../../../widgets/option_card.dart';
import '../../../widgets/section_header.dart';
import '../../../widgets/consultation_input.dart';
import '../../authentication/login_screen.dart';
import 'become_lawyer_screen.dart';


//import 'lawyer_screen.dart'; // <- Ajusta la ruta si tu archivo está en otro sitio

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
      // TODO: Implementar envío de consulta al backend
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
              backgroundColor: AppColors.primaryColor,
            ),
            child: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );

    if (!(shouldLogout ?? false) || !mounted) return;

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  void _navigateToBecomeLawyer() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const BecomeLawyerScreen()),
    );
  }

  void _navigateToLawyerPanel() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const LawyerScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'LegalBot - Cliente'),
      drawer: CustomDrawer(
        userType: 'Cliente',
        userIcon: Icons.person,
        userName: 'Cliente',
        subtitle: 'Bienvenido a LegalBot',
        items: [
          DrawerItem(
            icon: Icons.home,
            title: 'Inicio',
            onTap: () => Navigator.pop(context),
          ),
          DrawerItem(
            icon: Icons.search,
            title: 'Buscar Abogados',
            onTap: () {
              // TODO
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
            onTap: _navigateToLawyerPanel,
          ),
          DrawerItem(
            icon: Icons.settings,
            title: 'Configuración',
            onTap: () {
              // TODO
            },
          ),
        ],
        onLogout: _handleLogout,
      ),
      body: GradientContainer(
        child: SingleChildScrollView(
          padding: const EdgeInsets.only(bottom: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Saludo
              ShadowCard(
                padding: const EdgeInsets.all(15),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.waving_hand, color: AppColors.primaryColor, size: 24),
                        const SizedBox(width: 8),
                        Text(
                          '¡Hola!',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primaryColor,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    const Text(
                      '¿En qué puedo ayudarte hoy?',
                      style: TextStyle(fontSize: 14, color: Colors.grey),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Consulta rápida
              ShadowCard(
                padding: const EdgeInsets.all(15),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.chat_bubble_outline, color: AppColors.primaryColor, size: 20),
                        const SizedBox(width: 8),
                        Text(
                          'Consulta Rápida',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primaryColor,
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

              // Servicios
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
                    color: Colors.blue,
                    onTap: () {
                      // TODO
                    },
                  ),
                  OptionCard(
                    icon: Icons.directions_car,
                    title: 'Búsqueda\nVehicular',
                    color: Colors.orange,
                    onTap: () {
                      // TODO
                    },
                  ),
                  OptionCard(
                    icon: Icons.search,
                    title: 'Buscar\nAbogados',
                    color: Colors.green,
                    onTap: () {
                      // TODO
                    },
                  ),
                  OptionCard(
                    icon: Icons.history,
                    title: 'Mi\nHistorial',
                    color: Colors.purple,
                    onTap: () {
                      // TODO
                    },
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // Ayuda rápida
              ShadowCard(
                padding: const EdgeInsets.all(15),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.help_outline, color: AppColors.primaryColor, size: 20),
                        const SizedBox(width: 8),
                        Text(
                          '¿Necesitas ayuda?',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primaryColor,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Nuestro equipo legal está disponible 24/7 para ayudarte con cualquier consulta.',
                      style: TextStyle(fontSize: 12, color: Colors.grey),
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

              // CTA Conviértete en Abogado
              _buildBecomeLawyerCard(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBecomeLawyerCard() {
    return Card(
      color: AppColors.accentColor.withOpacity(0.2),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: AppColors.accentColor, width: 1.5),
      ),
      child: InkWell(
        onTap: _navigateToBecomeLawyer,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Row(
            children: [
              const Icon(Icons.school_rounded, color: AppColors.accentColor, size: 40),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Conviértete en Abogado',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Únete a nuestra red de profesionales y expande tus servicios.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.textSecondaryColor,
                          ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_ios_rounded, color: AppColors.textSecondaryColor),
            ],
          ),
        ),
      ),
    );
  }
}
