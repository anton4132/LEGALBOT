import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/user_session.dart';

class RememberMeStorage {
  RememberMeStorage._();

  static const String _rememberKey = 'remember_me';
  static const String _phoneKey = 'remembered_phone';
  static const String _dniKey = 'remembered_dni';
  static const String _sessionKey = 'remembered_session';

  static SharedPreferences? _prefs;

  static Future<SharedPreferences> _instance() async {
    return _prefs ??= await SharedPreferences.getInstance();
  }

  static Future<bool> getRememberPreference() async {
    final prefs = await _instance();
    return prefs.getBool(_rememberKey) ?? false;
  }

  static Future<String?> getRememberedPhone() async {
    final prefs = await _instance();
    final value = prefs.getString(_phoneKey);
    return (value != null && value.isNotEmpty) ? value : null;
  }

  static Future<String?> getRememberedDni() async {
    final prefs = await _instance();
    final value = prefs.getString(_dniKey);
    return (value != null && value.isNotEmpty) ? value : null;
  }

  static Future<UserSession?> getStoredSession() async {
    final prefs = await _instance();
    final raw = prefs.getString(_sessionKey);
    if (raw == null || raw.isEmpty) {
      return null;
    }
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) {
        return UserSession.fromJson(decoded);
      }
    } catch (_) {
      // Ignore malformed data and reset storage.
    }
    await prefs.remove(_sessionKey);
    return null;
  }

  static Future<void> saveRememberedAccount({
    required bool remember,
    String? phone,
    String? dni,
    UserSession? session,
  }) async {
    final prefs = await _instance();
    await prefs.setBool(_rememberKey, remember);

    if (remember) {
      if (phone != null && phone.isNotEmpty) {
        await prefs.setString(_phoneKey, phone);
      } else {
        await prefs.remove(_phoneKey);
      }
      if (dni != null && dni.isNotEmpty) {
        await prefs.setString(_dniKey, dni);
      } else {
        await prefs.remove(_dniKey);
      }
      if (session != null) {
        await prefs.setString(_sessionKey, jsonEncode(session.toJson()));
      }
    } else {
      await prefs.remove(_phoneKey);
      await prefs.remove(_dniKey);
      await prefs.remove(_sessionKey);
    }
  }

  static Future<void> clearSession() async {
    final prefs = await _instance();
    await prefs.remove(_sessionKey);
  }
}
