import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';

import '../../../models/lawyer_availability_day.dart';

class ClientLawyerAvailabilityCalendar extends StatefulWidget {
  final List<LawyerAvailabilityDay> days;
  final LawyerAvailabilitySelection? selected;
  final ValueChanged<LawyerAvailabilitySelection?> onSelectionChanged;

  const ClientLawyerAvailabilityCalendar({
    super.key,
    required this.days,
    required this.selected,
    required this.onSelectionChanged,
  });

  @override
  State<ClientLawyerAvailabilityCalendar> createState() =>
      _ClientLawyerAvailabilityCalendarState();
}

class _ClientLawyerAvailabilityCalendarState
    extends State<ClientLawyerAvailabilityCalendar> {
  late DateTime _focusedDay;
  DateTime? _selectedDay;

  Map<DateTime, LawyerAvailabilityDay> get _daysIndex {
    return {
      for (final day in widget.days)
        DateUtils.dateOnly(day.date): day,
    };
  }

  @override
  void initState() {
    super.initState();
    _initializeCalendar();
  }

  @override
  void didUpdateWidget(ClientLawyerAvailabilityCalendar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.days != widget.days) {
      _initializeCalendar(keepSelection: true);
    }
    if (widget.selected != null) {
      final selectedDateOnly = DateUtils.dateOnly(widget.selected!.date);
      if (_selectedDay == null || _selectedDay != selectedDateOnly) {
        setState(() {
          _selectedDay = selectedDateOnly;
          _focusedDay = selectedDateOnly;
        });
      }
    }
  }

  void _initializeCalendar({bool keepSelection = false}) {
    if (widget.days.isEmpty) {
      _focusedDay = DateTime.now();
      _selectedDay = null;
      return;
    }

    final initialDay = widget.days.firstWhere(
      (day) => day.hasFreeBlocks,
      orElse: () => widget.days.first,
    );

    _focusedDay = initialDay.date;
    if (!keepSelection || _selectedDay == null) {
      _selectedDay = initialDay.date;
    }
  }

  List<_CalendarSlot> _slotsForDay(DateTime day) {
    final dayData = _daysIndex[DateUtils.dateOnly(day)];
    if (dayData == null) return const [];
    final items = <_CalendarSlot>[
      ...dayData.freeBlocks
          .map((block) => _CalendarSlot(block: block, isFree: true)),
      ...dayData.busyBlocks
          .map((block) => _CalendarSlot(block: block, isFree: false)),
    ];
    items.sort((a, b) => a.block.start.compareTo(b.block.start));
    return items;
  }

  @override
  Widget build(BuildContext context) {
    final firstDay = widget.days.isNotEmpty
        ? widget.days.first.date
        : DateTime.now();
    final lastDay = widget.days.isNotEmpty
        ? widget.days.last.date
        : DateTime.now().add(const Duration(days: 30));

    final selectedDay = _selectedDay;
    final selectedSlots = selectedDay != null ? _slotsForDay(selectedDay) : const [];

    return Column(
      children: [
        TableCalendar(
          firstDay: DateTime(firstDay.year, firstDay.month, firstDay.day),
          lastDay: DateTime(lastDay.year, lastDay.month, lastDay.day),
          focusedDay: _focusedDay,
          availableCalendarFormats: const {CalendarFormat.month: 'Mes'},
          selectedDayPredicate: (day) => selectedDay != null && isSameDay(selectedDay, day),
          onDaySelected: (selected, focused) {
            setState(() {
              _selectedDay = DateUtils.dateOnly(selected);
              _focusedDay = focused;
            });
            widget.onSelectionChanged(null);
          },
          enabledDayPredicate: (day) => _daysIndex.containsKey(DateUtils.dateOnly(day)),
          calendarStyle: const CalendarStyle(
            todayDecoration: BoxDecoration(
              color: Colors.deepPurpleAccent,
              shape: BoxShape.circle,
            ),
            selectedDecoration: BoxDecoration(
              color: Colors.purple,
              shape: BoxShape.circle,
            ),
            outsideDaysVisible: false,
          ),
        ),
        const SizedBox(height: 16),
        if (selectedSlots.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Text(
              'No hay horarios disponibles para este día.',
              style: TextStyle(fontSize: 14, color: Colors.black54),
            ),
          )
        else
          _buildSlotsGrid(context, selectedSlots),
      ],
    );
  }

  Widget _buildSlotsGrid(BuildContext context, List<_CalendarSlot> slots) {
    final selected = widget.selected;
    final localizations = MaterialLocalizations.of(context);

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(8),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 2.8,
      ),
      itemCount: slots.length,
      itemBuilder: (context, index) {
        final slot = slots[index];
        final isSelected = selected != null &&
            selected.block.start == slot.block.start &&
            selected.block.end == slot.block.end;
        final isDisabled = !slot.isFree;
        final borderColor = isSelected
            ? Colors.deepPurple
            : isDisabled
                ? Colors.grey.shade300
                : Colors.deepPurpleAccent;
        final backgroundColor = isSelected
            ? Colors.deepPurpleAccent
            : isDisabled
                ? Colors.grey.shade200
                : Colors.white;
        final textColor = isSelected
            ? Colors.white
            : isDisabled
                ? Colors.black45
                : Colors.black87;

        final label =
            '${localizations.formatTimeOfDay(slot.block.startTime, alwaysUse24HourFormat: true)} - '
            '${localizations.formatTimeOfDay(slot.block.endTime, alwaysUse24HourFormat: true)}';

        return GestureDetector(
          onTap: isDisabled
              ? null
              : () {
                  final selection = LawyerAvailabilitySelection(
                    date: DateUtils.dateOnly(slot.block.start),
                    block: slot.block,
                  );
                  widget.onSelectionChanged(selection);
                  setState(() {
                    _selectedDay = DateUtils.dateOnly(slot.block.start);
                  });
                },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            decoration: BoxDecoration(
              color: backgroundColor,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: borderColor, width: 1.5),
              boxShadow: [
                if (!isDisabled)
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 6,
                    offset: const Offset(0, 3),
                  ),
              ],
            ),
            alignment: Alignment.center,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  label,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: textColor,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  slot.isFree ? 'Disponible' : 'Ocupado',
                  style: TextStyle(
                    fontSize: 12,
                    color: slot.isFree ? Colors.green : Colors.redAccent,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _CalendarSlot {
  final LawyerAvailabilityBlock block;
  final bool isFree;

  const _CalendarSlot({
    required this.block,
    required this.isFree,
  });
}