class ClientContactSettings {
  final int usuarioId;
  final int personaId;
  final String? telefono;
  final String correo;
  final String? direccionId;
  final String? lineaExactaDireccion;
  final String? departamento;
  final String? provincia;
  final String? distrito;

  const ClientContactSettings({
    required this.usuarioId,
    required this.personaId,
    required this.telefono,
    required this.correo,
    required this.direccionId,
    required this.lineaExactaDireccion,
    required this.departamento,
    required this.provincia,
    required this.distrito,
  });

  factory ClientContactSettings.fromUserJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const ClientContactSettings(
        usuarioId: 0,
        personaId: 0,
        telefono: null,
        correo: '',
        direccionId: null,
        lineaExactaDireccion: null,
        departamento: null,
        provincia: null,
        distrito: null,
      );
    }

    int _parseInt(dynamic value) {
      if (value is int) return value;
      if (value is num) return value.toInt();
      if (value is String) {
        return int.tryParse(value) ?? 0;
      }
      return 0;
    }

    String? _trimString(dynamic value) {
      if (value == null) return null;
      final text = value.toString().trim();
      return text.isEmpty ? null : text;
    }

    final persona = json['persona'] as Map<String, dynamic>? ?? const {};
    final direccion = persona['direccion'] as Map<String, dynamic>? ?? const {};

    return ClientContactSettings(
      usuarioId: _parseInt(json['id'] ?? json['usuarioId']),
      personaId: _parseInt(json['persona_id'] ?? json['personaId']),
      telefono: _trimString(persona['telefono']),
      correo: _trimString(persona['correo']) ?? '',
      direccionId: _trimString(persona['direccion_id']),
      lineaExactaDireccion: _trimString(persona['linea_exacta_direccion']),
      departamento: _trimString(direccion['departamento']),
      provincia: _trimString(direccion['provincia']),
      distrito: _trimString(direccion['distrito']),
    );
  }

  ClientContactSettings copyWith({
    String? telefono,
    String? correo,
    String? direccionId,
    String? lineaExactaDireccion,
    String? departamento,
    String? provincia,
    String? distrito,
  }) {
    return ClientContactSettings(
      usuarioId: usuarioId,
      personaId: personaId,
      telefono: telefono ?? this.telefono,
      correo: correo ?? this.correo,
      direccionId: direccionId ?? this.direccionId,
      lineaExactaDireccion: lineaExactaDireccion ?? this.lineaExactaDireccion,
      departamento: departamento ?? this.departamento,
      provincia: provincia ?? this.provincia,
      distrito: distrito ?? this.distrito,
    );
  }
}