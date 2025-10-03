import 'package:flutter/material.dart';
import 'archivo_reference.dart';

TimeOfDay? _parseTimeOfDay(String? value) {
  if (value == null || value.isEmpty) return null;
  final sanitized = value.contains('T') ? value.split('T').last : value;
  final timePart = sanitized.split('.').first.split('Z').first;
  final components = timePart.split(':');
  if (components.length < 2) return null;
  final hour = int.tryParse(components[0]);
  final minute = int.tryParse(components[1]);
  if (hour == null || minute == null) return null;
  return TimeOfDay(hour: hour, minute: minute);
}

String formatTimeOfDay(TimeOfDay time) {
  final twoDigits = (int value) => value.toString().padLeft(2, '0');
  return '${twoDigits(time.hour)}:${twoDigits(time.minute)}';
}

class LawyerProfileInfo {
  final double? tarifaBase;
  final String? direccionAtencion;
  final String? direccionUbigeoCodigo;
  final String? lineaExactaDireccion;
  final String? bio;
  final ArchivoReference? avatarArchivo;
final double? ratingPromedio;
  final int ratingCantidad;

  const LawyerProfileInfo({
    this.tarifaBase,
    this.direccionAtencion,
    this.direccionUbigeoCodigo,
    this.lineaExactaDireccion,
    this.bio,
    this.avatarArchivo,
    this.ratingPromedio,
    this.ratingCantidad = 0,
  });

  bool get hasBasicInfo =>
      (tarifaBase != null && tarifaBase! > 0) &&
      (lineaExactaDireccion?.trim().isNotEmpty ??
          direccionAtencion?.trim().isNotEmpty ?? false) &&
      (bio?.trim().isNotEmpty ?? false);

  factory LawyerProfileInfo.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const LawyerProfileInfo();
    final tarifaValue = json['tarifa_base'];
    double? tarifaBase;
    if (tarifaValue is num) {
      tarifaBase = tarifaValue.toDouble();
    } else if (tarifaValue is String) {
      tarifaBase = double.tryParse(tarifaValue);
    }
    String? parseString(dynamic value) {
      if (value is String) return value;
      if (value is num) return value.toString();
      return null;
    }

    ArchivoReference? _normalizeArchivo(dynamic value) {
      final ref = ArchivoReference.fromJson(value);
      if (ref.id == null && (ref.ruta == null || ref.ruta!.isEmpty)) {
        return null;
      }
      return ref;
    }
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
    final direccionAtencion = parseString(json['direccion_atencion']);

    return LawyerProfileInfo(
      tarifaBase: tarifaBase,
  direccionAtencion:
          direccionAtencion ?? parseString(json['linea_exacta_direccion']),
      direccionUbigeoCodigo: parseString(
        json['direccion_ubigeo_codigo'] ??
            json['direccion_id'] ??
            json['direccionUbigeoCodigo'],
      ),
      lineaExactaDireccion: parseString(
        json['linea_exacta_direccion'] ??
            json['lineaExactaDireccion'],
      ),      bio: json['bio'] as String?,
      avatarArchivo: _normalizeArchivo(
        json['avatarArchivo'] ??
            json['avatar_archivo'] ??
            json['avatar'],
      ),
      ratingPromedio: parseDouble(json['rating_promedio']),
      ratingCantidad: parseInt(json['rating_cantidad']),
    );
  }

  Map<String, dynamic> toPayload() => {
        'tarifa_base': tarifaBase,
        'bio': bio,
        'direccion_atencion': direccionAtencion,
        'direccion_id': direccionUbigeoCodigo,
        'linea_exacta_direccion': lineaExactaDireccion,
      }..removeWhere((key, value) => value == null);
  bool get hasRatings => (ratingPromedio ?? 0) > 0 && ratingCantidad > 0;

  double get ratingPromedioOrZero => ratingPromedio ?? 0;

  String ratingSummary({int fractionDigits = 1}) {
    if (!hasRatings) return 'Sin reseñas';
    final formatted = ratingPromedio!.toStringAsFixed(fractionDigits);
    return '$formatted ($ratingCantidad)';
  }
}

