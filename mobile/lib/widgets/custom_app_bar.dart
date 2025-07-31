import 'package:flutter/material.dart';
import '../Constants/colors.dart';

class CustomAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget>? actions;
  final VoidCallback? onNotificationPressed;
  final VoidCallback? onProfilePressed;

  const CustomAppBar({
    super.key,
    required this.title,
    this.actions,
    this.onNotificationPressed,
    this.onProfilePressed,
  });

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: AppColors.buttonColor,
      foregroundColor: Colors.white,
      title: Text(title),
      elevation: 0,
      actions: actions ?? [
        IconButton(
          icon: const Icon(Icons.notifications),
          onPressed: onNotificationPressed ?? () {
            // TODO: Implementar notificaciones
          },
        ),
        IconButton(
          icon: const Icon(Icons.person),
          onPressed: onProfilePressed ?? () {
            // TODO: Implementar perfil
          },
        ),
      ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
} 