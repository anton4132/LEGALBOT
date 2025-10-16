import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/archivo_reference.dart';
import '../models/lawyer_profile_models.dart';
import '../models/lawyer_application.dart';
import '../models/user_session.dart';
import '../models/lawyer_search_result.dart';
import '../models/ubigeo_option.dart';
import '../models/dni_lookup_result.dart';
import '../models/client_contact_settings.dart';

class UnauthorizedException implements Exception {
  final String message;

  const UnauthorizedException([
    this.message = 'Tu sesión ha expirado. Inicia sesión nuevamente.',
  ]);

  @override
  String toString() => message;
}

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  const ApiException(this.message, {this.statusCode});

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
    final headers = <String, String>{'Authorization': 'Bearer $token'};
    if (json) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }

  static String _digitsOnly(String value) =>
      value.replaceAll(RegExp(r'\D'), '');

  static Future<DniLookupResult> lookupDni(String dni) async {
    final normalizedDni = _digitsOnly(dni);
    if (normalizedDni.isEmpty) {
      throw const ApiException('Ingresa un DNI válido para verificarlo.');
    }

    final uri = Uri.parse('$_baseUrl/dni/$normalizedDni');
    final http.Response response = await http.get(uri);
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);

    if (response.statusCode == 200 && data?['success'] == true) {
      final payload = _asJsonMap(data?['data']);
      if (payload != null) {
        return DniLookupResult.fromJson(payload);
      }
      throw const ApiException(
        'La respuesta del padrón no contiene nombres válidos.',
      );
    }

    final message =
        data != null && data['message'] is String
            ? data['message'] as String
            : 'No se pudo verificar el DNI proporcionado';
    throw ApiException(message, statusCode: response.statusCode);
  }

  static Future<Set<String>> checkPersonaConflicts({
    String? dni,
    String? telefono,
    String? correo,
  }) async {
    final queryParameters = <String, String>{};

    final normalizedDni = dni != null ? _digitsOnly(dni) : '';
    if (normalizedDni.isNotEmpty) {
      queryParameters['dni'] = normalizedDni;
    }

    final normalizedTelefono = telefono != null ? _digitsOnly(telefono) : '';
    if (normalizedTelefono.isNotEmpty) {
      queryParameters['telefono'] = normalizedTelefono;
    }

    final normalizedCorreo = correo?.trim().toLowerCase() ?? '';
    if (normalizedCorreo.isNotEmpty) {
      queryParameters['correo'] = normalizedCorreo;
    }

    if (queryParameters.isEmpty) {
      return <String>{};
    }

    final uri = Uri.parse(
      '$_baseUrl/users/persona/conflicts',
    ).replace(queryParameters: queryParameters);
    final http.Response response = await http.get(uri);
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);

    if (response.statusCode == 200 && data?['success'] == true) {
      final conflictsMap = _asJsonMap(data?['conflicts']);
      final result = <String>{};
      conflictsMap?.forEach((key, value) {
        if (value is bool && value) {
          result.add(key);
        }
      });
      return result;
    }

    final message =
        data != null && data['message'] is String
            ? data['message'] as String
            : 'No se pudo validar los datos de la persona';
    throw ApiException(message, statusCode: response.statusCode);
  }

  static Future<ClientContactSettings> fetchClientContactSettings({
    required String token,
    required int userId,
  }) async {
    final uri = Uri.parse('$_baseUrl/users/$userId');
    final response = await http.get(uri, headers: _authHeaders(token));
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);

    if (response.statusCode == 401) {
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200 && data?['success'] == true) {
      final userJson = _asJsonMap(data?['user']);
      return ClientContactSettings.fromUserJson(userJson);
    }

    final message =
        data != null && data['message'] is String
            ? data['message'] as String
            : 'No se pudo obtener la información del usuario';
    throw ApiException(message, statusCode: response.statusCode);
  }

  static Future<ClientContactSettings> updateClientContactSettings({
    required String token,
    required int userId,
    String? telefono,
    String? correo,
    String? direccionId,
    String? lineaExactaDireccion,
  }) async {
    final personaPayload = <String, dynamic>{};
    if (telefono != null) {
      personaPayload['telefono'] = telefono;
    }
    if (correo != null) {
      personaPayload['correo'] = correo;
    }
    if (direccionId != null) {
      personaPayload['direccion_id'] = direccionId;
    }
    if (lineaExactaDireccion != null) {
      personaPayload['linea_exacta_direccion'] = lineaExactaDireccion;
    }

    final payload = <String, dynamic>{};
    if (personaPayload.isNotEmpty) {
      payload['persona'] = personaPayload;
    }

    if (payload.isEmpty) {
      throw const ApiException('No se enviaron datos para actualizar.');
    }

    final uri = Uri.parse('$_baseUrl/users/$userId');
    final response = await http.put(
      uri,
      headers: _authHeaders(token, json: true),
      body: jsonEncode(payload),
    );
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);

    if (response.statusCode == 401) {
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200 && data?['success'] == true) {
      final userJson = _asJsonMap(data?['user']);
      return ClientContactSettings.fromUserJson(userJson);
    }

    final message =
        data != null && data['message'] is String
            ? data['message'] as String
            : 'No se pudo actualizar la información del usuario';
    throw ApiException(message, statusCode: response.statusCode);
  }

  static Future<ClientContactSettings> updateUserPassword({
    required String token,
    required int userId,
    required String password,
  }) async {
    final uri = Uri.parse('$_baseUrl/users/$userId');
    final response = await http.put(
      uri,
      headers: _authHeaders(token, json: true),
      body: jsonEncode({'clave': password}),
    );
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);

    if (response.statusCode == 401) {
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200 && data?['success'] == true) {
      final userJson = _asJsonMap(data?['user']);
      return ClientContactSettings.fromUserJson(userJson);
    }

    final message =
        data != null && data['message'] is String
            ? data['message'] as String
            : 'No se pudo actualizar la contraseña';
    throw ApiException(message, statusCode: response.statusCode);
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

  static List<Map<String, dynamic>> _extractUbigeoList(Object? decoded) {
    if (decoded is List) {
      return _asJsonMapList(decoded);
    }
    if (decoded is Map<String, dynamic>) {
      for (final key in const [
        'results',
        'data',
        'items',
        'departamentos',
        'provincias',
        'distritos',
        'rows',
      ]) {
        final list = _asJsonMapList(decoded[key]);
        if (list.isNotEmpty) {
          return list;
        }
      }
    }
    return const [];
  }

  static Future<List<UbigeoOption>> fetchDepartamentos() async {
    final uri = Uri.parse('$_baseUrl/ubigeo/departamentos');
    final http.Response response = await http.get(uri);
    final decoded = _tryDecodeJson(response.body);
    if (response.statusCode == 200) {
      final rows = _extractUbigeoList(decoded);
      return UbigeoOption.listFromJson(rows);
    }
    final data = _asJsonMap(decoded);
    final message =
        data != null && data['message'] is String
            ? data['message'] as String
            : 'No se pudieron cargar los departamentos';
    throw Exception(message);
  }

  static Future<List<UbigeoOption>> fetchProvincias(String parentCodigo) async {
    final uri = Uri.parse(
      '$_baseUrl/ubigeo/departamentos/$parentCodigo/provincias',
    );
    final http.Response response = await http.get(uri);
    final decoded = _tryDecodeJson(response.body);
    if (response.statusCode == 200) {
      final rows = _extractUbigeoList(decoded);
      return UbigeoOption.listFromJson(rows);
    }
    final data = _asJsonMap(decoded);
    final message =
        data != null && data['message'] is String
            ? data['message'] as String
            : 'No se pudieron cargar las provincias';
    throw Exception(message);
  }

  static Future<List<UbigeoOption>> fetchDistritos(String parentCodigo) async {
    final uri = Uri.parse(
      '$_baseUrl/ubigeo/provincias/$parentCodigo/distritos',
    );
    final http.Response response = await http.get(uri);
    final decoded = _tryDecodeJson(response.body);
    if (response.statusCode == 200) {
      final rows = _extractUbigeoList(decoded);
      return UbigeoOption.listFromJson(rows);
    }
    final data = _asJsonMap(decoded);
    final message =
        data != null && data['message'] is String
            ? data['message'] as String
            : 'No se pudieron cargar los distritos';
    throw Exception(message);
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
      final digits = _digitsOnly(value);
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
      'direccion_id': digitsOrNull(contactInfo['ubigeoCodigo']),
      'linea_exacta_direccion': trimOrNull(contactInfo['lineaExactaDireccion']),
    };
    persona.removeWhere((key, value) => value == null);

    final Map<String, dynamic> payload = {
      'rol_id': rolId,
      'clave': password,
      'persona': persona,
    };

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

    final isErrorStatus = response.statusCode >= 400;
    final successFlag = data?['success'] as bool?;

    if (isErrorStatus || successFlag == false) {
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Error registrando usuario';
      throw ApiException(message, statusCode: response.statusCode);
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
    final data = _asJsonMap(decoded);
    final bool success =
        response.statusCode == 200 && (data?['success'] as bool? ?? false);
    if (success && data != null) {
      try {
        return UserSession.fromLoginResponse(data);
      } catch (error) {
        throw Exception('Respuesta inválida del servidor: ${error.toString()}');
      }
    }

    final message =
        data != null && data['message'] is String
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
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }
    if (response.statusCode == 200 && data != null) {
      return SwitchAccountResult.fromJson(data);
    }

    final message =
        data != null && data['message'] is String
            ? data['message'] as String
            : 'No se pudo cambiar de cuenta';
    if (response.statusCode == 403 ||
        response.statusCode == 409 ||
        response.statusCode == 423) {
      throw ApiException(message, statusCode: response.statusCode);
    }
    throw Exception(message);
  }

  static Future<LawyerApplicationStatus> fetchLawyerApplicationStatus({
    required String token,
  }) async {
    final uri = Uri.parse('$_baseUrl/lawyers/applications/me');
    final response = await http.get(uri, headers: _authHeaders(token));
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);

    if (response.statusCode == 401) {
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200) {
      return LawyerApplicationStatus.fromJson(
        data?['application'] as Map<String, dynamic>?,
      );
    }

    final message =
        data != null && data['message'] is String
            ? data['message'] as String
            : 'No se pudo obtener el estado de la solicitud';
    throw Exception(message);
  }

  static Future<LawyerApplicationStatus> submitLawyerApplication({
    required String token,
    required String linkedinUrl,
    required String colegiaturaNumero,
    required String colegioNombre,
    required String colegioRegion,
    String? colegiaturaFechaEmision,
    String? colegiaturaFechaVigenciaHasta,
    ArchivoReference? tituloArchivo,
    int? tituloArchivoId,
    ArchivoReference? colegiaturaCarnetArchivo,
    int? colegiaturaCarnetArchivoId,
  }) async {
    final uri = Uri.parse('$_baseUrl/lawyers/applications');
    final Map<String, dynamic> payload = {
      'linkedinUrl': linkedinUrl,
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

    payload['tituloArchivoId'] = tituloArchivoId;
    payload['colegiaturaCarnetArchivoId'] = colegiaturaCarnetArchivoId;

    if (tituloArchivo != null) {
      payload['tituloArchivo'] = tituloArchivo.toJson();
    }
    if (colegiaturaCarnetArchivo != null) {
      payload['colegiaturaCarnetArchivo'] = colegiaturaCarnetArchivo.toJson();
    }

    final response = await http.post(
      uri,
      headers: _authHeaders(token, json: true),
      body: jsonEncode(payload),
    );

    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);
    if (response.statusCode == 401) {
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }
    if (response.statusCode == 200 || response.statusCode == 201) {
      return LawyerApplicationStatus.fromJson(
        data?['application'] as Map<String, dynamic>?,
      );
    }

    final message =
        data != null && data['message'] is String
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
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200 && data != null) {
      return MobileAccountsResult.fromJson(data);
    }

    final message =
        data != null && data['message'] is String
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
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200) {
      return LawyerProfileInfo.fromJson(data);
    }

    final message =
        data != null && data['message'] is String
            ? data['message'] as String
            : 'No se pudo obtener el perfil de abogado';
    throw Exception(message);
  }

  static Future<LawyerProfileInfo> saveLawyerProfileInfo({
    required String token,
    required int userId,
    required LawyerProfileInfo info,
    ArchivoReference? avatarArchivo,
    int? avatarArchivoId,
  }) async {
    final uri = Uri.parse('$_baseUrl/users/$userId/perfil');
    final Map<String, dynamic> payload = info.toPayload();
    payload['avatar_archivo_id'] = avatarArchivoId;
    if (avatarArchivo != null) {
      payload['avatarArchivo'] = avatarArchivo.toJson();
    }
    final response = await http.put(
      uri,
      headers: _authHeaders(token, json: true),
      body: jsonEncode(payload),
    );
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);

    if (response.statusCode == 401) {
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200 && data != null) {
      final perfilJson = data['perfil'] as Map<String, dynamic>? ?? data;
      return LawyerProfileInfo.fromJson(perfilJson);
    }

    final message =
        data != null && data['message'] is String
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

  static Future<List<LawyerLocationOption>> listLawyerLocations({
    String? token,
  }) async {
    final uri = Uri.parse('$_baseUrl/lawyers/public/locations');
    final headers = token != null ? _authHeaders(token) : <String, String>{};
    final response = await http.get(uri, headers: headers);
    final decoded = _tryDecodeJson(response.body);

    if (response.statusCode == 401) {
      final data = _asJsonMap(decoded);
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200) {
      List<Map<String, dynamic>> rows;
      if (decoded is List) {
        rows = _asJsonMapList(decoded);
      } else if (decoded is Map<String, dynamic>) {
        rows = _asJsonMapList(
          decoded['results'] ?? decoded['data'] ?? decoded['locations'],
        );
      } else {
        rows = const [];
      }
      final options =
          rows
              .map(LawyerLocationOption.fromJson)
              .where(
                (option) => option.hasNombre && option.provincias.isNotEmpty,
              )
              .map((option) {
                final filteredProvinces =
                    option.provincias
                        .where(
                          (province) =>
                              province.hasNombre &&
                              province.distritos.isNotEmpty,
                        )
                        .map((province) {
                          final filteredDistricts =
                              province.distritos
                                  .where((district) => district.hasNombre)
                                  .toList()
                                ..sort((a, b) => a.key.compareTo(b.key));
                          return LawyerLocationProvince(
                            provincia: province.provincia,
                            codigo: province.codigo,
                            distritos: List.unmodifiable(filteredDistricts),
                          );
                        })
                        .toList()
                      ..sort((a, b) => a.key.compareTo(b.key));

                return LawyerLocationOption(
                  departamento: option.departamento,
                  codigo: option.codigo,
                  provincias: List.unmodifiable(filteredProvinces),
                );
              })
              .where((option) => option.provincias.isNotEmpty)
              .toList()
            ..sort((a, b) => a.key.compareTo(b.key));
      return List.unmodifiable(options);
    }
    final data = _asJsonMap(decoded);
    final message =
        data != null && data['message'] is String
            ? data['message'] as String
            : 'No se pudieron obtener las ubicaciones';
    throw Exception(message);
  }

  static Future<List<LawyerSearchResult>> searchLawyers({
    String? token,
    required int specialtyId,
    required String departamento,
    required String provincia,
    required String distrito,
  }) async {
    final queryParameters = <String, String>{
      'especialidadId': specialtyId.toString(),
      'departamento': departamento.trim(),
      'provincia': provincia.trim(),
      'distrito': distrito.trim(),
    };
    final uri = Uri.parse(
      '$_baseUrl/lawyers/public/search',
    ).replace(queryParameters: queryParameters);
    final headers = token != null ? _authHeaders(token) : <String, String>{};
    final response = await http.get(uri, headers: headers);
    final decoded = _tryDecodeJson(response.body);

    if (response.statusCode == 401) {
      final data = _asJsonMap(decoded);
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }
    if (response.statusCode == 400) {
      final data = _asJsonMap(decoded);
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Parámetros de búsqueda inválidos';
      throw Exception(message);
    }

    if (response.statusCode == 200) {
      List<Map<String, dynamic>> rows;
      if (decoded is List) {
        rows = _asJsonMapList(decoded);
      } else if (decoded is Map<String, dynamic>) {
        rows = _asJsonMapList(decoded['results'] ?? decoded['data']);
      } else {
        rows = const [];
      }
      return rows.map(LawyerSearchResult.fromJson).toList();
    }

    final data = _asJsonMap(decoded);
    final message =
        data != null && data['message'] is String
            ? data['message'] as String
            : 'No se pudo realizar la búsqueda';
    throw Exception(message);
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
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }
    if (response.statusCode == 200 && decoded is List) {
      final list = _asJsonMapList(decoded);
      return list.map(LawyerSpecialty.fromJson).toList();
    }

    final message =
        data != null && data['message'] is String
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
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200) {
      return;
    }

    final message =
        data != null && data['message'] is String
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
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200 && decoded is List) {
      final list = _asJsonMapList(decoded);
      return list.map(LawyerAvailabilitySlot.fromJson).toList();
    }

    final message =
        data != null && data['message'] is String
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
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200 || response.statusCode == 201) {
      final slotJson = data?['slot'] as Map<String, dynamic>? ?? const {};
      return LawyerAvailabilitySlot.fromJson(slotJson);
    }

    final message =
        data != null && data['message'] is String
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
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200) {
      return;
    }

    final message =
        data != null && data['message'] is String
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
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200 && decoded is List) {
      final list = _asJsonMapList(decoded);
      return list.map(LawyerStudyAssignment.fromJson).toList();
    }

    final message =
        data != null && data['message'] is String
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
    String? direccionUbigeoCodigo,
    String? lineaExactaDireccion,
  }) async {
    final uri = Uri.parse('$_baseUrl/users/$userId/estudios');
    final payload = {
      'estudio_id': studyId,
      'principal': principal,
      'rol_en_estudio': role,
      'direccion_id': direccionUbigeoCodigo,
      'linea_exacta_direccion': lineaExactaDireccion,
    }..removeWhere((key, value) => value == null);
    final response = await http.post(
      uri,
      headers: _authHeaders(token, json: true),
      body: jsonEncode(payload),
    );
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);
    if (response.statusCode == 401) {
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if ((response.statusCode == 200 || response.statusCode == 201) &&
        data != null) {
      final vinculo = data['vinculo'] as Map<String, dynamic>? ?? const {};
      return LawyerStudyAssignment.fromJson(vinculo);
    }

    final message =
        data != null && data['message'] is String
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
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200) {
      return;
    }

    final message =
        data != null && data['message'] is String
            ? data['message'] as String
            : 'No se pudo eliminar el estudio vinculado';
    throw Exception(message);
  }

  static Future<List<LawFirmSummary>> searchLawFirms({
    required String token,
    required String query,
  }) async {
    final uri = Uri.parse(
      '$_baseUrl/estudios?search=${Uri.encodeQueryComponent(query)}',
    );
    final response = await http.get(uri, headers: _authHeaders(token));
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);

    if (response.statusCode == 401) {
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200 && decoded is List) {
      final list = _asJsonMapList(decoded);
      return list.map(LawFirmSummary.fromJson).toList();
    }

    final message =
        data != null && data['message'] is String
            ? data['message'] as String
            : 'No se pudieron buscar estudios';
    throw Exception(message);
  }


