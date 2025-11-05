
import 'lawyer_application.dart';

int _parseInt(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) {
    return int.tryParse(value) ?? 0;
  }
  return 0;
}

class UserAccount {
  final int usuarioId;
  final int rolId;
  final String? rolCodigo;
  final String? rolNombre;
  final bool activo;

  const UserAccount({
    required this.usuarioId,
    required this.rolId,
    this.rolCodigo,
    this.rolNombre,
    required this.activo,
  });

  factory UserAccount.fromJson(Map<String, dynamic> json) {
    return UserAccount(
      usuarioId: _parseInt(json['usuarioId']),
      rolId: _parseInt(json['rolId']),
      rolCodigo: json['rolCodigo'] as String?,
      rolNombre: json['rolNombre'] as String?,
      activo: json['activo'] as bool? ?? false,
    );
  }

  bool get isLawyer => (rolCodigo ?? '').toLowerCase() == 'abogado';

  bool get isClient => (rolCodigo ?? '').toLowerCase() == 'cliente';

  Map<String, dynamic> toJson() => <String, dynamic>{
        'usuarioId': usuarioId,
        'rolId': rolId,
        if (rolCodigo != null) 'rolCodigo': rolCodigo,
        if (rolNombre != null) 'rolNombre': rolNombre,
        'activo': activo,
      };
}

class UserSession {
    final int personaId;
  final int usuarioId;
  final int rolId;
  final String? rolCodigo;
  final String? rolNombre;
  final bool activo;
  final String token;
  final String? telefono;
  final String? dni;
  final String? correo;
  final String? nombreCompleto;
  final List<UserAccount> accounts;
  final LawyerApplicationStatus application;

  const UserSession({
    required this.personaId,
    required this.usuarioId,
    required this.rolId,
    this.rolCodigo,
    this.rolNombre,
    required this.activo,
    required this.token,
    this.telefono,
    this.dni,
    this.correo,
    this.nombreCompleto,
    required this.accounts,
    required this.application,
  });

  factory UserSession.fromLoginResponse(Map<String, dynamic> payload) {
    final user = (payload['user'] as Map<String, dynamic>?) ?? const {};
    final accountsJson = (payload['accounts'] as List?) ?? const [];
    final token = payload['token'] as String?;

    if (token == null || token.isEmpty) {
      throw const FormatException('Respuesta de autenticación inválida: token ausente');
    }

    final accounts = accountsJson
        .whereType<Map<String, dynamic>>()
        .map(UserAccount.fromJson)
        .toList(growable: false);

    return UserSession(
      personaId: _parseInt(user['personaId']),
      usuarioId: _parseInt(user['usuarioId']),
      rolId: _parseInt(user['rolId']),
      rolCodigo: user['rolCodigo'] as String?,
      rolNombre: user['rolNombre'] as String?,
      activo: user['activo'] as bool? ?? false,
      token: token,
      telefono: user['telefono'] as String?,
      dni: user['dni'] as String?,
      correo: user['correo'] as String?,
      nombreCompleto: user['nombreCompleto'] as String?,
      accounts: accounts,
      application:
          LawyerApplicationStatus.fromJson(payload['verification'] as Map<String, dynamic>?),
    );
  }

