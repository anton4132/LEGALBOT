class DniLookupResult {
  final String numero;
  final String primerNombre;
  final String segundoNombre;
  final String apellidoPaterno;
  final String apellidoMaterno;

  const DniLookupResult({
    required this.numero,
    required this.primerNombre,
    required this.segundoNombre,
    required this.apellidoPaterno,
    required this.apellidoMaterno,
  });

  factory DniLookupResult.fromJson(Map<String, dynamic> json) {
    String readAsString(String key) {
      final value = json[key];
      return value is String ? value : (value?.toString() ?? '');
    }

    return DniLookupResult(
      numero: readAsString('numero'),
      primerNombre: readAsString('primer_nombre'),
      segundoNombre: readAsString('segundo_nombre'),
      apellidoPaterno: readAsString('apellido_paterno'),
      apellidoMaterno: readAsString('apellido_materno'),
    );
  }
}