class LawyerSpecialty {
  final int id;
  final String nombre;

  const LawyerSpecialty({
    required this.id,
    required this.nombre,
  });

  factory LawyerSpecialty.fromJson(Map<String, dynamic> json) {
    return LawyerSpecialty(
      id: (json['id'] as num).toInt(),
      nombre: (json['nombre'] as String?)?.trim() ?? '',
    );
  }
}

class LawyerAvailabilitySlot {
  final int id;
  final int diaSemana;
  final String horaInicioRaw;
  final String horaFinRaw;

  const LawyerAvailabilitySlot({
    required this.id,
    required this.diaSemana,
    required this.horaInicioRaw,
    required this.horaFinRaw,
  });

  TimeOfDay? get horaInicio => _parseTimeOfDay(horaInicioRaw);

  TimeOfDay? get horaFin => _parseTimeOfDay(horaFinRaw);

  factory LawyerAvailabilitySlot.fromJson(Map<String, dynamic> json) {
    return LawyerAvailabilitySlot(
      id: (json['id'] as num).toInt(),
      diaSemana: (json['dia_semana'] as num).toInt(),
      horaInicioRaw: json['hora_inicio'] as String? ?? '',
      horaFinRaw: json['hora_fin'] as String? ?? '',
    );
  }
}

class LawFirmSummary {
  final int id;
  final String? ruc;
  final String? nombreComercial;
  final String? departamento;
  final String? provincia;
  final String? distrito;
  final String? correoContacto;
  final String? telefono;
  final String? direccionUbigeoCodigo;
  final String? lineaExactaDireccion;
  final bool? activo;

  const LawFirmSummary({
    required this.id,
    this.ruc,
    this.nombreComercial,
    this.departamento,
    this.provincia,
    this.distrito,
    this.correoContacto,
    this.telefono,
    this.direccionUbigeoCodigo,
    this.lineaExactaDireccion,
    this.activo,
  });

  factory LawFirmSummary.fromJson(Map<String, dynamic> json) {
    String? parseString(dynamic value) {
      if (value is String) return value;
      if (value is num) return value.toString();
      return null;
    }

    final direccionRelacion = json['direccion'];
    final direccionMap =
        direccionRelacion is Map<String, dynamic> ? direccionRelacion : null;

    return LawFirmSummary(
      id: (json['id'] as num).toInt(),
      ruc: json['ruc'] as String?,
      nombreComercial: json['nombre_comercial'] as String?,
      departamento: parseString(
        json['departamento'] ?? direccionMap?['departamento'],
      ),
      provincia: parseString(
        json['provincia'] ?? direccionMap?['provincia'],
      ),
      distrito:
          parseString(json['distrito'] ?? direccionMap?['distrito']),


      correoContacto: json['correo_contacto'] as String?,
      telefono: json['telefono'] as String?,
      direccionUbigeoCodigo: parseString(
        json['direccion_ubigeo_codigo'] ??
            json['direccion_id'] ??
            json['direccionUbigeoCodigo'] ??
            direccionMap?['ubigeo_codigo'],      
          ),
      lineaExactaDireccion: parseString(
        json['linea_exacta_direccion'] ??
            json['lineaExactaDireccion'] ??
            direccionMap?['linea_exacta_direccion'],
      ),
      activo: json['activo'] as bool?,
    );
  }
  String? get formattedLocation {
    final parts = <String?>[departamento, provincia, distrito]
        .whereType<String>()
        .map((value) => value.trim())
        .where((value) => value.isNotEmpty)
        .toList(growable: false);
    if (parts.isEmpty) return null;
    return parts.join(' • ');
  }
}

class LawyerStudyAssignment {
  final int id;
  final int usuarioId;
  final int estudioId;
  final bool principal;
  final String? rolEnEstudio;
  final LawFirmSummary estudio;

  const LawyerStudyAssignment({
    required this.id,
    required this.usuarioId,
    required this.estudioId,
    required this.principal,
    required this.rolEnEstudio,
    required this.estudio,
  });

