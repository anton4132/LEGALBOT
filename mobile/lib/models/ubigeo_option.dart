class UbigeoOption {
  final String codigo;
  final String nombre;

  const UbigeoOption({
    required this.codigo,
    required this.nombre,
  });

  static String? _asString(dynamic value) {
    if (value == null) return null;
    if (value is String) return value.trim().isEmpty ? null : value.trim();
    if (value is num) return value.toString();
    return null;
  }

  static UbigeoOption? tryParse(Map<String, dynamic> json) {
    final codigo = _asString(json['codigo'] ??
        json['ubigeo_codigo'] ??
        json['ubigeoCodigo'] ??
        json['id'] ??
        json['value']);
    final nombre = _asString(json['nombre'] ??
        json['descripcion'] ??
        json['label'] ??
        json['text'] ??
        json['departamento'] ??
        json['provincia'] ??
        json['distrito']);
    if (codigo == null || nombre == null) {
      return null;
    }
    return UbigeoOption(codigo: codigo, nombre: nombre);
  }

  static List<UbigeoOption> listFromJson(List<Map<String, dynamic>> rows) {
    return rows.map(tryParse).whereType<UbigeoOption>().toList();
  }
}