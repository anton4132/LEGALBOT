import 'session_storage_base.dart';

SessionStorage getSessionStorage() => _MemorySessionStorage();

class _MemorySessionStorage implements SessionStorage {
  Map<String, dynamic>? _cache;

  @override
  Future<Map<String, dynamic>?> read() async =>
      _cache != null ? Map<String, dynamic>.from(_cache!) : null;

  @override
  Future<void> write(Map<String, dynamic>? data) async {
    _cache = data != null ? Map<String, dynamic>.from(data) : null;
  }

  @override
  Future<void> clear() async {
    _cache = null;
  }
}