  factory LawyerStudyAssignment.fromJson(Map<String, dynamic> json) {
    return LawyerStudyAssignment(
      id: (json['id'] as num).toInt(),
      usuarioId: (json['usuario_id'] as num).toInt(),
      estudioId: (json['estudio_id'] as num).toInt(),
      principal: json['principal'] as bool? ?? false,
      rolEnEstudio: json['rol_en_estudio'] as String?,
      estudio: LawFirmSummary.fromJson(
        (json['estudio'] as Map<String, dynamic>?) ?? const {},
      ),
    );
  }
}
class LawyerPublicStudy {
  final int id;
  final bool principal;
  final String? rolEnEstudio;
  final LawFirmSummary? estudio;

  const LawyerPublicStudy({
    required this.id,
    required this.principal,
    required this.rolEnEstudio,
    required this.estudio,
  });

  factory LawyerPublicStudy.fromJson(Map<String, dynamic> json) {
    int parseInt(dynamic value) {
      if (value is int) return value;
      if (value is num) return value.toInt();
      if (value is String) return int.tryParse(value) ?? 0;
      return 0;
    }

    return LawyerPublicStudy(
      id: parseInt(json['id']),
      principal: json['principal'] as bool? ?? false,
      rolEnEstudio: json['rol_en_estudio'] as String?,
      estudio: json['estudio'] is Map<String, dynamic>
          ? LawFirmSummary.fromJson(json['estudio'] as Map<String, dynamic>)
          : null,
    );
  }
}

class LawyerPersonaSummary {
  final String? primerNombre;
  final String? segundoNombre;
  final String? apellidoPaterno;
  final String? apellidoMaterno;
  final String? telefono;
  final String? correo;
  final String? direccion;

  const LawyerPersonaSummary({
    this.primerNombre,
    this.segundoNombre,
    this.apellidoPaterno,
    this.apellidoMaterno,
    this.telefono,
    this.correo,
    this.direccion,
  });

  factory LawyerPersonaSummary.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const LawyerPersonaSummary();
    return LawyerPersonaSummary(
      primerNombre: json['primer_nombre'] as String?,
      segundoNombre: json['segundo_nombre'] as String?,
      apellidoPaterno: json['apellido_paterno'] as String?,
      apellidoMaterno: json['apellido_materno'] as String?,
      telefono: json['telefono'] as String?,
      correo: json['correo'] as String?,
      direccion: json['direccion'] as String?,
    );
  }

  String get nombreCompleto {
    final parts = <String?>[
      primerNombre,
      segundoNombre,
      apellidoPaterno,
      apellidoMaterno,
    ];
    return parts
        .whereType<String>()
        .map((value) => value.trim())
        .where((value) => value.isNotEmpty)
        .join(' ');
  }
}

class LawyerBookingSummary {
  final int id;
  final DateTime start;
  final DateTime end;
  final String? estado;

  const LawyerBookingSummary({
    required this.id,
    required this.start,
    required this.end,
    required this.estado,
  });

  factory LawyerBookingSummary.fromJson(Map<String, dynamic> json) {
    DateTime parseDate(dynamic value) {
      if (value is String) {
        final parsed = DateTime.tryParse(value);
        if (parsed != null) return parsed.toLocal();
      }
      return DateTime.now();
    }

    int parseInt(dynamic value) {
      if (value is int) return value;
      if (value is num) return value.toInt();
      if (value is String) return int.tryParse(value) ?? 0;
      return 0;
    }

    return LawyerBookingSummary(
      id: parseInt(json['id']),
      start: parseDate(json['inicia_el'] ?? json['start']),
      end: parseDate(json['termina_el'] ?? json['end']),
      estado: json['estado'] as String?,
    );
  }

  bool overlaps(DateTime otherStart, DateTime otherEnd) {
    return start.isBefore(otherEnd) && end.isAfter(otherStart);
  }
}

class LawyerAvailabilityCalendarData {
  final List<LawyerAvailabilitySlot> weeklySlots;
  final List<LawyerBookingSummary> bookings;
  final DateTime? rangeStart;
  final DateTime? rangeEnd;

  const LawyerAvailabilityCalendarData({
    required this.weeklySlots,
    required this.bookings,
    required this.rangeStart,
    required this.rangeEnd,
  });

