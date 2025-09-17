import 'dart:convert';
import 'package:http/http.dart' as http;

import '../models/lawyer_application.dart';
import '../models/user_session.dart';

class ApiClient {
  static const String _baseUrl = 'https://legalbot1-tan.vercel.app/api';

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

    final Map<String, dynamic> payload = {
      'persona': {
        'dni': contactInfo['dni'],
        'telefono': contactInfo['phone'],
        'correo': contactInfo['email'],
        'primer_nombre': personalInfo['primerNombre'],
        'segundo_nombre': personalInfo['segundoNombre'],
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
      final message =
          data != null && data['message'] is String
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

  static Future<LawyerApplicationStatus> submitLawyerApplication({
    required String token,
    required String linkedinUrl,
    required String tituloUrl,
  }) async {
    final uri = Uri.parse('$_baseUrl/lawyers/applications');
    final response = await http.post(
      uri,
      headers: _authHeaders(token, json: true),
      body: jsonEncode({
        'linkedinUrl': linkedinUrl,
        'tituloUrl': tituloUrl,
      }),
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