import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiClient {
  static const String _baseUrl = 'http://localhost:3000/api';

  static Future<List<dynamic>> fetchEspecialidades() async {
    final uri = Uri.parse('$_baseUrl/especialidades');
    final http.Response response = await http.get(uri);
    if (response.statusCode == 200) {
      return jsonDecode(response.body) as List<dynamic>;
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
        contactInfo['especialidad'] != null &&
        contactInfo['especialidad']!.isNotEmpty) {
      payload['abogado_info'] = {
        'especialidades': [contactInfo['especialidad']],
      };
    }

    final uri = Uri.parse('$_baseUrl/users');
    final http.Response response = await http.post(
      uri,
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );

    if (response.statusCode >= 400) {
      throw Exception('Error registrando usuario');
    }
  }
}
