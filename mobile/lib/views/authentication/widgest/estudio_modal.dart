
import 'package:flutter/material.dart';

class EstudioModal extends StatefulWidget {
  final Map<String, dynamic>? inicial;

  const EstudioModal({super.key, this.inicial});

  @override
  State<EstudioModal> createState() => _EstudioModalState();
}

class _EstudioModalState extends State<EstudioModal> {
  late TextEditingController _nombreController;
  late TextEditingController _rucController;

  @override
  void initState() {
    super.initState();
    _nombreController = TextEditingController(
      text: widget.inicial?['nombre_comercial']?.toString() ?? '',
    );
    _rucController = TextEditingController(
      text: widget.inicial?['ruc']?.toString() ?? '',
    );
  }

  @override
  void dispose() {
    _nombreController.dispose();
    _rucController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        TextField(
          controller: _nombreController,
          decoration: const InputDecoration(labelText: 'Nombre comercial'),
        ),
        TextField(
          controller: _rucController,
          decoration: const InputDecoration(labelText: 'RUC'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(context, {
            'nombre_comercial': _nombreController.text,
            'ruc': _rucController.text,
          }),
          child: const Text('Guardar'),
        )
      ],
    );
  }
}