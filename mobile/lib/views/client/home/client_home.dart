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
import 'become_lawyer_screen.dart'; 



class ModernClientHome extends StatefulWidget {
  const ModernClientHome({super.key});

  @override
  State<ModernClientHome> createState() => _ModernClientHomeState();
}

class _ModernClientHomeState extends State<ModernClientHome> {
  final TextEditingController _consultationController = TextEditingController();

  void _navigateToBecomeLawyer() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const BecomeLawyerScreen()),
    );
  }

  @override
  void dispose() {
    _consultationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('LegalBot'),
      ),
      drawer: _buildDrawer(), // Drawer personalizado para mantener el estilo
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildGreetingCard(),
            const SizedBox(height: 24),
            _buildQuickConsultation(),
            const SizedBox(height: 24),
            _buildServicesGrid(),
            const SizedBox(height: 24),
            _buildBecomeLawyerCard(),
          ],
        ),
      ),
    );
  }

  Widget _buildGreetingCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Row(
          children: [
            const Icon(Icons.waving_hand_rounded, color: AppTheme.primaryColor, size: 28),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '¡Hola, Cliente!',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textColor,
                      ),
                ),
                Text(
                  '¿En qué podemos ayudarte hoy?',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: AppTheme.textSecondaryColor,
                      ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickConsultation() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Consulta Rápida',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _consultationController,
          maxLines: 3,
          decoration: InputDecoration(
            hintText: 'Describe tu caso aquí...',
            suffixIcon: Padding(
              padding: const EdgeInsets.all(8.0),
              child: IconButton(
                icon: const Icon(Icons.send_rounded, color: AppTheme.primaryColor),
                onPressed: () {
                  // Lógica de envío
                },
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildServicesGrid() {
    final services = [
      {'icon': Icons.gavel_rounded, 'title': 'Consultas\nLegales', 'color': AppTheme.primaryColor},
      {'icon': Icons.directions_car_filled_rounded, 'title': 'Búsqueda\nVehicular', 'color': AppTheme.accentColor},
      {'icon': Icons.group_rounded, 'title': 'Buscar\nAbogados', 'color': Colors.lightBlue},
      {'icon': Icons.history_rounded, 'title': 'Mi\nHistorial', 'color': Colors.orangeAccent},
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Nuestros Servicios',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 16),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            childAspectRatio: 1.1,
          ),
          itemCount: services.length,
          itemBuilder: (context, index) {
            final service = services[index];
            return Card(
              elevation: 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(color: (service['color'] as Color).withOpacity(0.5), width: 1.5)
              ),
              child: InkWell(
                onTap: () {},
                borderRadius: BorderRadius.circular(20),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(service['icon'] as IconData, size: 40, color: service['color'] as Color),
                    const SizedBox(height: 12),
                    Text(
                      service['title'] as String,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        height: 1.3
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }
  
  Widget _buildBecomeLawyerCard() {
    return Card(
      color: AppTheme.accentColor.withOpacity(0.2),
       shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: AppTheme.accentColor, width: 1.5)
      ),
      child: InkWell(
        onTap: _navigateToBecomeLawyer,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Row(
            children: [
              const Icon(Icons.school_rounded, color: AppTheme.accentColor, size: 40),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Conviértete en Abogado',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Colors.white
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Únete a nuestra red de profesionales y expande tus servicios.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppTheme.textSecondaryColor,
                          ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_ios_rounded, color: AppTheme.textSecondaryColor),
            ],
          ),
        ),
      ),
    );
  }

  Drawer _buildDrawer() {
    // Puedes personalizar este drawer para que coincida con el nuevo estilo
    return Drawer(
      backgroundColor: AppTheme.cardColor,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          const UserAccountsDrawerHeader(
            accountName: Text('Cliente'),
            accountEmail: Text('cliente@email.com'),
            currentAccountPicture: CircleAvatar(
              backgroundColor: AppTheme.primaryColor,
              child: Text('C', style: TextStyle(fontSize: 40.0, color: Colors.white)),
            ),
            decoration: BoxDecoration(
              color: AppTheme.backgroundColor,
            ),
          ),
          ListTile(
            leading: const Icon(Icons.home, color: AppTheme.textSecondaryColor),
            title: const Text('Inicio', style: TextStyle(color: AppTheme.textColor)),
            onTap: () {
              Navigator.pop(context);
            },
          ),
           ListTile(
            leading: const Icon(Icons.logout, color: AppTheme.errorColor),
            title: const Text('Cerrar Sesión', style: TextStyle(color: AppTheme.errorColor)),
            onTap: () {
              // Lógica de logout
            },
          ),
        ],
      ),
    );
  }
}
