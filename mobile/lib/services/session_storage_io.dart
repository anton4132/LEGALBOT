import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

import 'session_storage_base.dart';

SessionStorage getSessionStorage() => _IoSessionStorage();

class _IoSessionStorage implements SessionStorage {
  static const String _fileName = 'session_cache.json';
  File? _file;

  Future<File> _ensureFile() async {
    if (_file != null) {
      return _file!;
    }
    final directory = await getApplicationSupportDirectory();
    final file = File('${directory.path}/$_fileName');
    _file = file;
    return file;
  }

  @override
  Future<Map<String, dynamic>?> read() async {
    try {
      final file = await _ensureFile();
      if (!await file.exists()) {
        return null;
      }
      final contents = await file.readAsString();
      if (contents.isEmpty) {
        return null;
      }
      final decoded = jsonDecode(contents);
      if (decoded is Map<String, dynamic>) {
        return Map<String, dynamic>.from(decoded);
      }
    } catch (_) {
      // ignore read errors
    }
    return null;
  }

  @override
  Future<void> write(Map<String, dynamic>? data) async {
    try {
      final file = await _ensureFile();
      if (data == null) {
        if (await file.exists()) {
          await file.delete();
        }
        return;
      }
      await file.writeAsString(jsonEncode(data), flush: true);
    } catch (_) {
      // ignore write errors
    }
  }

  @override
  Future<void> clear() async {
    try {
      final file = await _ensureFile();
      if (await file.exists()) {
        await file.delete();
      }
    } catch (_) {
      // ignore clear errors
    }
  }
}
