import 'package:flutter/material.dart';

import '../../../constants/colors.dart';
import '../../../widgets/customapp_bar.dart';
import '../../../widgets/custombtn.dart';
import '../../../widgets/detailstext1.dart';
import '../../../widgets/detailstext2.dart';
import 'models/wallet_top_up.dart';
import 'wallet_screen.dart';

class TopUpWalletSuccessfully extends StatelessWidget {
  const TopUpWalletSuccessfully({
    super.key,
    required this.details,
    required this.reference,
    required this.onFinish,
  });

  final WalletTopUpDetails details;
  final String reference;
  final WalletTopUpCompletion onFinish;

  void _finish(BuildContext context) {
    onFinish(details, reference);
    Navigator.of(context).popUntil(
      (route) => route.settings.name == WalletScreen.routeName || route.isFirst,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const CustomAppBar(text: 'Recarga exitosa', text1: ''),
              const SizedBox(height: 80),
              Center(
                child: Column(
                  children: [
                    const CircleAvatar(
                      radius: 48,
                      backgroundColor: AppColors.buttonColor,
                      child: Icon(
                        Icons.check,
                        color: Colors.white,
                        size: 56,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text1(
                      text1: '¡Recarga completada!',
                      size: 24,
                    ),
                    const SizedBox(height: 8),
                    Text2(
                      text2:
                          'Se acreditaron ${details.formattedAmount} en tu wallet.',
                    ),
                    const SizedBox(height: 4),
                    Text2(
                      text2: 'Referencia de operación: $reference',
                    ),
                  ],
                ),
              ),
              const Spacer(),
              CustomButton(
                text: 'Volver a la Wallet',
                onTap: () => _finish(context),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
