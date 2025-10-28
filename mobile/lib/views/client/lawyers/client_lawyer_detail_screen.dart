import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../constants/colors.dart';
import '../../../models/lawyer_availability_day.dart';
import '../../../models/lawyer_profile_models.dart';
import '../../../models/lawyer_search_result.dart';
import '../../../services/api_client.dart';
import '../../../services/session_service.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../authentication/login_screen.dart';
import '../home/client_home.dart';
import '../home/client_settings_screen.dart';
import '../widgets/client_navigation_drawer.dart';
import 'client_lawyer_availability_calendar.dart';

class ClientLawyerDetailScreen extends StatefulWidget {
  final int lawyerId;
  final LawyerSearchResult? initialResult;

  const ClientLawyerDetailScreen({
    super.key,
    required this.lawyerId,
    this.initialResult,
  });

  @override
  State<ClientLawyerDetailScreen> createState() =>
      _ClientLawyerDetailScreenState();
}

class _ClientLawyerDetailScreenState extends State<ClientLawyerDetailScreen> {
  LawyerSearchResult? _basicInfo;
  LawyerPublicProfile? _profile;
  List<LawyerAvailabilityDay> _availabilityDays = const [];
  LawyerAvailabilitySelection? _selectedSlot;
  bool _loadingProfile = true;
  bool _loadingAvailability = true;
  bool _bookingInProgress = false;
  String? _profileError;
  String? _availabilityError;
  final NumberFormat _currencyFormatter =
      NumberFormat.currency(symbol: 'S/', locale: 'es_PE');

