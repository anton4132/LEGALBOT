import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiClient {
  static const String _baseUrl = 'https://localhost:3000/api';

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
        'apellido_paterno': personalInfo['apellidoPaterno'],
        'apellido_materno': personalInfo['apellidoMaterno'],
        'direccion': contactInfo['direccion'],
      },
      'rol_id': rolId,
      'clave': password,
    };

    if (userType == 'abogado' &&
        contactInfo['especialidadNombre'] != null &&
        contactInfo['especialidadNombre']!.isNotEmpty) {
      payload['abogado_info'] = {
        'especialidades': [contactInfo['especialidadNombre']!]
      };
    
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

    if (response.statusCode >= 400 || (data != null && data['success'] == false)) {
      final message = data != null && data['message'] is String
          ? data['message'] as String
          : 'Error registrando usuario';
      throw Exception(message);
    }
  }
    static Future<Map<String, dynamic>> login({
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

    Map<String, dynamic>? data;
    try {
      data = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      // ignore parse errors; handled below
    }

    final bool success =
        response.statusCode == 200 && (data?['success'] as bool? ?? false);
    if (success && data != null && data['user'] is Map<String, dynamic>) {
      return data['user'] as Map<String, dynamic>;
    }

    final message = data != null && data['message'] is String
        ? data['message'] as String
        : 'No se pudo iniciar sesión';
    throw Exception(message);
  }
}
