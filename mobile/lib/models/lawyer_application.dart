enum LawyerApplicationState { none, pendiente, observada, aprobada, rechazada }


//agarra un texto que viene del backend (por ejemplo “PENDIENTE”) y lo convierte a una de esas etiquetas de arriba.
LawyerApplicationState parseLawyerApplicationState(String? value) {
  switch (value?.toUpperCase()) {
    case 'PENDIENTE':
      return LawyerApplicationState.pendiente;
    case 'OBSERVADA':
      return LawyerApplicationState.observada;
    case 'APROBADA':
      return LawyerApplicationState.aprobada;
    case 'RECHAZADA':
      return LawyerApplicationState.rechazada;
    default:
      return LawyerApplicationState.none;
  }
}


//intenta transformar un texto de fecha (“2025-01-01…”) en un objeto DateTime.Si no puede, devuelve null. Así no se rompe nada.

DateTime? _parseDate(dynamic value) {
  if (value is String && value.isNotEmpty) {
    return DateTime.tryParse(value);
  }
  return null;
}

//es todo los datos importantes para postulacion 

class LawyerApplicationStatus {
  final int? id;
  final LawyerApplicationState state;
  final String? observation;
  final String? linkedinUrl;
  final String? tituloUrl;
  final String? colegiaturaNumero;
  final String? colegiaturaCarnet;
  final DateTime? colegiaturaFechaEmision;
  final DateTime? colegiaturaFechaVigenciaHasta;
  final String? colegioNombre;
  final String? colegioRegion;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final DateTime? approvedAt;

  
  const LawyerApplicationStatus({
    this.id,
    required this.state,
    this.observation,
    this.linkedinUrl,
    this.tituloUrl,
    this.colegiaturaNumero,
    this.colegiaturaCarnet,
    this.colegiaturaFechaEmision,
    this.colegiaturaFechaVigenciaHasta,
    this.colegioNombre,
    this.colegioRegion,
    this.createdAt,
    this.updatedAt,
    this.approvedAt,
    
  });

  static const LawyerApplicationStatus empty =
      LawyerApplicationStatus(state: LawyerApplicationState.none);

  bool get canEdit =>
      state == LawyerApplicationState.none ||
      state == LawyerApplicationState.observada;

  bool get isFinalized =>
      state == LawyerApplicationState.aprobada ||
      state == LawyerApplicationState.rechazada;

  bool get isPending => state == LawyerApplicationState.pendiente;

  //construye el objeto de datos leyendo la respuesta del servidor. Lo hace a prueba de balas:

  factory LawyerApplicationStatus.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return LawyerApplicationStatus.empty;
    }

Map<String, dynamic>? _nestedMap(String key) {
      final dynamic value = json[key];
      if (value is Map<String, dynamic>) {
        return value;
      }
      return null;
    }

    Map<String, dynamic>? colegiatura = _nestedMap('colegiatura');
    colegiatura ??= _nestedMap('colegiaturaAbogado');

    Map<String, dynamic>? colegio = _nestedMap('colegio');

    String? _readString(Map<String, dynamic>? source, String camel, String snake) {
      if (source == null) return null;
      final dynamic camelValue = source[camel];
      if (camelValue is String && camelValue.trim().isNotEmpty) {
        return camelValue;
      }
      final dynamic snakeValue = source[snake];
      if (snakeValue is String && snakeValue.trim().isNotEmpty) {
        return snakeValue;
      }
      return null;
    }

    DateTime? _readDate(Map<String, dynamic>? source, String camel, String snake) {
      if (source == null) return null;
      final dynamic camelValue = source[camel];
      final DateTime? camelDate = _parseDate(camelValue);
      if (camelDate != null) {
        return camelDate;
      }
      final dynamic snakeValue = source[snake];
      return _parseDate(snakeValue);
    }

    return LawyerApplicationStatus(
      id: json['id'] as int?,
      state: parseLawyerApplicationState(json['estado'] as String?),
      observation: json['observaciones'] as String?,
      linkedinUrl: json['linkedinUrl'] as String? ?? json['linkedin_url'] as String?,
      tituloUrl: json['tituloUrl'] as String? ?? json['titulo_url'] as String?,

      colegiaturaNumero: json['colegiaturaNumero'] as String?
          ?? json['colegiatura_numero'] as String?,

      

      colegiaturaCarnet: json['colegiaturaCarnet'] as String?
              ?? json['colegiatura_carnet'] as String?
              ?? _readString(colegiatura, 'carnet', 'carnet')
              ?? _readString(json['colegiatura'] as Map<String, dynamic>?, 'carnet', 'carnet')
              ?? _readString(json, 'carnet', 'carnet'),

      

      colegiaturaFechaEmision: _parseDate(json['colegiaturaFechaEmision']) ??
          _parseDate(json['colegiatura_fecha_emision']) ??
          _readDate(colegiatura, 'fechaEmision', 'fecha_emision'),

      colegiaturaFechaVigenciaHasta:
          _parseDate(json['colegiaturaFechaVigenciaHasta']) ??
              _parseDate(json['colegiatura_fecha_vigencia_hasta']) ??
              _readDate(colegiatura, 'fechaVigenciaHasta', 'fecha_vigencia_hasta'),

      colegioNombre:
          json['colegioNombre'] as String?
              ?? json['colegio_nombre'] as String?
              ?? _readString(colegio, 'nombre', 'nombre'),
      colegioRegion: json['colegioRegion'] as String?
              ?? json['colegio_region'] as String?
              ?? _readString(colegio, 'region', 'region'),
      createdAt: _parseDate(json['creadoEl'] ?? json['creado_el']),
      approvedAt: _parseDate(json['aprobadoEl'] ?? json['aprobado_el']),
      updatedAt: _parseDate(json['actualizadoEl'] ?? json['actualizado_el']),
    );
  }

  LawyerApplicationStatus copyWith({
    int? id,
    LawyerApplicationState? state,
    String? observation,
    String? linkedinUrl,
    String? tituloUrl,
    String? colegiaturaNumero,
    String? colegiaturaCarnet,
    DateTime? colegiaturaFechaEmision,
    DateTime? colegiaturaFechaVigenciaHasta,
    String? colegioNombre,
    String? colegioRegion,
    DateTime? createdAt,
    DateTime? updatedAt,
    DateTime? approvedAt,
  }) {
    return LawyerApplicationStatus(
      id: id ?? this.id,
      state: state ?? this.state,
      observation: observation ?? this.observation,
      linkedinUrl: linkedinUrl ?? this.linkedinUrl,
      tituloUrl: tituloUrl ?? this.tituloUrl,
      colegiaturaNumero: colegiaturaNumero ?? this.colegiaturaNumero,
      colegiaturaCarnet: colegiaturaCarnet ?? this.colegiaturaCarnet,
      colegiaturaFechaEmision: colegiaturaFechaEmision ?? this.colegiaturaFechaEmision,
      colegiaturaFechaVigenciaHasta: colegiaturaFechaVigenciaHasta ?? this.colegiaturaFechaVigenciaHasta,
      colegioNombre: colegioNombre ?? this.colegioNombre,
      colegioRegion: colegioRegion ?? this.colegioRegion,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      approvedAt: approvedAt ?? this.approvedAt,
    );
  }
}