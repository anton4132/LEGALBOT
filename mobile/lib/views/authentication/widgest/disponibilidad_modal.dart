+36
-0

import 'package:flutter/material.dart';

class DisponibilidadModal extends StatefulWidget {
  final List<Map<String, dynamic>> inicial;

  const DisponibilidadModal({super.key, required this.inicial});

  @override
  State<DisponibilidadModal> createState() => _DisponibilidadModalState();
}

class _DisponibilidadModalState extends State<DisponibilidadModal> {
  late List<Map<String, dynamic>> _slots;

  @override
  void initState() {
    super.initState();
    _slots = List<Map<String, dynamic>>.from(widget.inicial);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text('Configurar Disponibilidad'),
        ..._slots.map((s) => Text(
            '${s['dia_semana'] ?? ''} ${s['hora_inicio'] ?? ''}-${s['hora_fin'] ?? ''}')),
        TextButton(
          onPressed: () => Navigator.pop(context, _slots),
          child: const Text('Guardar'),
        )
      ],
    );
  }
}