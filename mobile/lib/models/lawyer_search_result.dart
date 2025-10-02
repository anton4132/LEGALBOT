import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import 'archivo_reference.dart';
import 'lawyer_profile_models.dart';

String? _normalizeText(dynamic value) {
  if (value is String) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }
  return null;
}


class LawyerLocationDistrict {
  final String distrito;
  final String? codigo;
  final String? ubigeoCodigo;

  const LawyerLocationDistrict({
    required this.distrito,
    this.codigo,
    this.ubigeoCodigo,
  });

  factory LawyerLocationDistrict.fromJson(Map<String, dynamic> json) {
    final codigo = _normalizeText(
      json['distrito_codigo'] ?? json['codigo'] ?? json['ubigeo_codigo'],
    );
    final ubigeoCodigo = _normalizeText(
      json['ubigeo_codigo'] ?? json['ubigeoCodigo'],
    );
    final distrito = _normalizeText(json['distrito']) ?? '';

    return LawyerLocationDistrict(
      distrito: distrito,
      codigo: codigo,
      ubigeoCodigo: ubigeoCodigo,
    );
  }
   bool get hasNombre => distrito.isNotEmpty;

  String get key => (codigo ?? distrito).toLowerCase();
}

class LawyerLocationProvince {
  final String provincia;
  final String? codigo;
  final List<LawyerLocationDistrict> distritos;

  const LawyerLocationProvince({
    required this.provincia,
    this.codigo,
    required this.distritos,
  });

  factory LawyerLocationProvince.fromJson(Map<String, dynamic> json) {
    final codigo = _normalizeText(json['provincia_codigo'] ?? json['codigo']);
    final provincia = _normalizeText(json['provincia']) ?? '';
    final distritosRaw = json['distritos'];
    final distritosList = <LawyerLocationDistrict>[];
    if (distritosRaw is List) {
      for (final entry in distritosRaw) {
        if (entry is Map<String, dynamic>) {
          final distrito = LawyerLocationDistrict.fromJson(entry);
          if (distrito.hasNombre) {
            distritosList.add(distrito);
          }
        }
      }
    }
    return LawyerLocationProvince(
      provincia: provincia,
      codigo: codigo,
      distritos: List.unmodifiable(distritosList),
    );
  }
  bool get hasNombre => provincia.isNotEmpty;

  String get key => (codigo ?? provincia).toLowerCase();

  List<LawyerLocationDistrict> get sortedDistricts {
    final list = distritos.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    return list;
  }
}

class LawyerLocationOption {
 final String departamento;
  final String? codigo;
  final List<LawyerLocationProvince> provincias;

  const LawyerLocationOption({
    required this.departamento,
    this.codigo,
    required this.provincias,
  });

  factory LawyerLocationOption.fromJson(Map<String, dynamic> json) {
    final codigo = _normalizeText(
      json['departamento_codigo'] ?? json['codigo'],
    );
    final departamento = _normalizeText(json['departamento']) ?? '';
    final provinciasRaw = json['provincias'];
    final provinciasList = <LawyerLocationProvince>[];
    if (provinciasRaw is List) {
      for (final entry in provinciasRaw) {
        if (entry is Map<String, dynamic>) {
          final province = LawyerLocationProvince.fromJson(entry);
 if (province.hasNombre && province.distritos.isNotEmpty) {
            provinciasList.add(province);
          }
        }
      }
    }
    return LawyerLocationOption(
      departamento: departamento,
      codigo: codigo,
      provincias: List.unmodifiable(provinciasList),
    );
  }
    bool get hasNombre => departamento.isNotEmpty;

  String get key => (codigo ?? departamento).toLowerCase();
  List<LawyerLocationProvince> get sortedProvinces {
    final list = provincias.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    return list;
  }

}

class LawyerSearchResult {
  final int usuarioId;
  final String? nombreCompleto;
  final ArchivoReference? avatarArchivo;
  final double? tarifaBase;
  final double? ratingPromedio;
  final int ratingCantidad;
  final LawFirmSummary? estudioPrincipal;

  const LawyerSearchResult({
    required this.usuarioId,
    required this.nombreCompleto,
    required this.avatarArchivo,
    required this.tarifaBase,
    required this.ratingPromedio,
    required this.ratingCantidad,
    required this.estudioPrincipal,
  });

  factory LawyerSearchResult.fromJson(Map<String, dynamic> json) {
    double? parseDouble(dynamic value) {
      if (value is num) return value.toDouble();
      if (value is String) return double.tryParse(value);
      return null;
    }

    int parseInt(dynamic value) {
      if (value is int) return value;
      if (value is num) return value.toInt();
      if (value is String) return int.tryParse(value) ?? 0;
      return 0;
    }

    return LawyerSearchResult(
      usuarioId: parseInt(json['usuarioId'] ?? json['usuario_id'] ?? json['id']),
      nombreCompleto: _normalizeText(json['nombreCompleto'] ?? json['nombre_completo']),
      avatarArchivo: ArchivoReference.fromJson(json['avatarArchivo'] ?? json['avatar_archivo']),
      tarifaBase: parseDouble(json['tarifa_base']),
      ratingPromedio: parseDouble(json['rating_promedio']),
      ratingCantidad: parseInt(json['rating_cantidad']),
      estudioPrincipal: json['estudioPrincipal'] is Map<String, dynamic>
          ? LawFirmSummary.fromJson(json['estudioPrincipal'] as Map<String, dynamic>)
          : null,
    );
  }

  ImageProvider<Object>? get avatarImageProvider {
    final url = avatarArchivo?.resolvedUrl;
    if (url == null) return null;
    return CachedNetworkImageProvider(url);
  }

  String get initials {
    final name = nombreCompleto ?? '';
    if (name.isEmpty) return 'AB';
    final parts = name
        .split(' ')
        .where((part) => part.trim().isNotEmpty)
        .map((part) => part.trim())
        .toList();
    if (parts.isEmpty) {
      return name.substring(0, 1).toUpperCase();
    }
    String leading(String value) =>
        value.isEmpty ? '' : value.substring(0, 1).toUpperCase();
    final first = leading(parts.first);
    final second = parts.length > 1 ? leading(parts[1]) : '';
    final combined = '$first$second'.trim();
    return combined.isEmpty ? first : combined;
  }

  String get ratingLabel {
    if (ratingPromedio == null || ratingCantidad <= 0) {
      return 'Sin reseñas';
    }
    return '${ratingPromedio!.toStringAsFixed(1)} ($ratingCantidad)';
  }
}