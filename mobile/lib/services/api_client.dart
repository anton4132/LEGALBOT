import 'dart:convert';
import 'package:http/http.dart' as http;

import '../models/lawyer_application.dart';
import '../models/user_session.dart';

class ApiClient {
  static const String _baseUrl = 'http://localhost:3000/api';

  static Map<String, dynamic>? _tryDecodeJson(String body) {
    if (body.isEmpty) return null;
    try {
      final dynamic parsed = jsonDecode(body);
      return parsed is Map<String, dynamic> ? parsed : null;
    } catch (_) {
      return null;
    }
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

    final data = _tryDecodeJson(response.body);
    final bool success =
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

    final data = _tryDecodeJson(response.body);
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
    final data = _tryDecodeJson(response.body);

    if (response.statusCode == 200) {
      return LawyerApplicationStatus.fromJson(
          data?['application'] as Map<String, dynamic>?);
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudo obtener el estado de la solicitud';
    throw Exception(message);
  }

  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  //  SIN "colegiaturaCarnet": se elimina el parámetro y su uso
  // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
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

    final data = _tryDecodeJson(response.body);
    if (response.statusCode == 200 || response.statusCode == 201) {
      return LawyerApplicationStatus.fromJson(
          data?['application'] as Map<String, dynamic>?);
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudo enviar la solicitud';
    throw Exception(message);
  }
}
