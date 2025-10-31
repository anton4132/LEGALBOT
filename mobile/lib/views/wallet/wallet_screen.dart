import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../constants/colors.dart';
import '../../../widgets/customapp_bar.dart';
import '../../../widgets/custombtn.dart';
import '../../../widgets/detailstext1.dart';
import '../../../widgets/detailstext2.dart';
import 'add_money.dart';
import 'models/wallet_top_up.dart';

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  static const String routeName = '/wallet';

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  final Map<String, double> _balances = {'USD': 12000.0};
  final List<WalletTransaction> _transactions = [
    WalletTransaction(
      description: 'Recarga inicial',
      amount: 12000.0,
      currency: 'USD',
      date: DateTime.now().subtract(const Duration(days: 1, hours: 3)),
      reference: 'LB-INIT-001',
    ),
  ];

  String _activeCurrency = 'USD';

  String _formatBalance() {
    final balance = _balances[_activeCurrency] ?? 0.0;
    return NumberFormat.simpleCurrency(name: _activeCurrency).format(balance);
  }

  void _handleTopUpCompleted(WalletTopUpDetails details, String reference) {
    setState(() {
      final current = _balances[details.currency] ?? 0.0;
      _balances[details.currency] = current + details.amount;
      _activeCurrency = details.currency;
      _transactions.insert(
        0,
        WalletTransaction(
          description: 'Recarga de ${details.paymentMethod.label}',
          amount: details.amount,
          currency: details.currency,
          date: DateTime.now(),
          reference: reference.isEmpty ? _buildReference(details) : reference,
        ),
      );
    });
  }

  String _buildReference(WalletTopUpDetails details) {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    return 'LB-${details.currency}-$timestamp';
  }

  Future<void> _openAddMoney() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AddMoneyScreen(
          initialCurrency: _activeCurrency,
          onCompleted: (details, reference) {
            _handleTopUpCompleted(details, reference);
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.buttonColor,
          onRefresh: () async {
            setState(() {});
          },
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 14),
            children: [
              const CustomAppBar(text: 'Wallet', text1: ''),
              const SizedBox(height: 13),
              Container(
                width: double.infinity,
                padding:
                    const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
                decoration: BoxDecoration(
                  color: AppColors.button2Color.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text2(text2: 'Saldo disponible'),
                            const SizedBox(height: 4),
                            Text1(
                              text1: _formatBalance(),
                              size: 22,
                            ),
                            const SizedBox(height: 6),
                            Text2(text2: 'Moneda activa: $_activeCurrency'),
                          ],
                        ),
                        const Spacer(),
                        const Icon(
                          Icons.wallet,
                          color: AppColors.buttonColor,
                          size: 40,
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    CustomButton(
                      text: 'Recargar',
                      onTap: _openAddMoney,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              if (_transactions.isEmpty)
                Container(
                  padding:
                      const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: const Column(
                    children: [
                      Icon(
                        Icons.receipt_long,
                        color: AppColors.buttonColor,
                        size: 42,
                      ),
                      SizedBox(height: 12),
                      Text1(
                        text1: 'Aún no registras movimientos',
                        size: 18,
                      ),
                      SizedBox(height: 6),
                      Text2(
                        text2:
                            'Cuando recargues tu billetera, verás aquí el historial de operaciones.',
                      ),
                    ],
                  ),
                )
              else
                ..._transactions.map(
                  (transaction) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        vertical: 12,
                        horizontal: 14,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.05),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                Icons.trending_up,
                                color: transaction.amountColor,
                                size: 22,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text1(
                                  text1: transaction.description,
                                  size: 16,
                                ),
                              ),
                              Text1(
                                text1: transaction.formattedAmount(),
                                color: transaction.amountColor,
                                size: 16,
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Expanded(
                                child: Text2(
                                  text2: transaction.formattedDate(),
                                ),
                              ),
                              Text2(text2: 'Ref: ${transaction.reference}'),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