  factory UserSession.fromJson(Map<String, dynamic> json) {
    final accountsJson = (json['accounts'] as List?) ?? const [];
    final token = json['token'] as String?;
    if (token == null || token.isEmpty) {
      throw const FormatException('Respuesta inválida: token ausente');
    }

    return UserSession(
      personaId: _parseInt(json['personaId']),
      usuarioId: _parseInt(json['usuarioId']),
      rolId: _parseInt(json['rolId']),
      rolCodigo: json['rolCodigo'] as String?,
      rolNombre: json['rolNombre'] as String?,
      activo: json['activo'] as bool? ?? false,
      token: token,
      telefono: json['telefono'] as String?,
      dni: json['dni'] as String?,
      correo: json['correo'] as String?,
      nombreCompleto: json['nombreCompleto'] as String?,
      accounts: accountsJson
          .whereType<Map<String, dynamic>>()
          .map(UserAccount.fromJson)
          .toList(growable: false),
      application: LawyerApplicationStatus.fromJson(
        json['application'] as Map<String, dynamic>?,
      ),
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'personaId': personaId,
        'usuarioId': usuarioId,
        'rolId': rolId,
        if (rolCodigo != null) 'rolCodigo': rolCodigo,
        if (rolNombre != null) 'rolNombre': rolNombre,
        'activo': activo,
        'token': token,
        if (telefono != null) 'telefono': telefono,
        if (dni != null) 'dni': dni,
        if (correo != null) 'correo': correo,
        if (nombreCompleto != null) 'nombreCompleto': nombreCompleto,
        'accounts': accounts.map((account) => account.toJson()).toList(),
        'application': application.toJson(),
      };

  bool get hasLawyerAccount => accounts.any((account) => account.isLawyer);

  bool get hasClientAccount => accounts.any((account) => account.isClient);

  bool get isCurrentLawyer => (rolCodigo ?? '').toLowerCase() == 'abogado';

  UserSession copyWith({
    int? personaId,
    int? usuarioId,
    int? rolId,
    String? rolCodigo,
    String? rolNombre,
    bool? activo,
    String? token,
    String? telefono,
    String? dni,
    String? correo,
    String? nombreCompleto,
    List<UserAccount>? accounts,
    LawyerApplicationStatus? application,
  }) {
    return UserSession(
      personaId: personaId ?? this.personaId,
      usuarioId: usuarioId ?? this.usuarioId,
      rolId: rolId ?? this.rolId,
      rolCodigo: rolCodigo ?? this.rolCodigo,
      rolNombre: rolNombre ?? this.rolNombre,
      activo: activo ?? this.activo,
      token: token ?? this.token,
      telefono: telefono ?? this.telefono,
      dni: dni ?? this.dni,
      correo: correo ?? this.correo,
      nombreCompleto: nombreCompleto ?? this.nombreCompleto,
      accounts: accounts ?? this.accounts,
      application: application ?? this.application,
    );
  }

  UserSession applySwitchResult(SwitchAccountResult result) {
    return copyWith(
      personaId: result.personaId,
      usuarioId: result.usuarioId,
      rolId: result.rolId,
      rolCodigo: result.rolCodigo,
      rolNombre: result.rolNombre,
      token: result.token,
      activo: result.activo,
    );
  }
}

class MobileAccountsResult {
  final int? personaId;
  final String? nombreCompleto;
  final String? telefono;
  final String? dni;
  final String? correo;
  final List<UserAccount> accounts;

  const MobileAccountsResult({
    this.personaId,
    this.nombreCompleto,
    this.telefono,
    this.dni,
    this.correo,
    required this.accounts,
  });

  factory MobileAccountsResult.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const MobileAccountsResult(accounts: []);
    }
    final accountsJson = (json['accounts'] as List?) ?? const [];
    return MobileAccountsResult(
      personaId: _parseInt(json['personaId']),
      nombreCompleto: json['nombreCompleto'] as String?,
      telefono: json['telefono'] as String?,
      dni: json['dni'] as String?,
      correo: json['correo'] as String?,
      accounts: accountsJson
          .whereType<Map<String, dynamic>>()
          .map(UserAccount.fromJson)
          .toList(growable: false),
    );
  }
}

class SwitchAccountResult {
  final String token;
  final int personaId;
  final int usuarioId;
  final int rolId;
  final String? rolCodigo;
  final String? rolNombre;
  final bool activo;

  const SwitchAccountResult({
    required this.token,
    required this.personaId,
    required this.usuarioId,
    required this.rolId,
    this.rolCodigo,
    this.rolNombre,
    required this.activo,
  });

  factory SwitchAccountResult.fromJson(Map<String, dynamic> json) {
    final token = json['token'] as String? ?? '';
    if (token.isEmpty) {
      throw const FormatException('Respuesta inválida al cambiar de cuenta: token ausente');
    }

    return SwitchAccountResult(
      token: token,
      personaId: _parseInt(json['personaId']),
      usuarioId: _parseInt(json['usuarioId']),
      rolId: _parseInt(json['rolId']),
      rolCodigo: json['rolCodigo'] as String?,
      rolNombre: json['rolNombre'] as String?,
      activo: json['activo'] as bool? ?? false,
    );
  }
}