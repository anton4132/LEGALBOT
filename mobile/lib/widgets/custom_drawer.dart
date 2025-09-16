import 'package:flutter/material.dart';
import '../constants/colors.dart';

class CustomDrawer extends StatelessWidget {
  final String userType;
  final IconData userIcon;
  final String userName;
  final String subtitle;
  final List<DrawerItem> items;
  final VoidCallback? onLogout;

  const CustomDrawer({
    super.key,
    required this.userType,
    required this.userIcon,
    required this.userName,
    required this.subtitle,
    required this.items,
    this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          DrawerHeader(
            decoration: BoxDecoration(
              color: AppColors.buttonColor,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: 30,
                  backgroundColor: Colors.white,
                  child: Icon(userIcon, size: 35, color: AppColors.buttonColor),
                ),
                const SizedBox(height: 10),
                Text(
                  userName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.8),
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          ...items.map((item) => ListTile(
            leading: Icon(item.icon, color: AppColors.buttonColor),
            title: Text(item.title),
            onTap: () {
              Navigator.pop(context);
              item.onTap?.call();
            },
          )),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Cerrar Sesión', style: TextStyle(color: Colors.red)),
            onTap: () {
              Navigator.pop(context);
              onLogout?.call();
            },
          ),
        ],
      ),
    );
  }
}

class DrawerItem {
  final IconData icon;
  final String title;
  final VoidCallback? onTap;

  const DrawerItem({
    required this.icon,
    required this.title,
    this.onTap,
  });
} 