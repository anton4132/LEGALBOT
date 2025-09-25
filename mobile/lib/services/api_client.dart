import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/lawyer_profile_models.dart';
import '../models/lawyer_application.dart';
import '../models/user_session.dart';


class UnauthorizedException implements Exception {
  final String message;

  const UnauthorizedException(
      [this.message = 'Tu sesión ha expirado. Inicia sesión nuevamente.']);

  @override
  String toString() => message;
}

class ApiClient {
  static const String _baseUrl = 'http://localhost:3000/api';

  static Object? _tryDecodeJson(String body) {
    if (body.isEmpty) return null;
    try {
      return jsonDecode(body);
    } catch (_) {
      return null;
    }
  }
   static Map<String, dynamic>? _asJsonMap(Object? value) {
    return value is Map<String, dynamic> ? value : null;
  }

  static List<Map<String, dynamic>> _asJsonMapList(Object? value) {
    if (value is List) {
      return value.whereType<Map<String, dynamic>>().toList();
    }
    return const [];
  }

  static Map<String, String> _authHeaders(String token, {bool json = false}) {
    final headers = <String, String>{
      'Authorization': 'Bearer $token',
    };
    if (json) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }

  static Future<List<Map<String, dynamic>>> fetchEspecialidades() async {
    final uri = Uri.parse('$_baseUrl/especialidades');
    final http.Response response = await http.get(uri);
    if (response.statusCode == 200) {
      final List<dynamic> data = jsonDecode(response.body) as List<dynamic>;
      return data.cast<Map<String, dynamic>>();
    }
    throw Exception('Error obteniendo especialidades');
  }

  static Future<void> signup({
    required String userType,
    required Map<String, String> personalInfo,
    required Map<String, String> contactInfo,
    required String password,
  }) async {
    final int rolId = userType == 'abogado' ? 2 : 3;

    String? trimOrNull(String? value) {
      if (value == null) return null;
      final trimmed = value.trim();
      return trimmed.isEmpty ? null : trimmed;
    }

    String? digitsOrNull(String? value) {
      if (value == null) return null;
      final digits = value.replaceAll(RegExp(r'\D'), '');
      return digits.isEmpty ? null : digits;
    }

    final persona = <String, dynamic>{
      'dni': trimOrNull(contactInfo['dni']),
      'telefono': digitsOrNull(contactInfo['phone']),
      'correo': trimOrNull(contactInfo['email']),
      'primer_nombre': trimOrNull(personalInfo['primerNombre']),
      'segundo_nombre': trimOrNull(personalInfo['segundoNombre']),
      'apellido_paterno': trimOrNull(personalInfo['apellidoPaterno']),
      'apellido_materno': trimOrNull(personalInfo['apellidoMaterno']),
      'direccion': trimOrNull(contactInfo['direccion']),
    };
    persona.removeWhere((key, value) => value == null);

    final Map<String, dynamic> payload = {
      'rol_id': rolId,
      'clave': password,
      'persona': persona,
    };

    if (userType == 'abogado') {
      final especialidadNombre = trimOrNull(contactInfo['especialidadNombre']);
      if (especialidadNombre != null) {
        payload['abogado_info'] = {
          'especialidades': [especialidadNombre],
        };
      }
    }

    final uri = Uri.parse('$_baseUrl/users');
    final http.Response response = await http.post(
      uri,
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );

    Map<String, dynamic>? data;
    try {
      data = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      // ignore json parse errors
    }

    if (response.statusCode >= 400 ||
        (data != null && data['success'] == false)) {
      final message = data != null && data['message'] is String
          ? data['message'] as String
          : 'Error registrando usuario';
      throw Exception(message);
    }
  }

  static Future<UserSession> login({
    required String phone,
    required String dni,
    required String password,
  }) async {
    String _digitsOnly(String value) => value.replaceAll(RegExp(r'\D'), '');
    final uri = Uri.parse('$_baseUrl/auth/mobile-login');
    final http.Response response = await http.post(
      uri,
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({
        'telefono': _digitsOnly(phone),
        'dni': _digitsOnly(dni),
        'password': password,
      }),
    );


    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);    final bool success =
        response.statusCode == 200 && (data?['success'] as bool? ?? false);
    if (success && data != null) {
      try {
        return UserSession.fromLoginResponse(data);
      } catch (error) {
        throw Exception('Respuesta inválida del servidor: ${error.toString()}');
      }
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudo iniciar sesión';
    throw Exception(message);
  }

