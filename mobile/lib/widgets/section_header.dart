import 'package:flutter/material.dart';

import '../constants/colors.dart';

class SectionHeader extends StatelessWidget {
  final String title;
  final Color? textColor;
  final double? fontSize;
  final FontWeight? fontWeight;

  const SectionHeader({
    super.key,
    required this.title,
    this.textColor,
    this.fontSize,
    this.fontWeight,
  });

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: TextStyle(
        fontSize: fontSize ?? 20,
        fontWeight: fontWeight ?? FontWeight.w700,
        color: textColor ?? AppColors.buttonTextColor,
      ),
    );
  }
}