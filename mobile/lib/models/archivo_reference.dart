import 'dart:convert';

class ArchivoReference {
  final int? id;
  final String? ruta;
  final int? tamano;
  final String? tipo;
  final String? url;

  const ArchivoReference({
    this.id,
    this.ruta,
    this.tamano,
    this.tipo,
    this.url,
  });

   ArchivoReference copyWith({
    int? id,
    String? ruta,
    int? tamano,
    String? tipo,
    String? url,
  }) {
    return ArchivoReference(
      id: id ?? this.id,
      ruta: ruta ?? this.ruta,
      tamano: tamano ?? this.tamano,
      tipo: tipo ?? this.tipo,
      url: url ?? this.url,
    );
  }


  String? get resolvedUrl {
    if (url != null && url!.trim().isNotEmpty) {
      return url;
    }
    if (ruta == null || ruta!.trim().isEmpty) {
      return null;
    }
    final normalized = ruta!.trim();
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      return normalized;
    }
    final path = normalized.startsWith('/') ? normalized : '/$normalized';
    return 'https://blob.vercel-storage.com$path';
  }

  String? get fileName {
    final ref = resolvedUrl ?? ruta;
    if (ref == null || ref.isEmpty) {
      return null;
    }
    final uri = Uri.tryParse(ref);
    if (uri != null) {
      final segments = uri.pathSegments;
      if (segments.isNotEmpty) {
        return segments.last;
      }
    }
    final sanitized = ref.split('?').first;
    if (sanitized.contains('/')) {
      return sanitized.split('/').last;
    }
    return sanitized;
  }

  factory ArchivoReference.fromJson(dynamic source) {
    if (source == null) {
      return const ArchivoReference();
    }
    if (source is ArchivoReference) {
      return source;
    }
    if (source is String) {
      final trimmed = source.trim();
      if (trimmed.isEmpty) {
        return const ArchivoReference();
      }
      return ArchivoReference(ruta: trimmed);
    }
    if (source is List<int>) {
      try {
        final decoded = json.decode(utf8.decode(source));
        return ArchivoReference.fromJson(decoded);
      } catch (_) {
        return const ArchivoReference();
      }
    }
    if (source is Map<String, dynamic>) {
      int? parseInt(dynamic value) {
        if (value == null) return null;
        if (value is int) return value;
        if (value is num) return value.toInt();
        if (value is String) {
          return int.tryParse(value);
        }
        return null;
      }

      final id = parseInt(source['id'] ?? source['archivoId']);
      final size = parseInt(source['tamano'] ?? source['size'] ?? source['tamaño']);
      final ruta = (source['ruta'] ?? source['path'] ?? source['pathname'] ?? source['url']) as String?;
      final tipo = source['tipo'] as String? ?? source['mime'] as String? ?? source['contentType'] as String?;
      final url = source['url'] as String? ?? source['href'] as String?;

      return ArchivoReference(
        id: id,
        ruta: ruta,
        tamano: size,
        tipo: tipo,
        url: url,
      );
    }
    return const ArchivoReference();
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        if (id != null) 'id': id,
        if (ruta != null) 'ruta': ruta,
        if (tamano != null) 'tamano': tamano,
        if (tipo != null) 'tipo': tipo,
        if (url != null) 'url': url,
      };
}