  static Future<SwitchAccountResult> switchAccount({
    required String token,
    required int usuarioId,
  }) async {
    final uri = Uri.parse('$_baseUrl/auth/switch-account');
    final response = await http.post(
      uri,
      headers: _authHeaders(token, json: true),
      body: jsonEncode({'usuarioId': usuarioId}),
    );

    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);
    if (response.statusCode == 401) {
      final message = data != null && data['message'] is String
          ? data['message'] as String
          : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }
    if (response.statusCode == 200 && data != null) {
      return SwitchAccountResult.fromJson(data);
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudo cambiar de cuenta';
    throw Exception(message);
  }

  static Future<LawyerApplicationStatus> fetchLawyerApplicationStatus(
      {required String token}) async {
    final uri = Uri.parse('$_baseUrl/lawyers/applications/me');
    final response = await http.get(uri, headers: _authHeaders(token));
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);

    if (response.statusCode == 401) {
      final message = data != null && data['message'] is String
          ? data['message'] as String
          : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200) {
      return LawyerApplicationStatus.fromJson(
          data?['application'] as Map<String, dynamic>?);
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudo obtener el estado de la solicitud';
    throw Exception(message);
  }

  
  static Future<LawyerApplicationStatus> submitLawyerApplication({
    required String token,
    required String linkedinUrl,
    required String tituloUrl,
    required String colegiaturaNumero,
    required String colegioNombre,
    required String colegioRegion,
    String? colegiaturaFechaEmision,
    String? colegiaturaFechaVigenciaHasta,
    List<int>? colegiaturaCarnetArchivoBytes,
  }) async {
    final uri = Uri.parse('$_baseUrl/lawyers/applications');
    final Map<String, dynamic> payload = {
      'linkedinUrl': linkedinUrl,
      'tituloUrl': tituloUrl,
      'colegiaturaNumero': colegiaturaNumero,
      'colegioNombre': colegioNombre,
      'colegioRegion': colegioRegion,
    };

    if (colegiaturaFechaEmision != null &&
        colegiaturaFechaEmision.trim().isNotEmpty) {
      payload['colegiaturaFechaEmision'] = colegiaturaFechaEmision.trim();
    }

    if (colegiaturaFechaVigenciaHasta != null &&
        colegiaturaFechaVigenciaHasta.trim().isNotEmpty) {
      payload['colegiaturaFechaVigenciaHasta'] =
          colegiaturaFechaVigenciaHasta.trim();
    }

    if (colegiaturaCarnetArchivoBytes != null &&
        colegiaturaCarnetArchivoBytes.isNotEmpty) {
      payload['colegiaturaCarnetBytes'] =
          base64Encode(colegiaturaCarnetArchivoBytes);
    }

    final response = await http.post(
      uri,
      headers: _authHeaders(token, json: true),
      body: jsonEncode(payload),
    );

    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);
    if (response.statusCode == 401) {
      final message = data != null && data['message'] is String
          ? data['message'] as String
          : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }
    if (response.statusCode == 200 || response.statusCode == 201) {
      return LawyerApplicationStatus.fromJson(
          data?['application'] as Map<String, dynamic>?);
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudo enviar la solicitud';
    throw Exception(message);
  }
  static Future<MobileAccountsResult> fetchMobileAccounts({
    required String token,
  }) async {
    final uri = Uri.parse('$_baseUrl/auth/mobile-accounts');
    final response = await http.get(uri, headers: _authHeaders(token));
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);
    if (response.statusCode == 401) {
      final message = data != null && data['message'] is String
          ? data['message'] as String
          : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200 && data != null) {
      return MobileAccountsResult.fromJson(data);
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudieron obtener las cuentas';
    throw Exception(message);
  }

  static Future<LawyerProfileInfo?> fetchLawyerProfileInfo({
    required String token,
    required int userId,
  }) async {
    final uri = Uri.parse('$_baseUrl/users/$userId/perfil');
    final response = await http.get(uri, headers: _authHeaders(token));
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);
    if (response.statusCode == 404) {
      return null;
    }

    if (response.statusCode == 401) {
      final message = data != null && data['message'] is String
          ? data['message'] as String
          : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200) {
      return LawyerProfileInfo.fromJson(data);
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudo obtener el perfil de abogado';
    throw Exception(message);
  }

