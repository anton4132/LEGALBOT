enum LawyerApplicationState { none, pendiente, observada, aprobada, rechazada }

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

DateTime? _parseDate(dynamic value) {
  if (value is String && value.isNotEmpty) {
    return DateTime.tryParse(value);
  }
  return null;
}

class LawyerApplicationStatus {
  final int? id;
  final LawyerApplicationState state;
  final String? observation;
  final String? linkedinUrl;
  final String? tituloUrl;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final DateTime? approvedAt;

  const LawyerApplicationStatus({
    this.id,
    required this.state,
    this.observation,
    this.linkedinUrl,
    this.tituloUrl,
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

  factory LawyerApplicationStatus.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return LawyerApplicationStatus.empty;
    }

    return LawyerApplicationStatus(
      id: json['id'] as int?,
      state: parseLawyerApplicationState(json['estado'] as String?),
      observation: json['observaciones'] as String?,
      linkedinUrl: json['linkedinUrl'] as String? ?? json['linkedin_url'] as String?,
      tituloUrl: json['tituloUrl'] as String? ?? json['titulo_url'] as String?,
      createdAt: _parseDate(json['creadoEl'] ?? json['creado_el']),
      updatedAt: _parseDate(json['actualizadoEl'] ?? json['actualizado_el']),
      approvedAt: _parseDate(json['aprobadoEl'] ?? json['aprobado_el']),
    );
  }

  LawyerApplicationStatus copyWith({
    int? id,
    LawyerApplicationState? state,
    String? observation,
    String? linkedinUrl,
    String? tituloUrl,
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
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      approvedAt: approvedAt ?? this.approvedAt,
    );
  }
}