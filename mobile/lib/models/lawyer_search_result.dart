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

class LawyerLocationOption {
  final String? pais;
  final String? ciudad;

  const LawyerLocationOption({
    this.pais,
    this.ciudad,
  });

  factory LawyerLocationOption.fromJson(Map<String, dynamic> json) {
    return LawyerLocationOption(
      pais: _normalizeText(json['pais']),
      ciudad: _normalizeText(json['ciudad']),
    );
  }

  String get displayLabel {
    final hasCity = ciudad != null && ciudad!.isNotEmpty;
    final hasCountry = pais != null && pais!.isNotEmpty;
    if (hasCity && hasCountry) {
      return '${ciudad!}, ${pais!}';
    }
    if (hasCity) return ciudad!;
    if (hasCountry) return pais!;
    return 'Ubicación no especificada';
  }

  String? get countryKey => pais?.toLowerCase();

  String? get cityKey => ciudad?.toLowerCase();
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