  static Future<LawyerProfileInfo> saveLawyerProfileInfo({
    required String token,
    required int userId,
    required LawyerProfileInfo info,
  }) async {
    final uri = Uri.parse('$_baseUrl/users/$userId/perfil');
    final response = await http.put(
      uri,
      headers: _authHeaders(token, json: true),
      body: jsonEncode(info.toPayload()),
    );
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);

    if (response.statusCode == 401) {
      final message = data != null && data['message'] is String
          ? data['message'] as String
          : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200 && data != null) {
      final perfilJson = data['perfil'] as Map<String, dynamic>? ?? data;
      return LawyerProfileInfo.fromJson(perfilJson);
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudo guardar el perfil de abogado';
    throw Exception(message);
  }

  static Future<List<LawyerSpecialty>> fetchSpecialtyCatalog() async {
    final rows = await fetchEspecialidades();
    return rows
        .map((row) => LawyerSpecialty.fromJson(row))
        .where((specialty) => specialty.nombre.isNotEmpty)
        .toList();
  }

  static Future<List<LawyerSpecialty>> fetchLawyerSpecialties({
    required String token,
    required int userId,
  }) async {
    final uri = Uri.parse('$_baseUrl/users/$userId/especialidades');
    final response = await http.get(uri, headers: _authHeaders(token));
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);
    if (response.statusCode == 401) {
      final message = data != null && data['message'] is String
          ? data['message'] as String
          : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }
 if (response.statusCode == 200 && decoded is List) {
      final list = _asJsonMapList(decoded);
      return list.map(LawyerSpecialty.fromJson).toList();
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudieron obtener las especialidades';
    throw Exception(message);
  }

  static Future<void> updateLawyerSpecialties({
    required String token,
    required int userId,
    required List<int> specialtyIds,
  }) async {
    final uri = Uri.parse('$_baseUrl/users/$userId/especialidades');
    final response = await http.put(
      uri,
      headers: _authHeaders(token, json: true),
      body: jsonEncode({'ids': specialtyIds}),
    );
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);

    if (response.statusCode == 401) {
      final message = data != null && data['message'] is String
          ? data['message'] as String
          : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200) {
      return;
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudieron guardar las especialidades';
    throw Exception(message);
  }

  static Future<List<LawyerAvailabilitySlot>> fetchLawyerAvailability({
    required String token,
    required int userId,
  }) async {
    final uri = Uri.parse('$_baseUrl/users/$userId/disponibilidad');
    final response = await http.get(uri, headers: _authHeaders(token));
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);

