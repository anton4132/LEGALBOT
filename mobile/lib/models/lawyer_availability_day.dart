
import 'package:flutter/material.dart';
class LawyerAvailabilityBlock {
  final DateTime start;
  final DateTime end;

  LawyerAvailabilityBlock({
    required this.start,
    required this.end,
  }) : assert(!end.isBefore(start), 'El bloque debe terminar después de iniciar');

  TimeOfDay get startTime => TimeOfDay(hour: start.hour, minute: start.minute);

  TimeOfDay get endTime => TimeOfDay(hour: end.hour, minute: end.minute);

  Duration get duration => end.difference(start);

  bool overlaps(DateTime otherStart, DateTime otherEnd) {
    return start.isBefore(otherEnd) && end.isAfter(otherStart);
  }
}

class LawyerAvailabilityDay {
  final DateTime date;
  final List<LawyerAvailabilityBlock> freeBlocks;
  final List<LawyerAvailabilityBlock> busyBlocks;

  LawyerAvailabilityDay({
    required this.date,
    this.freeBlocks = const [],
    this.busyBlocks = const [],
  });

  bool get hasFreeBlocks => freeBlocks.isNotEmpty;
}

class LawyerAvailabilitySelection {
  final DateTime date;
  final LawyerAvailabilityBlock block;

  LawyerAvailabilitySelection({
    required this.date,
    required this.block,
  });
}