import 'package:flutter/material.dart';

import '../../../constants/colors.dart';
import '../../../widgets/customapp_bar.dart';
import '../../../widgets/custombtn.dart';
import '../../../widgets/detailstext1.dart';
import '../../../widgets/detailstext2.dart';
import 'models/wallet_top_up.dart';
import 'top_upwallet_successfully.dart';

class TopUpEWallet extends StatefulWidget {
  const TopUpEWallet({
    super.key,
    required this.details,
    required this.onConfirmed,
  });

  final WalletTopUpDetails details;
  final WalletTopUpCompletion onConfirmed;

  @override
  State<TopUpEWallet> createState() => _TopUpEWalletState();
}

class _TopUpEWalletState extends State<TopUpEWallet> {
  bool _acceptedTerms = false;
  bool _processing = false;

  String get _formattedAmount => widget.details.formattedAmount;

  Future<void> _confirmTopUp() async {
    if (!_acceptedTerms || _processing) return;
    setState(() => _processing = true);

    await Future.delayed(const Duration(milliseconds: 800));
    final reference = _buildReference();

    if (!mounted) return;

    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => TopUpWalletSuccessfully(
          details: widget.details,
          reference: reference,
          onFinish: widget.onConfirmed,
        ),
      ),
    );

    if (mounted) {
      setState(() => _processing = false);
    }
  }

  String _buildReference() {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    return 'LB-${widget.details.currency}-$timestamp';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 14),
          children: [
            const CustomAppBar(text: 'Confirmar recarga', text1: ''),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text1(
                    text1: 'Resumen de la recarga',
                    size: 18,
                  ),
                  const SizedBox(height: 12),
                  _SummaryRow(
                    label: 'Monto',
                    value: _formattedAmount,
                  ),
                  _SummaryRow(
                    label: 'Método',
                    value: widget.details.paymentMethod.label,
                  ),
                  _SummaryRow(
                    label: 'Moneda',
                    value: widget.details.currency,
                  ),
                  _SummaryRow(
                    label: 'Voucher',
                    value:
                        widget.details.voucherCode?.toUpperCase() ?? 'No aplicado',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.button2Color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text2(
                text2:
                    'Recuerda que las próximas versiones podrían incluir comisiones '
                    'adicionales según el método seleccionado. Revisa siempre los '
                    'términos antes de confirmar.',
              ),
            ),
            const SizedBox(height: 20),
            CheckboxListTile(
              value: _acceptedTerms,
              onChanged: (value) {
                setState(() => _acceptedTerms = value ?? false);
              },
              title: const Text(
                'He leído y acepto los términos y condiciones de recarga.',
              ),
              controlAffinity: ListTileControlAffinity.leading,
              activeColor: AppColors.buttonColor,
              contentPadding: EdgeInsets.zero,
            ),
            const SizedBox(height: 12),
            CustomButton(
              text: _processing ? 'Confirmando...' : 'Confirmar',
              onTap: _acceptedTerms && !_processing ? _confirmTopUp : null,
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text2(
              text2: label,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text1(
              text1: value,
              size: 15,
            ),
          ),
        ],
      ),
    );
  }
}