    if (response.statusCode == 401) {
      final message = data != null && data['message'] is String
          ? data['message'] as String
          : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

      if (response.statusCode == 200 && decoded is List) {
      final list = _asJsonMapList(decoded);
      return list.map(LawyerAvailabilitySlot.fromJson).toList();
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudo obtener la disponibilidad';
    throw Exception(message);
  }

  static Future<LawyerAvailabilitySlot> addLawyerAvailabilitySlot({
    required String token,
    required int userId,
    required int day,
    required String startTime,
    required String endTime,
  }) async {
    final uri = Uri.parse('$_baseUrl/users/$userId/disponibilidad');
    final response = await http.post(
      uri,
      headers: _authHeaders(token, json: true),
      body: jsonEncode({
        'dia_semana': day,
        'hora_inicio': startTime,
        'hora_fin': endTime,
      }),
    );
 final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);
    if (response.statusCode == 401) {
      final message = data != null && data['message'] is String
          ? data['message'] as String
          : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200 || response.statusCode == 201) {
      final slotJson = data?['slot'] as Map<String, dynamic>? ?? const {};
      return LawyerAvailabilitySlot.fromJson(slotJson);
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudo registrar la disponibilidad';
    throw Exception(message);
  }

  static Future<void> deleteLawyerAvailabilitySlot({
    required String token,
    required int userId,
    required int slotId,
  }) async {
    final uri = Uri.parse('$_baseUrl/users/$userId/disponibilidad/$slotId');
    final response = await http.delete(uri, headers: _authHeaders(token));
 final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);
    if (response.statusCode == 401) {
      final message = data != null && data['message'] is String
          ? data['message'] as String
          : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200) {
      return;
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudo eliminar la disponibilidad';
    throw Exception(message);
  }

  static Future<List<LawyerStudyAssignment>> fetchLawyerStudies({
    required String token,
    required int userId,
  }) async {
    final uri = Uri.parse('$_baseUrl/users/$userId/estudios');
    final response = await http.get(uri, headers: _authHeaders(token));
final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);
    if (response.statusCode == 401) {
      final message = data != null && data['message'] is String
          ? data['message'] as String
          : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

   if (response.statusCode == 200 && decoded is List) {
      final list = _asJsonMapList(decoded);
      return list.map(LawyerStudyAssignment.fromJson).toList();
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudieron obtener los estudios vinculados';
    throw Exception(message);
  }

  static Future<LawyerStudyAssignment> upsertLawyerStudy({
    required String token,
    required int userId,
    required int studyId,
    required bool principal,
    String? role,
  }) async {
    final uri = Uri.parse('$_baseUrl/users/$userId/estudios');
    final response = await http.post(
      uri,
      headers: _authHeaders(token, json: true),
      body: jsonEncode({
        'estudio_id': studyId,
        'principal': principal,
        'rol_en_estudio': role,
      }),
    );
final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);
    if (response.statusCode == 401) {
      final message = data != null && data['message'] is String
          ? data['message'] as String
          : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if ((response.statusCode == 200 || response.statusCode == 201) && data != null) {
      final vinculo = data['vinculo'] as Map<String, dynamic>? ?? const {};
      return LawyerStudyAssignment.fromJson(vinculo);
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudo guardar el estudio vinculado';
    throw Exception(message);
  }

  static Future<void> deleteLawyerStudy({
    required String token,
    required int userId,
    required int studyId,
  }) async {
    final uri = Uri.parse('$_baseUrl/users/$userId/estudios/$studyId');
    final response = await http.delete(uri, headers: _authHeaders(token));
final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);
    if (response.statusCode == 401) {
      final message = data != null && data['message'] is String
          ? data['message'] as String
          : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200) {
      return;
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudo eliminar el estudio vinculado';
    throw Exception(message);
  }

  static Future<List<LawFirmSummary>> searchLawFirms({
    required String token,
    required String query,
  }) async {
    final uri = Uri.parse('$_baseUrl/estudios?search=${Uri.encodeQueryComponent(query)}');
    final response = await http.get(uri, headers: _authHeaders(token));
final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);

    if (response.statusCode == 401) {
      final message = data != null && data['message'] is String
          ? data['message'] as String
          : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

   if (response.statusCode == 200 && decoded is List) {
      final list = _asJsonMapList(decoded);
      return list.map(LawFirmSummary.fromJson).toList();
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudieron buscar estudios';
    throw Exception(message);
  }

  static Future<LawFirmSummary> createLawFirm({
    required String token,
    String? ruc,
    String? nombreComercial,
    String? pais,
    String? ciudad,
    String? correoContacto,
    String? telefono,
    String? direccion,
  }) async {
    final uri = Uri.parse('$_baseUrl/estudios');
    final payload = {
      'ruc': ruc,
      'nombre_comercial': nombreComercial,
      'pais': pais,
      'ciudad': ciudad,
      'correo_contacto': correoContacto,
      'telefono': telefono,
      'direccion': direccion,
    }..removeWhere((key, value) => value == null || (value is String && value.trim().isEmpty));

    final response = await http.post(
      uri,
      headers: _authHeaders(token, json: true),
      body: jsonEncode(payload),
    );
final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);

    if (response.statusCode == 401) {
      final message = data != null && data['message'] is String
          ? data['message'] as String
          : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if ((response.statusCode == 200 || response.statusCode == 201) && data != null) {
      return LawFirmSummary.fromJson(data);
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudo registrar el estudio';
    throw Exception(message);
  }

  static Future<LawyerProfileSnapshot> fetchLawyerProfileSnapshot({
    required String token,
    required int userId,
  }) async {
    final results = await Future.wait([
      fetchLawyerProfileInfo(token: token, userId: userId),
      fetchLawyerSpecialties(token: token, userId: userId),
      fetchLawyerAvailability(token: token, userId: userId),
      fetchLawyerStudies(token: token, userId: userId),
    ]);

    return LawyerProfileSnapshot(
      info: results[0] as LawyerProfileInfo?,
      specialties: (results[1] as List<LawyerSpecialty>),
      availability: (results[2] as List<LawyerAvailabilitySlot>),
      studies: (results[3] as List<LawyerStudyAssignment>),
    );
  }
}