static Future<LawFirmSummary> lookupLawFirmByRuc({
    required String token,
    required String ruc,
  }) async {
    final uri = Uri.parse('$_baseUrl/estudios/consulta-ruc');
    final response = await http.post(
      uri,
      headers: _authHeaders(token, json: true),
      body: jsonEncode({'ruc': ruc}),
    );
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);

    if (response.statusCode == 401) {
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200 && data != null && data['success'] == true) {
      final estudioJson = data['data'] as Map<String, dynamic>? ?? const {};
      return LawFirmSummary.fromJson(estudioJson);
    }

    final message =
        data != null && data['message'] is String
            ? data['message'] as String
            : 'No se pudo consultar el RUC del estudio';
    throw Exception(message);
  }
  
  static Future<LawFirmSummary> createLawFirm({
    required String token,
    String? ruc,
    String? nombreComercial,
    String? correoContacto,
    String? telefono,
    required String direccionId,
    String? lineaExactaDireccion,
  }) async {
    final uri = Uri.parse('$_baseUrl/estudios');
    final resolvedDireccionId = direccionId.trim();
    if (resolvedDireccionId.isEmpty) {
      throw Exception('El distrito del estudio es obligatorio.');
    }
    final payload = {
      'ruc': ruc,
      'nombre_comercial': nombreComercial,
      'correo_contacto': correoContacto,
      'telefono': telefono,
      'direccion_id': resolvedDireccionId,
      'linea_exacta_direccion': lineaExactaDireccion,
    }..removeWhere(
      (key, value) =>
          value == null || (value is String && value.trim().isEmpty),
    );
    final response = await http.post(
      uri,
      headers: _authHeaders(token, json: true),
      body: jsonEncode(payload),
    );
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);

    if (response.statusCode == 401) {
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if ((response.statusCode == 200 || response.statusCode == 201) &&
        data != null) {
      return LawFirmSummary.fromJson(data);
    }

    final message =
        data != null && data['message'] is String
            ? data['message'] as String
            : 'No se pudo registrar el estudio';
    throw Exception(message);
  }

  static Future<LawyerPublicProfile> fetchLawyerPublicProfile({
    String? token,
    required int lawyerId,
  }) async {
    final uri = Uri.parse('$_baseUrl/lawyers/public/$lawyerId');
    final headers = token != null ? _authHeaders(token) : <String, String>{};
    final response = await http.get(uri, headers: headers);
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);

    if (response.statusCode == 401) {
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200 && data != null) {
      return LawyerPublicProfile.fromJson(data);
    }

    if (response.statusCode == 404) {
      throw Exception('Abogado no encontrado');
    }

    final message =
        data != null && data['message'] is String
            ? data['message'] as String
            : 'No se pudo obtener la información del abogado';
    throw Exception(message);
  }

  static Future<LawyerAvailabilityCalendarData>
  fetchLawyerAvailabilityCalendar({
    String? token,
    required int lawyerId,
    DateTime? from,
    DateTime? to,
  }) async {
    final queryParameters = <String, String>{};
    if (from != null) {
      queryParameters['from'] = from.toUtc().toIso8601String();
    }
    if (to != null) {
      queryParameters['to'] = to.toUtc().toIso8601String();
    }

    Uri uri = Uri.parse('$_baseUrl/lawyers/public/$lawyerId/availability');
    if (queryParameters.isNotEmpty) {
      uri = uri.replace(queryParameters: queryParameters);
    }

    final headers = token != null ? _authHeaders(token) : <String, String>{};
    final response = await http.get(uri, headers: headers);
    final decoded = _tryDecodeJson(response.body);
    final data = _asJsonMap(decoded);

    if (response.statusCode == 401) {
      final message =
          data != null && data['message'] is String
              ? data['message'] as String
              : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      throw UnauthorizedException(message);
    }

    if (response.statusCode == 200 && data != null) {
      return LawyerAvailabilityCalendarData.fromJson(data);
    }

    if (response.statusCode == 404) {
      throw Exception('Abogado no encontrado');
    }

    final message =
        data != null && data['message'] is String
            ? data['message'] as String
            : 'No se pudo obtener la disponibilidad pública';
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
