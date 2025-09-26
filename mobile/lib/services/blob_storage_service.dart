import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;
import 'package:mime/mime.dart';

import '../models/archivo_reference.dart';
import '../models/user_session.dart';
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
    final path = (json['pathname'] as String?) ?? (json['path'] as String?) ?? '';
    return BlobUploadResult(
      url: (json['url'] as String?) ?? '',
      pathname: path.startsWith('/') ? path : '/$path',
      size: (json['size'] as num?)?.toInt() ?? 0,
      contentType: json['contentType'] as String? ?? json['mimeType'] as String?,
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
  static const String _baseUrl = 'https://blob.vercel-storage.com';
  static const Duration _timeout = Duration(minutes: 1);
  static const String _defaultToken =
      'vercel_blob_rw_w2ZXDcCJ4vCxIR4r_IXP5uJAzwiSiY17yZ2uUbMrIUdVx5H';

  static String get _token => const String.fromEnvironment(
        'BLOB_READ_WRITE_TOKEN',
        defaultValue: _defaultToken,
      );

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

  static String _buildPath({
    required String fileName,
    String? prefix,
  }) {
    final now = DateTime.now().toUtc();
    final random = Random().nextInt(1 << 32).toRadixString(16);
    final sanitizedName = _sanitizeFileName(fileName);
    final resolvedPrefix = prefix?.trim() ?? '';
    final segments = <String>[
      if (resolvedPrefix.isNotEmpty) resolvedPrefix,
      '${now.year}',
      '${now.month.toString().padLeft(2, '0')}',
      '${now.day.toString().padLeft(2, '0')}',
      '${now.millisecondsSinceEpoch}_$random_${sanitizedName}',
    ];
    return segments.join('/');
  }

  static Future<BlobUploadResult> upload({
    required List<int> bytes,
    required String fileName,
    String? contentType,
    String? prefix,
    bool isPublic = true,
  }) async {
    final resolvedContentType = contentType ?? _guessContentType(fileName);
    final resolvedPrefix = prefix ?? _defaultUploadPrefix();
    final path = _buildPath(fileName: fileName, prefix: resolvedPrefix);
    final queryParameters = <String, String>{
      'access': isPublic ? 'public' : 'private',
    };
    final uri = Uri.parse('$_baseUrl/$path').replace(queryParameters: queryParameters);
    final response = await http
        .put(
          uri,
          headers: {
            'Authorization': 'Bearer $_token',
            'Content-Type': resolvedContentType,
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

  static String _defaultUploadPrefix() {
    final session = SessionService.instance.session;
    if (session is UserSession) {
      final role = session.rolCodigo ?? 'usuario';
      return 'usuarios/${session.usuarioId}/$role';
    }
    return 'uploads/public';
  }
}