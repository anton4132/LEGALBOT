import 'package:flutter/material.dart';
import '../../../Constants/colors.dart';
import '../../../Widgets/custombtn.dart';
import '../../../Widgets/custom_app_bar.dart';
import '../../../Widgets/custom_drawer.dart';
import '../../../Widgets/gradient_container.dart';
import '../../../Widgets/shadow_card.dart';
import '../../../Widgets/option_card.dart';
import '../../../Widgets/section_header.dart';
import '../../../Widgets/consultation_input.dart';

class LawyerHome extends StatefulWidget {
  const LawyerHome({super.key});

  @override
  State<LawyerHome> createState() => _LawyerHomeState();
}

class _LawyerHomeState extends State<LawyerHome> {
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(
        title: 'LegalBot - Abogado',
      ),
      drawer: CustomDrawer(
        userType: 'Abogado',
        userIcon: Icons.gavel,
        userName: 'Abogado',
        subtitle: 'Panel de Control',
        items: [
          DrawerItem(
            icon: Icons.home,
            title: 'Inicio',
            onTap: () {
              // Ya estamos en inicio
            },
          ),
          DrawerItem(
            icon: Icons.info,
            title: 'Información Legal',
            onTap: () {
              // TODO: Navegar a información legal
            },
          ),
          DrawerItem(
            icon: Icons.description,
            title: 'Formatos y Plantillas',
            onTap: () {
              // TODO: Navegar a formatos y plantillas
            },
          ),
          DrawerItem(
            icon: Icons.folder,
            title: 'Archivo de Procesos',
            onTap: () {
              // TODO: Navegar a archivo de procesos
            },
          ),
          DrawerItem(
            icon: Icons.people,
            title: 'Perfil de Clientes',
            onTap: () {
              // TODO: Navegar a perfil de clientes
            },
          ),
          DrawerItem(
            icon: Icons.calendar_today,
            title: 'Calendario',
            onTap: () {
              // TODO: Navegar a calendario
            },
          ),
          DrawerItem(
            icon: Icons.attach_money,
            title: 'Ganancias',
            onTap: () {
              // TODO: Navegar a ganancias
            },
          ),
        ],
        onLogout: () {
          // TODO: Implementar logout
        },
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
                      Icon(Icons.gavel, color: AppColors.buttonColor, size: 24),
                      const SizedBox(width: 8),
                      const Text(
                        '¡Bienvenido Abogado!',
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
                    'Gestiona tus casos y clientes de manera eficiente',
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
            const SectionHeader(title: 'Herramientas'),
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
                  icon: Icons.info,
                  title: 'Información\nLegal',
                  color: Colors.blue,
                  onTap: () {
                    // TODO: Navegar a información legal
                  },
                ),
                OptionCard(
                  icon: Icons.description,
                  title: 'Formatos y\nPlantillas',
                  color: Colors.orange,
                  onTap: () {
                    // TODO: Navegar a formatos y plantillas
                  },
                ),
                OptionCard(
                  icon: Icons.folder,
                  title: 'Archivo de\nProcesos',
                  color: Colors.green,
                  onTap: () {
                    // TODO: Navegar a archivo de procesos
                  },
                ),
                OptionCard(
                  icon: Icons.people,
                  title: 'Perfil de\nClientes',
                  color: Colors.purple,
                  onTap: () {
                    // TODO: Navegar a perfil de clientes
                  },
                ),
              ],
            ),
            
            const SizedBox(height: 20),
            
            // Sección de acciones rápidas
            ShadowCard(
              padding: const EdgeInsets.all(15),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.flash_on, color: AppColors.buttonColor, size: 20),
                      const SizedBox(width: 8),
                      const Text(
                        'Acciones Rápidas',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppColors.buttonColor,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: CustomButton(
                          text: 'Nuevo Caso',
                          onTap: () {
                            // TODO: Crear nuevo caso
                          },
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () {
                            // TODO: Ver calendario
                          },
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(color: AppColors.buttonColor),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text(
                            'Ver Calendario',
                            style: TextStyle(
                              color: AppColors.buttonColor,
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ],
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