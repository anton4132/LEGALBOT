import 'package:flutter/material.dart';
import '../constants/colors.dart';

class GradientContainer extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final List<Color>? colors;
  final AlignmentGeometry? begin;
  final AlignmentGeometry? end;

  const GradientContainer({
    super.key,
    required this.child,
    this.padding,
    this.colors,
    this.begin,
    this.end,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: begin ?? Alignment.topCenter,
          end: end ?? Alignment.bottomCenter,
          colors: colors ?? [AppColors.buttonColor, AppColors.buttonTextColor],
        ),
      ),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: padding ?? const EdgeInsets.all(20.0),
          child: child,
        ),
      ),
    );
  }
}