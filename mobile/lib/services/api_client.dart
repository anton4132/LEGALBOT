import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiClient {
  static const String _baseUrl = 'http://localhost:3000/api';

  static Future<void> signup(Map<String, dynamic> payload) async {
    final uri = Uri.parse('$_baseUrl/registro');
    await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );
  }
}