  factory LawyerAvailabilityCalendarData.fromJson(Map<String, dynamic> json) {
    List<Map<String, dynamic>> parseList(dynamic value) {
      if (value is List) {
        return value.whereType<Map<String, dynamic>>().toList();
      }
      return const [];
    }

    DateTime? parseDate(dynamic value) {
      if (value is String) {
        final parsed = DateTime.tryParse(value);
        return parsed?.toLocal();
      }
      return null;
    }

    final availabilityJson = parseList(json['availability']);
    final bookingsJson = parseList(json['bookings']);
    final rangeJson = json['range'] as Map<String, dynamic>?;

    return LawyerAvailabilityCalendarData(
      weeklySlots: availabilityJson
          .map(LawyerAvailabilitySlot.fromJson)
          .toList(),
      bookings: bookingsJson
          .map(LawyerBookingSummary.fromJson)
          .toList(),
      rangeStart: parseDate(rangeJson?['from']),
      rangeEnd: parseDate(rangeJson?['to']),
    );
  }
}

class LawyerPublicProfile {
  final int usuarioId;
  final String? nombreCompleto;
  final LawyerPersonaSummary persona;
  final LawyerProfileInfo? perfil;
  final List<LawyerSpecialty> especialidades;
  final List<LawyerPublicStudy> estudios;
  final LawFirmSummary? estudioPrincipal;

  const LawyerPublicProfile({
    required this.usuarioId,
    required this.nombreCompleto,
    required this.persona,
    required this.perfil,
    required this.especialidades,
    required this.estudios,
    required this.estudioPrincipal,
  });

  factory LawyerPublicProfile.fromJson(Map<String, dynamic> json) {
    int parseInt(dynamic value) {
      if (value is int) return value;
      if (value is num) return value.toInt();
      if (value is String) return int.tryParse(value) ?? 0;
      return 0;
    }

    List<LawyerSpecialty> parseSpecialties(dynamic value) {
      if (value is List) {
        return value
            .whereType<Map<String, dynamic>>()
            .map(LawyerSpecialty.fromJson)
            .toList();
      }
      return const [];
    }

    List<LawyerPublicStudy> parseStudies(dynamic value) {
      if (value is List) {
        return value
            .whereType<Map<String, dynamic>>()
            .map(LawyerPublicStudy.fromJson)
            .toList();
      }
      return const [];
    }

    final perfilJson = json['perfil'] as Map<String, dynamic>?;

    return LawyerPublicProfile(
      usuarioId: parseInt(json['usuarioId'] ?? json['usuario_id'] ?? json['id']),
      nombreCompleto: json['nombreCompleto'] as String?,
      persona: LawyerPersonaSummary.fromJson(json['persona'] as Map<String, dynamic>?),
      perfil: perfilJson != null ? LawyerProfileInfo.fromJson(perfilJson) : null,
      especialidades: parseSpecialties(json['especialidades']),
      estudios: parseStudies(json['estudios']),
      estudioPrincipal: json['estudioPrincipal'] is Map<String, dynamic>
          ? LawFirmSummary.fromJson(json['estudioPrincipal'] as Map<String, dynamic>)
          : null,
    );
  }

  List<String> get specialtyNames => especialidades
      .map((specialty) => specialty.nombre.trim())
      .where((name) => name.isNotEmpty)
      .toList();

  bool get hasTarifa => perfil?.tarifaBase != null && (perfil!.tarifaBase ?? 0) > 0;
}

class LawyerProfileSnapshot {
  final LawyerProfileInfo? info;
  final List<LawyerSpecialty> specialties;
  final List<LawyerAvailabilitySlot> availability;
  final List<LawyerStudyAssignment> studies;

  const LawyerProfileSnapshot({
    required this.info,
    required this.specialties,
    required this.availability,
    required this.studies,
  });

  bool get isComplete {
    final infoComplete = info?.hasBasicInfo ?? false;
    final hasSpecialties = specialties.isNotEmpty;
    final hasAvailability = availability.isNotEmpty;
    final hasStudies = studies.isNotEmpty;
    return infoComplete && hasSpecialties && hasAvailability && hasStudies;
  }
}