import 'package:flutter/foundation.dart';

import '../models/lawyer_application.dart';
import '../models/user_session.dart';

class SessionService {
  SessionService._();

  static final SessionService instance = SessionService._();

  final ValueNotifier<UserSession?> _sessionNotifier = ValueNotifier<UserSession?>(null);

  ValueListenable<UserSession?> get notifier => _sessionNotifier;

  UserSession? get session => _sessionNotifier.value;

  bool get isAuthenticated => _sessionNotifier.value != null;

  void setSession(UserSession? session) {
    _sessionNotifier.value = session;
  }

  void clear() {
    _sessionNotifier.value = null;
  }

  void updateApplication(LawyerApplicationStatus status) {
    final current = _sessionNotifier.value;
    if (current == null) return;
    _sessionNotifier.value = current.copyWith(application: status);
  }

  void updateCurrentAccount({
    required int usuarioId,
    required int rolId,
    String? rolCodigo,
    String? rolNombre,
    String? token,
    bool? activo,
  }) {
    final current = _sessionNotifier.value;
    if (current == null) return;
    _sessionNotifier.value = current.copyWith(
      usuarioId: usuarioId,
      rolId: rolId,
      rolCodigo: rolCodigo,
      rolNombre: rolNombre,
      token: token ?? current.token,
      activo: activo ?? current.activo,
    );
  }

  void updateAccounts(List<UserAccount> accounts) {
    final current = _sessionNotifier.value;
    if (current == null) return;
bool? updatedActive;
    for (final account in accounts) {
      if (account.usuarioId == current.usuarioId) {
        updatedActive = account.activo;
        break;
      }
    }
    _sessionNotifier.value = current.copyWith(
      accounts: accounts,
      activo: updatedActive ?? current.activo,
    );  }

  UserAccount? accountForRole(String roleCode) {
    final current = _sessionNotifier.value;
    if (current == null) return null;
    final normalized = roleCode.toLowerCase();
    for (final account in current.accounts) {
      if ((account.rolCodigo ?? '').toLowerCase() == normalized) {
        return account;
      }
    }
    return null;
  }
}
