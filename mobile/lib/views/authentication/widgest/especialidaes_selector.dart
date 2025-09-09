import 'dart:convert';
import 'package:flutter/material.dart';
import '../../../../services/api_client.dart';

class EspecialidadesSelector extends StatefulWidget {
  final List<int> inicial; // ids preseleccionados
  const EspecialidadesSelector({super.key, this.inicial = const []});

  @override
  State<EspecialidadesSelector> createState() => _EspecialidadesSelectorState();
}

class _EspecialidadesSelectorState extends State<EspecialidadesSelector> {
  late Future<List<Map<String, dynamic>>> _future;
  final Set<int> _seleccion = {};

  @override
  void initState() {
    super.initState();
    _seleccion.addAll(widget.inicial);
    _future = ApiClient.listarEspecialidades();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: Padding(
            padding: EdgeInsets.all(24), child: CircularProgressIndicator()));
        }
        if (snap.hasError) {
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Text('Error cargando especialidades: ${snap.error}'),
          );
        }
        final data = snap.data ?? [];
        if (data.isEmpty) {
          return const Padding(
            padding: EdgeInsets.all(16),
            child: Text('No hay especialidades disponibles'),
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8, runSpacing: 8,
              children: data.map((e) {
                final id = (e['id'] as num).toInt();
                final nombre = e['nombre']?.toString() ?? '—';
                final selected = _seleccion.contains(id);
                return FilterChip(
                  label: Text(nombre),
                  selected: selected,
                  onSelected: (v) {
                    setState(() {
                      if (v) { _seleccion.add(id); } else { _seleccion.remove(id); }
                    });
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
            Align(
              alignment: Alignment.centerRight,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context, _seleccion.toList()),
                child: const Text('Aceptar'),
              ),
            )
          ],
        );
      },
    );
  }
}
