import 'dart:convert';
// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;

import 'session_storage_base.dart';

SessionStorage getSessionStorage() => _WebSessionStorage();

class _WebSessionStorage implements SessionStorage {
  static const String _storageKey = 'legalbot_session_cache';

  @override
  Future<Map<String, dynamic>?> read() async {
    final stored = html.window.localStorage[_storageKey];
    if (stored == null || stored.isEmpty) {
      return null;
    }
    try {
      final decoded = jsonDecode(stored);
      if (decoded is Map<String, dynamic>) {
        return Map<String, dynamic>.from(decoded);
      }
    } catch (_) {
      // ignore parse errors
    }
    return null;
  }

  @override
  Future<void> write(Map<String, dynamic>? data) async {
    if (data == null) {
      html.window.localStorage.remove(_storageKey);
      return;
    }
    html.window.localStorage[_storageKey] = jsonEncode(data);
  }

  @override
  Future<void> clear() async {
    html.window.localStorage.remove(_storageKey);
  }
}
