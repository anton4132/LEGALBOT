import 'package:flutter/material.dart';

class Disponibilidad {
  final int diaSemana; // 1=Lun ... 7=Dom
  final TimeOfDay inicio;
  final TimeOfDay fin;
  Disponibilidad({required this.diaSemana, required this.inicio, required this.fin});

  Map<String, dynamic> toJson() => {
    'dia_semana': diaSemana,
    'hora_inicio': _fmtTime(inicio),
    'hora_fin': _fmtTime(fin),
  };

  static String _fmtTime(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2,'0')}:${t.minute.toString().padLeft(2,'0')}:00';
}

class DisponibilidadModal extends StatefulWidget {
  final List<Disponibilidad> inicial;
  const DisponibilidadModal({super.key, this.inicial = const []});

  @override
  State<DisponibilidadModal> createState() => _DisponibilidadModalState();
}

class _DisponibilidadModalState extends State<DisponibilidadModal> {
  final List<Disponibilidad> _items = [];
  int _dia = 1;
  TimeOfDay _inicio = const TimeOfDay(hour: 9, minute: 0);
  TimeOfDay _fin = const TimeOfDay(hour: 10, minute: 0);

  @override
  void initState() {
    super.initState();
    _items.addAll(widget.inicial);
  }

  Future<void> _pickTime(bool isInicio) async {
    final base = isInicio ? _inicio : _fin;
    final picked = await showTimePicker(context: context, initialTime: base);
    if (picked != null) {
      setState(() {
        if (isInicio) { _inicio = picked; }
        else { _fin = picked; }
      });
    }
  }

  bool _haySolape(Disponibilidad nuevo) {
    for (final d in _items.where((e) => e.diaSemana == nuevo.diaSemana)) {
      final aIni = d.inicio.hour * 60 + d.inicio.minute;
      final aFin = d.fin.hour * 60 + d.fin.minute;
      final bIni = nuevo.inicio.hour * 60 + nuevo.inicio.minute;
      final bFin = nuevo.fin.hour * 60 + nuevo.fin.minute;
      final overlap = aIni < bFin && bIni < aFin;
      if (overlap) return true;
    }
    return false;
  }

  void _agregar() {
    if (_inicio.hour * 60 + _inicio.minute >= _fin.hour * 60 + _fin.minute) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Hora fin debe ser > inicio'), backgroundColor: Colors.red));
      return;
    }
    final nuevo = Disponibilidad(diaSemana: _dia, inicio: _inicio, fin: _fin);
    if (_haySolape(nuevo)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Rango se solapa con otro del mismo día'), backgroundColor: Colors.red));
      return;
    }
    setState(() => _items.add(nuevo));
  }

  void _eliminar(int idx) => setState(() => _items.removeAt(idx));

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Disponibilidad', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<int>(
                    value: _dia,
                    decoration: const InputDecoration(labelText: 'Día'),
                    items: const [
                      DropdownMenuItem(value: 1, child: Text('Lunes')),
                      DropdownMenuItem(value: 2, child: Text('Martes')),
                      DropdownMenuItem(value: 3, child: Text('Miércoles')),
                      DropdownMenuItem(value: 4, child: Text('Jueves')),
                      DropdownMenuItem(value: 5, child: Text('Viernes')),
                      DropdownMenuItem(value: 6, child: Text('Sábado')),
                      DropdownMenuItem(value: 7, child: Text('Domingo')),
                    ],
                    onChanged: (v) => setState(() => _dia = v ?? 1),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: InkWell(
                    onTap: () => _pickTime(true),
                    child: InputDecorator(
                      decoration: const InputDecoration(labelText: 'Inicio'),
                      child: Text('${_inicio.format(context)}'),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: InkWell(
                    onTap: () => _pickTime(false),
                    child: InputDecorator(
                      decoration: const InputDecoration(labelText: 'Fin'),
                      child: Text('${_fin.format(context)}'),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(onPressed: _agregar, child: const Text('Agregar')),
              ],
            ),
            const SizedBox(height: 12),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                itemBuilder: (_, i) {
                  final d = _items[i];
                  final dias = ['','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
                  return ListTile(
                    leading: CircleAvatar(child: Text(d.diaSemana.toString())),
                    title: Text('${dias[d.diaSemana]}  ${d.inicio.format(context)} - ${d.fin.format(context)}'),
                    trailing: IconButton(icon: const Icon(Icons.delete), onPressed: () => _eliminar(i)),
                  );
                },
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemCount: _items.length,
              ),
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context, _items.map((e) => e.toJson()).toList()),
                child: const Text('Guardar'),
              ),
            )
          ],
        ),
      ),
    );
  }
}
