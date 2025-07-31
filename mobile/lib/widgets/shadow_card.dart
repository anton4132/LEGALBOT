import 'package:flutter/material.dart';

class ShadowCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final double? borderRadius;
  final Color? backgroundColor;
  final double? shadowOpacity;
  final double? shadowBlurRadius;
  final double? shadowSpreadRadius;
  final Offset? shadowOffset;

  const ShadowCard({
    super.key,
    required this.child,
    this.padding,
    this.borderRadius,
    this.backgroundColor,
    this.shadowOpacity,
    this.shadowBlurRadius,
    this.shadowSpreadRadius,
    this.shadowOffset,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding ?? const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: backgroundColor ?? Colors.white,
        borderRadius: BorderRadius.circular(borderRadius ?? 15),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(shadowOpacity ?? 0.2),
            spreadRadius: shadowSpreadRadius ?? 1,
            blurRadius: shadowBlurRadius ?? 10,
            offset: shadowOffset ?? const Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );
  }
} 