  @override
  void initState() {
    super.initState();
    _basicInfo = widget.initialResult;
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() {
      _loadingProfile = true;
      _profileError = null;
    });
    final token = SessionService.instance.session?.token;
    try {
      final profile = await ApiClient.fetchLawyerPublicProfile(
        token: token,
        lawyerId: widget.lawyerId,
      );
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _loadingProfile = false;
      });
      await _loadAvailability();
    } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingProfile = false;
        _profileError = 'No se pudo cargar la información del abogado.';
      });
      _showSnackBar('Error obteniendo perfil: ${error.toString()}');
    }
  }

  Future<void> _loadAvailability() async {
    setState(() {
      _loadingAvailability = true;
      _availabilityError = null;
    });
    final token = SessionService.instance.session?.token;
    try {
      final calendar = await ApiClient.fetchLawyerAvailabilityCalendar(
        token: token,
        lawyerId: widget.lawyerId,
      );
      if (!mounted) return;
      final days = _buildAvailabilityDays(calendar);
      setState(() {
        _availabilityDays = days;
        _selectedSlot = null;
        _loadingAvailability = false;
      });
    } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingAvailability = false;
        _availabilityError = 'No se pudo obtener la disponibilidad.';
      });
      _showSnackBar('Error obteniendo disponibilidad: ${error.toString()}');
    }
  }

  List<LawyerAvailabilityDay> _buildAvailabilityDays(
    LawyerAvailabilityCalendarData calendar,
  ) {
    final from = calendar.rangeStart ?? DateTime.now();
    final to = calendar.rangeEnd ?? from.add(const Duration(days: 30));
    final normalizedFrom = DateUtils.dateOnly(from);
    final normalizedTo = DateUtils.dateOnly(to);

    final slotsByDay = <int, List<LawyerAvailabilitySlot>>{};
    for (final slot in calendar.weeklySlots) {
      slotsByDay.putIfAbsent(slot.diaSemana, () => []).add(slot);
    }

    final bookings = calendar.bookings;
    final days = <LawyerAvailabilityDay>[];
    DateTime current = normalizedFrom;
    while (!current.isAfter(normalizedTo)) {
      final weekdaySlots = slotsByDay[current.weekday] ?? const [];
      final freeBlocks = <LawyerAvailabilityBlock>[];
      final busyBlocks = <LawyerAvailabilityBlock>[];

      for (final slot in weekdaySlots) {
        final start = slot.horaInicio;
        final end = slot.horaFin;
        if (start == null || end == null) continue;
        final startDate = DateTime(
          current.year,
          current.month,
          current.day,
          start.hour,
          start.minute,
        );
        final endDate = DateTime(
          current.year,
          current.month,
          current.day,
          end.hour,
          end.minute,
        );
        final block = LawyerAvailabilityBlock(start: startDate, end: endDate);
        final hasOverlap = bookings.any(
          (booking) => booking.overlaps(startDate, endDate),
        );
        if (hasOverlap) {
          busyBlocks.add(block);
        } else {
          freeBlocks.add(block);
        }
      }

      if (freeBlocks.isNotEmpty || busyBlocks.isNotEmpty) {
        days.add(
          LawyerAvailabilityDay(
            date: current,
            freeBlocks: freeBlocks,
            busyBlocks: busyBlocks,
          ),
        );
      }

      current = current.add(const Duration(days: 1));
    }

    return days;
  }

  void _handleUnauthorized(String? message) {
    SessionService.instance.clear();
    if (!mounted) return;
    final resolvedMessage =
        (message ?? 'Tu sesión ha expirado. Inicia sesión nuevamente.').trim();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(resolvedMessage),
        backgroundColor: AppColors.text3Color,
      ),
    );
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  void _showSnackBar(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.buttonColor,
      ),
    );
  }

  Future<void> _handleBookAppointment() async {
    if (_selectedSlot == null) return;
    setState(() => _bookingInProgress = true);
    final slot = _selectedSlot!;
    final formattedTime =
        '${DateFormat('EEEE d MMMM', 'es_PE').format(slot.date)}\n${DateFormat.Hm('es_PE').format(slot.block.start)} - ${DateFormat.Hm('es_PE').format(slot.block.end)}';

    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirmar cita'),
        content: Text(
          '¿Deseas agendar una cita para:\n$formattedTime?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      _showSnackBar('Se ha reservado el horario seleccionado.');
    }

    if (mounted) {
      setState(() => _bookingInProgress = false);
    }
  }

  ImageProvider<Object>? _avatarProvider() {
    if (_profile?.perfil?.avatarArchivo?.resolvedUrl != null) {
      return CachedNetworkImageProvider(
        _profile!.perfil!.avatarArchivo!.resolvedUrl!,
      );
    }
    return _basicInfo?.avatarImageProvider;
  }

  double? get _tarifaBase {
    if (_profile?.perfil?.tarifaBase != null) {
      return _profile!.perfil!.tarifaBase;
    }
    return _basicInfo?.tarifaBase;
  }

  String get _displayName {
    return _profile?.nombreCompleto?.trim().isNotEmpty == true
        ? _profile!.nombreCompleto!.trim()
        : (_basicInfo?.nombreCompleto ?? 'Abogado');
  }

  String get _ratingLabel {
    if (_profile?.perfil != null) {
      return _profile!.perfil!.ratingSummary();
    }
    return _basicInfo?.ratingLabel ?? 'Sin reseñas';
  }

  String _resolveInitials() {
    final source = _profile?.nombreCompleto?.trim().isNotEmpty == true
        ? _profile!.nombreCompleto!.trim()
        : (_basicInfo?.nombreCompleto ?? 'AB');
    final parts = source
        .split(' ')
        .where((part) => part.trim().isNotEmpty)
        .map((part) => part.trim())
        .toList();
    if (parts.isEmpty) {
      return source.substring(0, 1).toUpperCase();
    }
    String leading(String value) =>
        value.isEmpty ? '' : value.substring(0, 1).toUpperCase();
    final first = leading(parts.first);
    final second = parts.length > 1 ? leading(parts[1]) : '';
    final combined = '$first$second'.trim();
    return combined.isEmpty ? first : combined;
  }

  @override
  Widget build(BuildContext context) {
    final avatar = _avatarProvider();
    final tarifa = _tarifaBase;
    final tarifaLabel =
        tarifa != null && tarifa > 0 ? _currencyFormatter.format(tarifa) : 'No especificada';

    return Scaffold(
      appBar: CustomAppBar(
        title: _displayName,
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
      ),
      drawer: ClientNavigationDrawer(
        activeDestination: ClientDrawerDestination.search,
        onSelectDashboard: _navigateToClientHome,
        onSelectSearch: () {},
        onSelectSettingsSubsection: _openSettingsFromDrawer,
        onLogout: _handleLogoutFromDrawer,
      ),
      body: SafeArea(
        child: _loadingProfile
            ? const Center(
                child: CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(
                    AppColors.button2Color,
                  ),
                ),
              )
            : _profileError != null
                ? Center(
                    child: Container(
                      padding: const EdgeInsets.all(20),
                      margin: const EdgeInsets.symmetric(horizontal: 24),
                      decoration: BoxDecoration(
                        color: AppColors.text3Color.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.text3Color),
                      ),
                      child: Text(
                        _profileError!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: AppColors.text3Color,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: _loadProfile,
                    child: SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              CircleAvatar(
                                radius: 36,
                                backgroundImage: avatar,
                                backgroundColor:
                                    AppColors.buttonColor.withOpacity(0.1),
                                child: avatar == null
                                    ? Text(
                                        _resolveInitials(),
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.buttonColor,
                                        ),
                                      )
                                    : null,
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _displayName,
                                      style: const TextStyle(
                                        fontSize: 20,
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.text1Color,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        const Icon(
                                          Icons.star,
                                          color: Colors.amber,
                                          size: 20,
                                        ),
                                        const SizedBox(width: 4),
                                        Text(
                                          _ratingLabel,
                                          style: const TextStyle(
                                            fontSize: 14,
                                            color: AppColors.text2Color,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Tarifa base: $tarifaLabel',
                                      style: const TextStyle(
                                        fontSize: 14,
                                        color: AppColors.text2Color,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          if (_profile?.perfil?.bio?.isNotEmpty == true)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: Text(
                                _profile!.perfil!.bio!,
                                style: const TextStyle(
                                  fontSize: 14,
                                  height: 1.4,
                                  color: AppColors.text1Color,
                                ),
                              ),
                            ),
                          _buildSectionTitle('Dirección de atención'),
                          Text(
                            _profile?.perfil?.direccionAtencion?.trim().isNotEmpty == true
                                ? _profile!.perfil!.direccionAtencion!
                                : 'No especificada',
                            style: const TextStyle(
                              fontSize: 14,
                              color: AppColors.text2Color,
                            ),
                          ),
                          const SizedBox(height: 16),
                          _buildSectionTitle('Especialidades'),
                          _buildSpecialties(),
                          const SizedBox(height: 16),
                          _buildSectionTitle('Estudios asociados'),
                          _buildStudies(),
                          const SizedBox(height: 24),
                          _buildSectionTitle('Disponibilidad'),
                          if (_loadingAvailability)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 24),
                              child: Center(
                                child: CircularProgressIndicator(
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    AppColors.button2Color,
                                  ),
                                ),
                              ),
                            )
                          else if (_availabilityError != null)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              child: Text(
                                _availabilityError!,
                                style: const TextStyle(
                                  color: AppColors.text3Color,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            )
                          else if (_availabilityDays.isEmpty)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 16),
                              child: Text(
                                'Este abogado no tiene horarios disponibles en las próximas semanas.',
                                style: TextStyle(
                                  color: AppColors.text2Color,
                                ),
                              ),
                            )
                          else
                            ClientLawyerAvailabilityCalendar(
                              days: _availabilityDays,
                              selected: _selectedSlot,
                              onSelectionChanged: (selection) {
                                setState(() {
                                  _selectedSlot = selection;
                                });
                              },
                            ),
                          const SizedBox(height: 24),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: _selectedSlot == null || _bookingInProgress
                                  ? null
                                  : _handleBookAppointment,
                              icon: const Icon(Icons.event_available),
                              label: Text(
                                _bookingInProgress
                                    ? 'Procesando...'
                                    : 'Agendar una cita',
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
      ),
    );
  }

  Future<void> _navigateToClientHome() async {
    if (!mounted) return;
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const ClientHome()),
    );
  }

  void _openSettingsFromDrawer(ClientSettingsSubsection subsection) {
    if (!mounted) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ClientHome(
          showSettings: true,
          initialSettingsSubsection: subsection,
        ),
      ),
    );
  }

  Future<void> _handleLogoutFromDrawer() async {
    final shouldLogout = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cerrar sesión'),
        content: const Text('¿Estás seguro de que deseas cerrar sesión?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.buttonColor,
              foregroundColor: AppColors.buttonTextColor,
            ),
            child: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );

    if (shouldLogout != true || !mounted) return;

    SessionService.instance.clear();
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: AppColors.text1Color,
        ),
      ),
    );
  }

  Widget _buildSpecialties() {
    final specialties = _profile?.specialtyNames ?? const [];
    if (specialties.isEmpty) {
      return const Text(
        'No se registraron especialidades.',
        style: TextStyle(color: AppColors.text2Color),
      );
    }
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: specialties
          .map(
            (name) => Chip(
              label: Text(
                name,
                style: const TextStyle(color: AppColors.text1Color),
              ),
              backgroundColor: AppColors.button2Color.withOpacity(0.12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          )
          .toList(),
    );
  }

  Widget _buildStudies() {
    final studies = _profile?.estudios ?? const [];
    if (studies.isEmpty) {
      return const Text('No hay estudios asociados activos.');
    }
    return Column(
      children: studies
          .map(
            (study) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(
                study.principal ? Icons.star : Icons.business,
                color: study.principal
                    ? AppColors.buttonColor
                    : AppColors.text2Color,
              ),
              title: Text(
                study.estudio?.nombreComercial?.isNotEmpty == true
                    ? study.estudio!.nombreComercial!
                    : 'Estudio sin nombre',
                style: const TextStyle(color: AppColors.text1Color),
              ),
              subtitle: Text(
                [
                  if (study.estudio?.formattedLocation?.isNotEmpty == true)
                    study.estudio!.formattedLocation!,
                ].join(', '),
                style: const TextStyle(color: AppColors.text2Color),
              ),
              trailing: study.principal
                  ? const Text(
                      'Principal',
                      style: TextStyle(
                        color: AppColors.buttonColor,
                        fontWeight: FontWeight.w600,
                      ),
                    )
                  : null,
            ),
          )
          .toList(),
    );
  }
}