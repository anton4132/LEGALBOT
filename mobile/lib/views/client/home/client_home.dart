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
import '../../lawyer/home/lawyer_home.dart';
import 'become_lawyer_screen.dart';

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
              backgroundColor: AppColors.buttonColor,
              foregroundColor: AppColors.buttonTextColor,
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
      MaterialPageRoute(builder: (_) => const LawyerHome()),
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
                        const Icon(Icons.waving_hand,
                            color: AppColors.buttonColor, size: 24),
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
                        color: AppColors.text2Color,
                      ),
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
                      children: const [
                        Icon(Icons.chat_bubble_outline,
                            color: AppColors.buttonColor, size: 20),
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
                      style: TextStyle(fontSize: 12, color: AppColors.text2Color),
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
                children: [ OptionCard( icon: Icons.question_answer, title: 'Consultas\nLegales', color: Colors.blue, onTap: () { // TODO 
                }, ), OptionCard( icon: Icons.directions_car, title: 'Búsqueda\nVehicular', color: Colors.orange, onTap: () { // TODO
                 }, ), OptionCard( icon: Icons.search, title: 'Buscar\nAbogados', color: Colors.green, onTap: () { // TODO 
                 }, ), OptionCard( icon: Icons.history, title: 'Mi\nHistorial', color: Colors.purple, onTap: () { // TODO
                 }, ), ], ),
              const SizedBox(height: 20),

              // Ayuda rápida
              ShadowCard(
                padding: const EdgeInsets.all(15),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: const [
                        Icon(Icons.help_outline,
                            color: AppColors.buttonColor, size: 20),
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
                      style: TextStyle(fontSize: 12, color: AppColors.text2Color),
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

              // CTA Conviértete en Abogado (degradado armónico dentro de la paleta)
              _buildBecomeLawyerCard(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBecomeLawyerCard() {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.tabColor.withOpacity(0.92),
            AppColors.button2Color.withOpacity(0.95),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.tabColor.withOpacity(0.28),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: _navigateToBecomeLawyer,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Row(
              children: [
                const Icon(Icons.school_rounded,
                    color: AppColors.buttonTextColor, size: 40),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        'Conviértete en Abogado',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 20,
                          color: AppColors.buttonTextColor,
                        ),
                      ),
                      SizedBox(height: 6),
                      Text(
                        'Únete a nuestra red de profesionales y expande tus servicios.',
                        style: TextStyle(
                          color: AppColors.buttonTextColor,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.arrow_forward_ios_rounded,
                    color: AppColors.buttonTextColor),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
