class BlobConfig {
  static const String _defaultApiBaseUrl = 'https://blob.vercel-storage.com';
  static const String _defaultReadWriteToken =
      'vercel_blob_rw_w2ZXDcCJ4vCxIR4r_IXP5uJAzwiSiY17yZ2uUbMrIUdVx5H';

  static const String _configuredPublicBaseUrl =
      String.fromEnvironment('BLOB_PUBLIC_BASE_URL', defaultValue: '');
  static const String _configuredReadWriteToken =
      String.fromEnvironment('BLOB_READ_WRITE_TOKEN', defaultValue: '');

  static final RegExp _tokenPrefixPattern =
      RegExp(r'^vercel_blob_[a-z]+_([a-z0-9]+)_', caseSensitive: false);

  static String get apiBaseUrl => _defaultApiBaseUrl;

  static String get readWriteToken {
    if (_configuredReadWriteToken.isNotEmpty) {
      return _configuredReadWriteToken;
    }
    return _defaultReadWriteToken;
  }

  static String get publicBaseUrl {
    if (_configuredPublicBaseUrl.isNotEmpty) {
      return _configuredPublicBaseUrl.replaceFirst(RegExp(r'/+$'), '');
    }
    final derived = _derivePublicBaseUrlFromToken(readWriteToken);
    if (derived != null) {
      return derived;
    }
    return _defaultApiBaseUrl;
  }

  static String? resolvePublicUrl(String? pathOrUrl) {
    final sanitized = pathOrUrl?.trim();
    if (sanitized == null || sanitized.isEmpty) {
      return null;
    }
    if (sanitized.startsWith('http://') || sanitized.startsWith('https://')) {
      return sanitized;
    }
    final normalized = sanitized.startsWith('/') ? sanitized : '/$sanitized';
    return '$publicBaseUrl$normalized';
  }

  static String? _derivePublicBaseUrlFromToken(String token) {
    final match = _tokenPrefixPattern.firstMatch(token.trim());
    if (match != null) {
      final slug = match.group(1);
      if (slug != null && slug.isNotEmpty) {
        return 'https://$slug.public.blob.vercel-storage.com';
      }
    }
    return null;
  }
}