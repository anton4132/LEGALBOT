import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../constants/colors.dart';

enum WalletPaymentMethod {
  creditOrDebitCard,
  bankTransfer,
  applePay,
  googlePay,
  paypal,
}

extension WalletPaymentMethodX on WalletPaymentMethod {
  String get label {
    switch (this) {
      case WalletPaymentMethod.creditOrDebitCard:
        return 'Tarjeta de crédito o débito';
      case WalletPaymentMethod.bankTransfer:
        return 'Transferencia bancaria';
      case WalletPaymentMethod.applePay:
        return 'Apple Pay';
      case WalletPaymentMethod.googlePay:
        return 'Google Pay';
      case WalletPaymentMethod.paypal:
        return 'PayPal';
    }
  }

  IconData get icon {
    switch (this) {
      case WalletPaymentMethod.creditOrDebitCard:
        return Icons.credit_card;
      case WalletPaymentMethod.bankTransfer:
        return Icons.account_balance;
      case WalletPaymentMethod.applePay:
        return Icons.phone_iphone;
      case WalletPaymentMethod.googlePay:
        return Icons.android;
      case WalletPaymentMethod.paypal:
        return Icons.account_balance_wallet_outlined;
    }
  }
}

class WalletTopUpDetails {
  WalletTopUpDetails({
    required this.amount,
    required this.currency,
    required this.paymentMethod,
    this.voucherCode,
    DateTime? createdAt,
  })  : createdAt = createdAt ?? DateTime.now();

  final double amount;
  final String currency;
  final WalletPaymentMethod paymentMethod;
  final String? voucherCode;
  final DateTime createdAt;

  NumberFormat get formatter =>
      NumberFormat.currency(name: currency, symbol: _resolveCurrencySymbol());

  String get formattedAmount => formatter.format(amount);

  String _resolveCurrencySymbol() {
    switch (currency) {
      case 'USD':
        return '\$';
      case 'EUR':
        return '€';
      case 'PEN':
        return 'S/';
      default:
        return '$currency ';
    }
  }
}

class WalletTransaction {
  const WalletTransaction({
    required this.description,
    required this.amount,
    required this.currency,
    required this.date,
    required this.reference,
    this.isCredit = true,
  });

  final String description;
  final double amount;
  final String currency;
  final DateTime date;
  final String reference;
  final bool isCredit;

  Color get amountColor => isCredit ? Colors.green : AppColors.text3Color;

  String formattedAmount() {
    final symbol = WalletTopUpDetails(
      amount: amount,
      currency: currency,
      paymentMethod: WalletPaymentMethod.creditOrDebitCard,
    ).formatter.format(amount);
    return isCredit ? '+$symbol' : '-$symbol';
  }

  String formattedDate({String locale = 'es_PE'}) {
    final formatter = DateFormat('dd MMMM | hh:mm a', locale);
    return formatter.format(date);
  }
}

typedef WalletTopUpCompletion = void Function(
  WalletTopUpDetails details,
  String reference,
);
