import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/lawyer_application.dart';
import '../models/user_session.dart';
import 'session_storage.dart';

class SessionService {
  SessionService._();

  static final SessionService instance = SessionService._();

  final ValueNotifier<UserSession?> _sessionNotifier =
      ValueNotifier<UserSession?>(null);
  final SessionStorage _storage = createSessionStorage();

  bool _initialized = false;
  bool _rememberMePreference = false;
  String? _rememberedPhone;
  String? _rememberedDni;

  ValueListenable<UserSession?> get notifier => _sessionNotifier;

  UserSession? get session => _sessionNotifier.value;

  bool get isAuthenticated => _sessionNotifier.value != null;

  bool get rememberMeEnabled => _rememberMePreference;

  String? get rememberedPhone => _rememberedPhone;

  String? get rememberedDni => _rememberedDni;

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    try {
      final stored = await _storage.read();
      if (stored == null) {
        return;
      }

      _rememberMePreference = stored['rememberMe'] == true;
      final phone = stored['phone'];
      final dni = stored['dni'];

      if (phone is String && phone.trim().isNotEmpty) {
        _rememberedPhone = phone.trim();
      }
      if (dni is String && dni.trim().isNotEmpty) {
        _rememberedDni = dni.trim();
      }

      if (_rememberMePreference) {
        final sessionJson = stored['session'];
        if (sessionJson is Map<String, dynamic>) {
          try {
            _sessionNotifier.value = UserSession.fromJson(sessionJson);
          } catch (_) {
            await _storage.clear();
            _rememberMePreference = false;
            _rememberedPhone = null;
            _rememberedDni = null;
          }
        }
      }
    } catch (_) {
      // ignore persistence initialization errors
    }
  }

  Future<void> persistSession(
    UserSession session, {
    required bool rememberMe,
    String? phone,
    String? dni,
  }) async {
    if (!rememberMe) {
      await clearPersistence();
      return;
    }

    final normalizedPhone = phone?.trim();
    final normalizedDni = dni?.trim();

    final effectivePhone =
        normalizedPhone != null && normalizedPhone.isNotEmpty
            ? normalizedPhone
            : _rememberedPhone;
    final effectiveDni = normalizedDni != null && normalizedDni.isNotEmpty
        ? normalizedDni
        : _rememberedDni;

    final data = <String, dynamic>{
      'rememberMe': true,
      'session': session.toJson(),
      if (effectivePhone != null && effectivePhone.isNotEmpty)
        'phone': effectivePhone,
      if (effectiveDni != null && effectiveDni.isNotEmpty) 'dni': effectiveDni,
    };

    await _storage.write(data);

    _rememberMePreference = true;
    _rememberedPhone = effectivePhone;
    _rememberedDni = effectiveDni;
  }

  Future<void> clearPersistence() async {
    await _storage.clear();
    _rememberMePreference = false;
    _rememberedPhone = null;
    _rememberedDni = null;
  }

  Future<void> syncPersistentSession() async {
    final current = _sessionNotifier.value;
    if (current == null) {
      await clearPersistence();
      return;
    }
    if (!_rememberMePreference) {
      return;
    }
    await persistSession(
      current,
      rememberMe: true,
      phone: _rememberedPhone,
      dni: _rememberedDni,
    );
  }

  void setSession(UserSession? session) {
    _sessionNotifier.value = session;
    if (session == null) {
      unawaited(clearPersistence());
    } else if (_rememberMePreference) {
      unawaited(syncPersistentSession());
    }
  }

  void clear() {
    _sessionNotifier.value = null;
    unawaited(clearPersistence());
  }

  void updateApplication(LawyerApplicationStatus status) {
    final current = _sessionNotifier.value;
    if (current == null) return;
    _sessionNotifier.value = current.copyWith(application: status);
    if (_rememberMePreference) {
      unawaited(syncPersistentSession());
    }
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
    if (_rememberMePreference) {
      unawaited(syncPersistentSession());
    }
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
    );
    if (_rememberMePreference) {
      unawaited(syncPersistentSession());
    }
  }

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
