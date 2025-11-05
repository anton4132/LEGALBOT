abstract class SessionStorage {
  Future<Map<String, dynamic>?> read();

  Future<void> write(Map<String, dynamic>? data);

  Future<void> clear();
}
