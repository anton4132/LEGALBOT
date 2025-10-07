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
            ..._buildDrawerItems(context, items),
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

  List<Widget> _buildDrawerItems(
    BuildContext context,
    List<DrawerItem> drawerItems, {
    bool isChild = false,
  }) {
    final List<Widget> tiles = <Widget>[];
    for (final DrawerItem item in drawerItems) {
      final bool hasChildren = item.children.isNotEmpty;
      final EdgeInsetsGeometry padding = EdgeInsets.only(
        left: isChild ? 32 : 16,
        right: 16,
      );

      if (hasChildren) {
        final bool highlight =
            item.selected || item.children.any((child) => child.selected);
             final double fontSize = isChild ? 15 : 17;
        final TextStyle titleStyle = TextStyle(
          fontSize: fontSize,
          fontWeight: highlight ? FontWeight.w700 : FontWeight.w600,
          color: highlight ? AppColors.buttonColor : Colors.black87,
          height: 1.2,
        );
        tiles.add(
          Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              tilePadding: padding,
              childrenPadding: EdgeInsets.zero,
              initiallyExpanded:
                  item.initiallyExpanded || item.children.any((child) => child.selected),
              leading: item.icon != null
                    ? Icon(
                      item.icon,
                      color: highlight ? AppColors.buttonColor : Colors.black54,
                    )                  : null,
              title: Row(
                children: [
                  Expanded(
                    child: Text(
                      item.title,
                        style: titleStyle,

                    ),
                  ),
                  if (item.trailing != null) item.trailing!,
                ],
              ),
              children:
                  _buildDrawerItems(context, item.children, isChild: true),
            ),
          ),
        );
      } else {
        final bool highlighted = item.selected;
        final TextStyle titleStyle = TextStyle(
          fontSize: isChild ? 14 : 16,
          fontWeight: highlighted
              ? FontWeight.w600
              : (isChild ? FontWeight.w500 : FontWeight.w600),
          color: highlighted ? AppColors.buttonColor : Colors.black87,
          height: 1.2,
        );
        tiles.add(
          ListTile(
            leading: item.icon != null
                  ? Icon(
                    item.icon,
                    color: highlighted ? AppColors.buttonColor : Colors.black54,
                  )                : null,
            title: Text(
              item.title,
              style: titleStyle,
            ),
            trailing: item.trailing,
            selected: item.selected,
            selectedTileColor: AppColors.buttonColor.withOpacity(0.08),
            hoverColor: AppColors.buttonColor.withOpacity(0.04),
            enabled: item.onTap != null,
            onTap: item.onTap == null
                ? null
                : () {
                    Navigator.pop(context);
                    item.onTap!();
                  },
            contentPadding: padding,
            dense: isChild,
          ),
        );
      }
    }
    return tiles;
  }
}

class DrawerItem {
  final IconData? icon;
  final String title;
  final VoidCallback? onTap;
  final Widget? trailing;
  final List<DrawerItem> children;
  final bool selected;
  final bool initiallyExpanded;

  const DrawerItem({
    this.icon,
    required this.title,
    this.onTap,
    this.trailing,
    this.children = const <DrawerItem>[],
    this.selected = false,
    this.initiallyExpanded = false,
  });
}