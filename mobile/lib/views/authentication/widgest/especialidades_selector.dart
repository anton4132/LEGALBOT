import 'package:flutter/material.dart';

class EspecialidadesSelector extends StatefulWidget {
  final List<int> inicial;

  const EspecialidadesSelector({super.key, required this.inicial});

  @override
  State<EspecialidadesSelector> createState() => _EspecialidadesSelectorState();
}

class _EspecialidadesSelectorState extends State<EspecialidadesSelector> {
  late List<int> _seleccion;

  @override
  void initState() {
    super.initState();
    _seleccion = List<int>.from(widget.inicial);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text('Seleccionar Especialidades'),
        Wrap(
          spacing: 8,
          children: _seleccion
              .map((id) => Chip(label: Text('ID $id')))
              .toList(),
        ),
        TextButton(
          onPressed: () => Navigator.pop(context, _seleccion),
          child: const Text('Guardar'),
        )
      ],
    );
  }
}
