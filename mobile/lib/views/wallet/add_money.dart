import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../constants/colors.dart';
import '../../../widgets/customapp_bar.dart';
import '../../../widgets/custombtn.dart';
import '../../../widgets/detailstext1.dart';
import '../../../widgets/detailstext2.dart';
import 'models/wallet_top_up.dart';
import 'top_up_ewallet.dart';

class AddMoneyScreen extends StatefulWidget {
  const AddMoneyScreen({
    super.key,
    required this.initialCurrency,
    required this.onCompleted,
  });

  final String initialCurrency;
  final WalletTopUpCompletion onCompleted;

  @override
  State<AddMoneyScreen> createState() => _AddMoneyScreenState();
}

class _AddMoneyScreenState extends State<AddMoneyScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _voucherController = TextEditingController();

  late String _selectedCurrency;
  WalletPaymentMethod? _selectedMethod;
  bool _useVoucher = false;
  bool _submitting = false;

  static const List<String> _currencies = ['USD', 'PEN', 'EUR'];

  @override
  void initState() {
    super.initState();
    _selectedCurrency = _currencies.contains(widget.initialCurrency)
        ? widget.initialCurrency
        : _currencies.first;
  }

  @override
  void dispose() {
    _amountController.dispose();
    _voucherController.dispose();
    super.dispose();
  }

  String? _validateAmount(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Ingresa un monto válido';
    }
    final normalized = value.replaceAll(',', '.');
    final amount = double.tryParse(normalized);
    if (amount == null) {
      return 'Usa solo números';
    }
    final parts = normalized.split('.');
    if (parts.length > 2 || (parts.length == 2 && parts[1].length > 2)) {
      return 'Máximo 2 decimales';
    }
    if (amount <= 0) {
      return 'El monto debe ser mayor a 0';
    }
    return null;
  }

  void _submit() async {
    if (_submitting) return;
    final isValid = _formKey.currentState?.validate() ?? false;
    if (!isValid) return;
    if (_selectedMethod == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecciona un método de pago')),
      );
      return;
    }
    if (_useVoucher && _voucherController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ingresa el código del voucher')),
      );
      return;
    }

    setState(() => _submitting = true);

    final normalized = _amountController.text.replaceAll(',', '.');
    final amount = double.parse(normalized);
    final details = WalletTopUpDetails(
      amount: amount,
      currency: _selectedCurrency,
      paymentMethod: _selectedMethod!,
      voucherCode: _useVoucher ? _voucherController.text.trim() : null,
    );

    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => TopUpEWallet(
          details: details,
          onConfirmed: widget.onCompleted,
        ),
      ),
    );

    if (mounted) {
      setState(() => _submitting = false);
    }
  }

  InputDecoration _inputDecoration({
    required String hintText,
    Widget? prefixIcon,
  }) {
    return InputDecoration(
      contentPadding:
          const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
      hintText: hintText,
      prefixIcon: prefixIcon,
      filled: true,
      fillColor: Colors.white,
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Colors.white),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.buttonColor, width: 1.5),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 14),
          children: [
            const CustomAppBar(text: 'Agregar fondos', text1: ''),
            const SizedBox(height: 20),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
              decoration: BoxDecoration(
                color: AppColors.button2Color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text2(text2: 'Saldo actual estimado'),
                  const SizedBox(height: 4),
                  Text1(
                    text1:
                        'La recarga se aplicará en ${_selectedCurrency.toUpperCase()}',
                    size: 14,
                  ),
                  const SizedBox(height: 16),
                  Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        TextFormField(
                          controller: _amountController,
                          keyboardType:
                              const TextInputType.numberWithOptions(decimal: true),
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(
                              RegExp('[0-9.,]'),
                            ),
                          ],
                          validator: _validateAmount,
                          decoration: _inputDecoration(
                            hintText: 'Monto (ej. 120.50)',
                            prefixIcon: const Icon(
                              Icons.attach_money,
                              color: AppColors.buttonColor,
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),
                        DropdownButtonFormField<String>(
                          value: _selectedCurrency,
                          decoration: _inputDecoration(
                            hintText: 'Moneda',
                            prefixIcon: const Icon(
                              Icons.payments,
                              color: AppColors.buttonColor,
                            ),
                          ),
                          items: _currencies
                              .map(
                                (currency) => DropdownMenuItem<String>(
                                  value: currency,
                                  child: Text(currency),
                                ),
                              )
                              .toList(),
                          onChanged: (value) {
                            if (value == null) return;
                            setState(() => _selectedCurrency = value);
                          },
                        ),
                        const SizedBox(height: 20),
                        const Text1(
                          text1: 'Selecciona un método de pago',
                          size: 16,
                        ),
                        const SizedBox(height: 10),
                        ...WalletPaymentMethod.values.map(
                          (method) => Container(
                            margin: const EdgeInsets.symmetric(vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: _selectedMethod == method
                                    ? AppColors.buttonColor
                                    : Colors.white,
                              ),
                            ),
                            child: RadioListTile<WalletPaymentMethod>(
                              value: method,
                              groupValue: _selectedMethod,
                              activeColor: AppColors.buttonColor,
                              onChanged: (value) {
                                setState(() => _selectedMethod = value);
                              },
                              title: Row(
                                children: [
                                  Icon(method.icon, color: AppColors.buttonColor),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(method.label),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        CheckboxListTile(
                          value: _useVoucher,
                          onChanged: (value) {
                            setState(() => _useVoucher = value ?? false);
                          },
                          title: const Text('Tengo un código de voucher'),
                          controlAffinity: ListTileControlAffinity.leading,
                          activeColor: AppColors.buttonColor,
                          contentPadding: EdgeInsets.zero,
                        ),
                        if (_useVoucher) ...[
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _voucherController,
                            decoration: _inputDecoration(
                              hintText: 'Código del voucher',
                              prefixIcon: const Icon(
                                Icons.card_giftcard,
                                color: AppColors.buttonColor,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  CustomButton(
                    text: _submitting ? 'Procesando...' : 'Continuar',
                    onTap: _submitting ? null : _submit,
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
