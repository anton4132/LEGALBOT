import 'package:flutter/material.dart';

import '../constants/colors.dart';

class OptionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final Color color;
  final VoidCallback onTap;
  final double? iconSize;
  final double? titleSize;

  const OptionCard({
    super.key,
    required this.icon,
    required this.title,
    required this.color,
    required this.onTap,
    this.iconSize,
    this.titleSize,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.buttonTextColor,
          borderRadius: BorderRadius.circular(15),
          boxShadow: [
            BoxShadow(
              color: AppColors.strokeColor.withOpacity(0.5),
              spreadRadius: 1,
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(15),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: iconSize ?? 40,
                color: color,
              ),
            ),
            const SizedBox(height: 15),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: titleSize ?? 14,
                fontWeight: FontWeight.w600,
                color: AppColors.text1Color,
              ),
            ),
          ],
        ),
      ),
    );
  }
} 