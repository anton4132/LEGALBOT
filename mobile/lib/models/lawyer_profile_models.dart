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
  final String? bio;
  final ArchivoReference? avatarArchivo;


  const LawyerProfileInfo({
    this.tarifaBase,
    this.direccionAtencion,
    this.bio,
    this.avatarArchivo,
  });

  bool get hasBasicInfo =>
      (tarifaBase != null && tarifaBase! > 0) &&
      (direccionAtencion?.trim().isNotEmpty ?? false) &&
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

    ArchivoReference? _normalizeArchivo(dynamic value) {
      final ref = ArchivoReference.fromJson(value);
      if (ref.id == null && (ref.ruta == null || ref.ruta!.isEmpty)) {
        return null;
      }
      return ref;
    }

    return LawyerProfileInfo(
      tarifaBase: tarifaBase,
      direccionAtencion: json['direccion_atencion'] as String?,
      bio: json['bio'] as String?,
      avatarArchivo: _normalizeArchivo(
        json['avatarArchivo'] ??
            json['avatar_archivo'] ??
            json['avatar'],
      ),
    );
  }

  Map<String, dynamic> toPayload() => {
        'tarifa_base': tarifaBase,
        'direccion_atencion': direccionAtencion,
        'bio': bio,
      }..removeWhere((key, value) => value == null);
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
  final String? pais;
  final String? ciudad;
  final String? correoContacto;
  final String? telefono;
  final String? direccion;
  final bool? activo;

  const LawFirmSummary({
    required this.id,
    this.ruc,
    this.nombreComercial,
    this.pais,
    this.ciudad,
    this.correoContacto,
    this.telefono,
    this.direccion,
    this.activo,
  });

  factory LawFirmSummary.fromJson(Map<String, dynamic> json) {
    return LawFirmSummary(
      id: (json['id'] as num).toInt(),
      ruc: json['ruc'] as String?,
      nombreComercial: json['nombre_comercial'] as String?,
      pais: json['pais'] as String?,
      ciudad: json['ciudad'] as String?,
      correoContacto: json['correo_contacto'] as String?,
      telefono: json['telefono'] as String?,
      direccion: json['direccion'] as String?,
      activo: json['activo'] as bool?,
    );
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