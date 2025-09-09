import 'package:flutter/material.dart';

class EstudioModal extends StatefulWidget {
  final Map<String, dynamic>? inicial;
  const EstudioModal({super.key, this.inicial});

  @override
  State<EstudioModal> createState() => _EstudioModalState();
}

class _EstudioModalState extends State<EstudioModal> {
  final _formKey = GlobalKey<FormState>();
  final _ruc = TextEditingController();
  final _nombre = TextEditingController();
  final _pais = TextEditingController(text: 'Perú');
  final _ciudad = TextEditingController(text: 'Tacna');
  final _correo = TextEditingController();
  final _telefono = TextEditingController();
  final _direccion = TextEditingController();
  final _rol = TextEditingController(text: 'asociado');
  bool _principal = true;

  @override
  void initState() {
    super.initState();
    final v = widget.inicial;
    if (v != null) {
      _ruc.text = v['ruc'] ?? '';
      _nombre.text = v['nombre_comercial'] ?? '';
      _pais.text = v['pais'] ?? 'Perú';
      _ciudad.text = v['ciudad'] ?? '';
      _correo.text = v['correo_contacto'] ?? '';
      _telefono.text = v['telefono'] ?? '';
      _direccion.text = v['direccion'] ?? '';
      _rol.text = v['rol_en_estudio'] ?? 'asociado';
      _principal = v['principal'] == true;
    }
  }

  @override
  void dispose() {
    _ruc.dispose(); _nombre.dispose(); _pais.dispose(); _ciudad.dispose();
    _correo.dispose(); _telefono.dispose(); _direccion.dispose(); _rol.dispose();
    super.dispose();
  }

  void _guardar() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.pop(context, {
      'ruc': _ruc.text.trim(),
      'nombre_comercial': _nombre.text.trim(),
      'pais': _pais.text.trim(),
      'ciudad': _ciudad.text.trim(),
      'correo_contacto': _correo.text.trim(),
      'telefono': _telefono.text.trim(),
      'direccion': _direccion.text.trim(),
      'rol_en_estudio': _rol.text.trim(),
      'principal': _principal,
    });
  }

  String? _req(String? v) => (v == null || v.trim().isEmpty) ? 'Requerido' : null;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 16, right: 16, top: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        ),
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Datos del Estudio/Despacho', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                TextFormField(controller: _ruc, decoration: const InputDecoration(labelText: 'RUC'), validator: _req),
                TextFormField(controller: _nombre, decoration: const InputDecoration(labelText: 'Nombre comercial'), validator: _req),
                Row(
                  children: [
                    Expanded(child: TextFormField(controller: _pais, decoration: const InputDecoration(labelText: 'País'), validator: _req)),
                    const SizedBox(width: 8),
                    Expanded(child: TextFormField(controller: _ciudad, decoration: const InputDecoration(labelText: 'Ciudad'), validator: _req)),
                  ],
                ),
                Row(
                  children: [
                    Expanded(child: TextFormField(controller: _correo, decoration: const InputDecoration(labelText: 'Correo de contacto'))),
                    const SizedBox(width: 8),
                    Expanded(child: TextFormField(controller: _telefono, decoration: const InputDecoration(labelText: 'Teléfono de contacto'))),
                  ],
                ),
                TextFormField(controller: _direccion, decoration: const InputDecoration(labelText: 'Dirección'), validator: _req),
                Row(
                  children: [
                    Expanded(child: TextFormField(controller: _rol, decoration: const InputDecoration(labelText: 'Rol en el estudio (titular/asociado/…)'), validator: _req)),
                    const SizedBox(width: 8),
                    Checkbox(value: _principal, onChanged: (v) => setState(()=> _principal = v ?? true)),
                    const Text('Principal'),
                  ],
                ),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerRight,
                  child: ElevatedButton(onPressed: _guardar, child: const Text('Guardar')),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
