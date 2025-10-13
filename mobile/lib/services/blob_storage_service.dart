import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';

import 'package:http/http.dart' as http;
import 'package:mime/mime.dart';

import '../models/archivo_reference.dart';
import '../models/user_session.dart';
import '../utils/blob_config.dart';

import 'session_service.dart';

class BlobUploadResult {
  final String url;
  final String pathname;
  final int size;
  final String? contentType;

  const BlobUploadResult({
    required this.url,
    required this.pathname,
    required this.size,
    this.contentType,
  });

  factory BlobUploadResult.fromJson(Map<String, dynamic> json) {
    final path =
        (json['pathname'] as String?) ?? (json['path'] as String?) ?? '';
    return BlobUploadResult(
      url: (json['url'] as String?) ?? '',
      pathname: path.startsWith('/') ? path : '/$path',
      size: (json['size'] as num?)?.toInt() ?? 0,
      contentType:
          json['contentType'] as String? ?? json['mimeType'] as String?,
    );
  }

  ArchivoReference toArchivoReference() {
    return ArchivoReference(
      ruta: pathname,
      tamano: size,
      tipo: contentType,
      url: url,
    );
  }
}

class BlobStorageService {
  static String get _baseUrl => BlobConfig.apiBaseUrl;
  static const Duration _timeout = Duration(minutes: 1);

  static String get _token => BlobConfig.readWriteToken;

  static String _guessContentType(String fileName) {
    final lookup = lookupMimeType(fileName);
    if (lookup != null && lookup.isNotEmpty) {
      return lookup;
    }
    return 'application/octet-stream';
  }

  static String _sanitizeFileName(String name) {
    final sanitized = name
        .replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_')
        .replaceAll(RegExp(r'_+'), '_');
    return sanitized.isEmpty ? 'archivo' : sanitized;
  }

  static String _normalizePrefix(String? prefix) {
    final raw = prefix?.trim() ?? '';
    if (raw.isEmpty) {
      return '';
    }

    var normalized = raw;
    while (normalized.startsWith('/')) {
      normalized = normalized.substring(1);
    }
    while (normalized.endsWith('/')) {
      normalized = normalized.substring(0, normalized.length - 1);
    }
    return normalized;
  }

  static String _buildPath({required String fileName, String? prefix}) {
    final now = DateTime.now().toUtc();
    final random = Random().nextInt(1 << 32).toRadixString(16);
    final sanitizedName = _sanitizeFileName(fileName);
    final normalizedPrefix = _normalizePrefix(prefix);
    final segments = <String>[
      '${now.year}',
      if (normalizedPrefix.isNotEmpty) normalizedPrefix,
      '${now.millisecondsSinceEpoch}_${random}_${sanitizedName}',
    ];
    return segments.join('/');
  }
  static String? _normalizeExistingPath(String? existingPath) {
    final trimmed = existingPath?.trim();
    if (trimmed == null || trimmed.isEmpty) {
      return null;
    }

    String path = trimmed;
    if (path.startsWith('http://') || path.startsWith('https://')) {
      final uri = Uri.tryParse(path);
      if (uri != null) {
        path = uri.path;
      }
    }

    while (path.startsWith('/')) {
      path = path.substring(1);
    }

    if (path.isEmpty) {
      return null;
    }

    return path;
  }

  static bool isLegacyPath(String? pathOrUrl) {
    final normalized = _normalizeExistingPath(pathOrUrl);
    if (normalized == null) {
      return false;
    }

    final lower = normalized.toLowerCase();
    if (lower.contains('/usuarios/')) {
      return true;
    }
    if (lower.contains('/perfil/avatar/')) {
      return true;
    }

    return false;
  }
  static Future<BlobUploadResult> upload({
    required List<int> bytes,
    required String fileName,
    String? contentType,
    String? prefix,
    bool isPublic = true,
    bool allowOverwrite = false,
        String? existingPath,


  }) async {
    final resolvedContentType = contentType ?? _guessContentType(fileName);
    final resolvedPrefix = prefix ?? _defaultUploadPrefix();
    final normalizedExistingPath = _normalizeExistingPath(existingPath);
    final shouldAllowOverwrite = allowOverwrite || normalizedExistingPath != null;
    final path = normalizedExistingPath ??
        _buildPath(fileName: fileName, prefix: resolvedPrefix);
    final queryParameters = <String, String>{
      'access': isPublic ? 'public' : 'private',
    };
    final uri = Uri.parse(
      '$_baseUrl/$path',
    ).replace(queryParameters: queryParameters);
    final response = await http
        .put(
          uri,
          headers: {
            'Authorization': 'Bearer $_token',
            'Content-Type': resolvedContentType,
            if (shouldAllowOverwrite) 'x-vercel-blob-allow-overwrite': 'true',
          },
          body: bytes,
        )
        .timeout(_timeout);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        'Error subiendo archivo (${response.statusCode}): ${response.body}',
      );
    }

    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    if (decoded is! Map<String, dynamic>) {
      throw Exception('Respuesta inválida del servicio de archivos');
    }
    return BlobUploadResult.fromJson(decoded);
  }

  static Future<bool> delete(String path) async {
    final resolved = path.trim();
    if (resolved.isEmpty) {
      return true;
    }
    String extractPath(String value) {
      if (value.startsWith('http://') || value.startsWith('https://')) {
        final uri = Uri.tryParse(value);
        if (uri != null) {
          return uri.path.replaceFirst(RegExp(r'^/'), '');
        }
      }
      return value.startsWith('/') ? value.substring(1) : value;
    }

    final normalized = extractPath(resolved);
    final uri = Uri.parse('$_baseUrl/$normalized');
    try {
      final response = await http
          .delete(uri, headers: {'Authorization': 'Bearer $_token'})
          .timeout(_timeout);
      if (response.statusCode == 404) {
        return true;
      }
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return true;
      }
      debugPrint(
        'Error eliminando blob (${response.statusCode}): ${response.body}',
      );
    } catch (error, stackTrace) {
      debugPrint('No se pudo eliminar el blob: $error\n$stackTrace');
    }
    return false;
  }

  static String _defaultUploadPrefix() {
    final session = SessionService.instance.session;
    if (session is UserSession) {
      final role = session.rolCodigo ?? 'usuario';
      return '${session.usuarioId}/$role';
    }
    return 'uploads/public';
  }
}
