import 'dart:io' as io;
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../../../constants/colors.dart';
import '../../../models/archivo_reference.dart';
import '../../../models/lawyer_profile_models.dart';
import '../../../models/user_session.dart';
import '../../../services/api_client.dart';
import '../../../services/blob_storage_service.dart';
import '../../../services/session_service.dart';
import '../../../widgets/shadow_card.dart';
import '../../authentication/login_screen.dart';

class LawyerProfileScreen extends StatefulWidget {
  const LawyerProfileScreen({super.key});

  @override
  State<LawyerProfileScreen> createState() => _LawyerProfileScreenState();
}

class _LawyerProfileScreenState extends State<LawyerProfileScreen> {
  final TextEditingController _bioController = TextEditingController();
  final TextEditingController _durationController = TextEditingController();
  final TextEditingController _baseRateController = TextEditingController();
  final TextEditingController _addressController = TextEditingController();

  final TextEditingController _lawFirmRucController = TextEditingController();
  final TextEditingController _lawFirmNameController = TextEditingController();
  final TextEditingController _lawFirmCountryController = TextEditingController();
  final TextEditingController _lawFirmCityController = TextEditingController();
  final TextEditingController _lawFirmEmailController = TextEditingController();
  final TextEditingController _lawFirmPhoneController = TextEditingController();
  final TextEditingController _lawFirmAddressController = TextEditingController();
  final TextEditingController _lawFirmRoleController = TextEditingController();

  bool _loading = true;
  bool _savingProfile = false;
  bool _savingSpecialties = false;
  bool _addingAvailability = false;
  bool _savingLawFirm = false;
  static const int _maxAvatarFileSizeBytes = 5 * 1024 * 1024;
  LawyerProfileInfo? _profileInfo;
  List<LawyerSpecialty> _catalogSpecialties = const [];
  Set<int> _selectedSpecialties = <int>{};
  List<LawyerAvailabilitySlot> _availability = const [];
  List<LawyerStudyAssignment> _studies = const [];

  int _newSlotDay = 1;
  TimeOfDay? _newSlotStart;
  TimeOfDay? _newSlotEnd;

  LawFirmSummary? _selectedLawFirm;
  bool _lawFirmPrincipal = false;

  PlatformFile? _selectedAvatarFile;
  ArchivoReference? _existingAvatarArchivo;
  Uint8List? _avatarPreviewBytes;
  bool _retainExistingAvatar = false;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  @override
  void dispose() {
    _bioController.dispose();
    _durationController.dispose();
    _baseRateController.dispose();
    _addressController.dispose();
    _lawFirmRucController.dispose();
    _lawFirmNameController.dispose();
    _lawFirmCountryController.dispose();
    _lawFirmCityController.dispose();
    _lawFirmEmailController.dispose();
    _lawFirmPhoneController.dispose();
    _lawFirmAddressController.dispose();
    _lawFirmRoleController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    final session = SessionService.instance.session;
    if (session == null) {
      setState(() => _loading = false);
      return;
    }

    setState(() => _loading = true);
    try {
      final results = await Future.wait<dynamic>([
        ApiClient.fetchLawyerProfileInfo(
          token: session.token,
          userId: session.usuarioId,
        ),
        ApiClient.fetchLawyerSpecialties(
          token: session.token,
          userId: session.usuarioId,
        ),
        ApiClient.fetchSpecialtyCatalog(),
        ApiClient.fetchLawyerAvailability(
          token: session.token,
          userId: session.usuarioId,
        ),
        ApiClient.fetchLawyerStudies(
          token: session.token,
          userId: session.usuarioId,
        ),
      ]);

      final LawyerProfileInfo? info = results[0] as LawyerProfileInfo?;
      final List<LawyerSpecialty> specialties =
          results[1] as List<LawyerSpecialty>;
      final List<LawyerSpecialty> catalog =
          results[2] as List<LawyerSpecialty>;
      final List<LawyerAvailabilitySlot> availability =
          results[3] as List<LawyerAvailabilitySlot>;
      final List<LawyerStudyAssignment> studies =
          results[4] as List<LawyerStudyAssignment>;

      setState(() {
        _profileInfo = info;
        _catalogSpecialties = catalog;
        _selectedSpecialties = specialties.map((s) => s.id).toSet();
        _availability = availability;
        _studies = studies;
        _loading = false;
        _existingAvatarArchivo = info?.avatarArchivo;
        _retainExistingAvatar = _existingAvatarArchivo != null;
        _selectedAvatarFile = null;
        _avatarPreviewBytes = null;
      });

      _applyProfileToControllers(info);
      _applyPrimaryStudy(studies);
    } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
    } catch (error) {
      setState(() => _loading = false);
      _showSnack(
        error.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  void _applyProfileToControllers(LawyerProfileInfo? info) {
    if (info == null) {
      _bioController.clear();
      _durationController.text = '60';
      _baseRateController.clear();
      _addressController.clear();
      return;
    }
    _bioController.text = info.bio ?? '';
    _durationController.text =
        info.duracionMinutos != null ? '${info.duracionMinutos}' : '60';
    _baseRateController.text =
        info.tarifaBase != null ? info.tarifaBase!.toStringAsFixed(2) : '';
    _addressController.text = info.direccionAtencion ?? '';
  }

  void _applyPrimaryStudy(List<LawyerStudyAssignment> studies) {
    if (studies.isEmpty) {
      _clearLawFirmForm();
      return;
    }
    final LawyerStudyAssignment primary = studies.firstWhere(
      (s) => s.principal,
      orElse: () => studies.first,
    );
    _selectedLawFirm = primary.estudio;
    _lawFirmPrincipal = primary.principal;
    _lawFirmRoleController.text = primary.rolEnEstudio ?? '';
    _lawFirmRucController.text = primary.estudio.ruc ?? '';
    _lawFirmNameController.text = primary.estudio.nombreComercial ?? '';
    _lawFirmCountryController.text = primary.estudio.pais ?? '';
    _lawFirmCityController.text = primary.estudio.ciudad ?? '';
    _lawFirmEmailController.text = primary.estudio.correoContacto ?? '';
    _lawFirmPhoneController.text = primary.estudio.telefono ?? '';
    _lawFirmAddressController.text = primary.estudio.direccion ?? '';
  }

  void _clearLawFirmForm() {
    _selectedLawFirm = null;
    _lawFirmPrincipal = false;
    _lawFirmRoleController.clear();
    _lawFirmRucController.clear();
    _lawFirmNameController.clear();
    _lawFirmCountryController.clear();
    _lawFirmCityController.clear();
    _lawFirmEmailController.clear();
    _lawFirmPhoneController.clear();
    _lawFirmAddressController.clear();
  }

   Future<void> _pickAvatarFile() async {
    if (_savingProfile) return;
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.image,
        allowMultiple: false,
        withData: kIsWeb,
      );
      if (result == null || result.files.isEmpty) {
        return;
      }
      final PlatformFile file = result.files.single;
      if (file.size > _maxAvatarFileSizeBytes) {
        _showSnack(
          'La imagen supera el máximo permitido de ${(file.size / (1024 * 1024)).toStringAsFixed(2)} MB. Máximo 5 MB.',
        );
        return;
      }
      Uint8List bytes;
      if (file.bytes != null) {
        bytes = file.bytes!;
      } else if (!kIsWeb && file.path != null && file.path!.isNotEmpty) {
        bytes = await io.File(file.path!).readAsBytes();
      } else {
        throw Exception('No se pudo leer el archivo seleccionado.');
      }
      setState(() {
        _selectedAvatarFile = file;
        _avatarPreviewBytes = bytes;
        _retainExistingAvatar = false;
      });
    } catch (error) {
      _showSnack('No se pudo seleccionar la foto de perfil: $error');
    }
  }

  void _clearAvatarSelection() {
    setState(() {
      _selectedAvatarFile = null;
      _avatarPreviewBytes = null;
      if (_existingAvatarArchivo != null) {
        _retainExistingAvatar = true;
      }
    });
  }

  void _removeExistingAvatar() {
    setState(() {
      _retainExistingAvatar = false;
      _existingAvatarArchivo = null;
    });
  }

  Widget _buildAvatarPicker(bool canInteract) {
    final Uint8List? previewBytes = _avatarPreviewBytes;
    final String? remoteUrl =
        _retainExistingAvatar ? _existingAvatarArchivo?.resolvedUrl : null;
    ImageProvider<Object>? imageProvider;
    if (previewBytes != null) {
      imageProvider = MemoryImage(previewBytes);
    } else if (remoteUrl != null && remoteUrl.isNotEmpty) {
      imageProvider = NetworkImage(remoteUrl);
    }

    final bool hasExisting =
        _retainExistingAvatar && _existingAvatarArchivo != null;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        CircleAvatar(
          radius: 40,
          backgroundColor: AppColors.strokeColor,
          backgroundImage: imageProvider,
          child: imageProvider == null
              ? const Icon(Icons.person_outline,
                  size: 40, color: AppColors.text2Color)
              : null,
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ElevatedButton.icon(
                onPressed: canInteract ? _pickAvatarFile : null,
                icon: const Icon(Icons.camera_alt_rounded),
                label:
                    Text(canInteract ? 'Cambiar foto' : 'Foto de perfil'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.buttonColor,
                  foregroundColor: Colors.white,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Usa una imagen cuadrada de buena calidad (máx. 5 MB).',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.text2Color,
                ),
              ),
              if ((_selectedAvatarFile != null || hasExisting) && canInteract)
                TextButton.icon(
                  onPressed: _selectedAvatarFile != null
                      ? _clearAvatarSelection
                      : _removeExistingAvatar,
                  icon: const Icon(Icons.delete_outline),
                  label: Text(
                    _selectedAvatarFile != null
                        ? 'Quitar selección'
                        : 'Eliminar foto actual',
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  void _showSnack(String message, {Color color = Colors.red}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: color),
    );
  }

  void _handleUnauthorized(String? message) {
    SessionService.instance.clear();
    if (!mounted) {
      return;
    }
    final resolvedMessage = (message?.trim().isNotEmpty ?? false)
        ? message!.trim()
        : 'Tu sesión ha expirado. Inicia sesión nuevamente.';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(resolvedMessage), backgroundColor: Colors.red),
    );
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  Future<void> _saveProfileInfo() async {
    final session = SessionService.instance.session;
    if (session == null || _savingProfile) return;

    final tarifaText = _baseRateController.text.replaceAll(',', '.');
    final double? tarifaBase = double.tryParse(tarifaText);
    final int? duracion = int.tryParse(_durationController.text.trim());

    final info = LawyerProfileInfo(
      tarifaBase: tarifaBase,
      duracionMinutos: duracion,
      direccionAtencion: _addressController.text.trim(),
      bio: _bioController.text.trim(),
      avatarArchivo: _retainExistingAvatar ? _existingAvatarArchivo : null,
    );

    final PlatformFile? avatarFile = _selectedAvatarFile;
    ArchivoReference? avatarArchivoUpload;
    int? avatarArchivoId =
        _retainExistingAvatar ? _existingAvatarArchivo?.id : null;
    setState(() => _savingProfile = true);
    try {
      if (avatarFile != null) {
        final Uint8List bytes;
        if (avatarFile.bytes != null) {
          bytes = avatarFile.bytes!;
        } else if (!kIsWeb && avatarFile.path != null && avatarFile.path!.isNotEmpty) {
          bytes = await io.File(avatarFile.path!).readAsBytes();
        } else {
          throw Exception('No se pudo leer la foto seleccionada.');
        }

        final upload = await BlobStorageService.upload(
          bytes: bytes,
          fileName: avatarFile.name,
          prefix: 'usuarios/${session.usuarioId}/perfil/avatar',
        );
        avatarArchivoUpload = upload.toArchivoReference();
        avatarArchivoId = null;
      }
      final saved = await ApiClient.saveLawyerProfileInfo(
        token: session.token,
        userId: session.usuarioId,
        info: info,
        avatarArchivo: avatarArchivoUpload,
        avatarArchivoId: avatarArchivoId,
      );
      setState(() {
        _profileInfo = saved;
        _savingProfile = false;
         _existingAvatarArchivo = saved.avatarArchivo;
        _retainExistingAvatar = _existingAvatarArchivo != null;
        _selectedAvatarFile = null;
        _avatarPreviewBytes = null;
      });
      _applyProfileToControllers(saved);
      _showSnack(
        'Perfil actualizado correctamente',
        color: AppColors.button2Color,
      );
    } on UnauthorizedException catch (error) {
      setState(() => _savingProfile = false);
      _handleUnauthorized(error.message);
    } catch (error) {
      setState(() => _savingProfile = false);
      _showSnack(
        error.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> _saveSpecialties() async {
    final session = SessionService.instance.session;
    if (session == null || _savingSpecialties) return;

    setState(() => _savingSpecialties = true);
    try {
      await ApiClient.updateLawyerSpecialties(
        token: session.token,
        userId: session.usuarioId,
        specialtyIds: _selectedSpecialties.toList(),
      );
      setState(() => _savingSpecialties = false);
      _showSnack(
        'Especialidades guardadas',
        color: AppColors.button2Color,
      );
    } on UnauthorizedException catch (error) {
      setState(() => _savingSpecialties = false);
      _handleUnauthorized(error.message);
    } catch (error) {
      setState(() => _savingSpecialties = false);
      _showSnack(
        error.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> _addAvailabilitySlot() async {
    if (_addingAvailability) return;
    final session = SessionService.instance.session;
    if (session == null) return;

    if (_newSlotStart == null || _newSlotEnd == null) {
      _showSnack('Selecciona las horas de inicio y fin.');
      return;
    }

    final startMinutes = _newSlotStart!.hour * 60 + _newSlotStart!.minute;
    final endMinutes = _newSlotEnd!.hour * 60 + _newSlotEnd!.minute;
    if (endMinutes <= startMinutes) {
      _showSnack('La hora de fin debe ser mayor a la hora de inicio.');
      return;
    }

    setState(() => _addingAvailability = true);
    try {
      final slot = await ApiClient.addLawyerAvailabilitySlot(
        token: session.token,
        userId: session.usuarioId,
        day: _newSlotDay,
        startTime: formatTimeOfDay(_newSlotStart!),
        endTime: formatTimeOfDay(_newSlotEnd!),
      );
      setState(() {
        _availability = List<LawyerAvailabilitySlot>.from(_availability)
          ..add(slot)
          ..sort((a, b) {
            final dayComparison = a.diaSemana.compareTo(b.diaSemana);
            if (dayComparison != 0) return dayComparison;
            final startA = a.horaInicio ?? const TimeOfDay(hour: 0, minute: 0);
            final startB = b.horaInicio ?? const TimeOfDay(hour: 0, minute: 0);
            return (startA.hour * 60 + startA.minute)
                .compareTo(startB.hour * 60 + startB.minute);
          });
        _addingAvailability = false;
        _newSlotStart = null;
        _newSlotEnd = null;
      });
      _showSnack(
        'Disponibilidad registrada',
        color: AppColors.button2Color,
      );
    } on UnauthorizedException catch (error) {
      setState(() => _addingAvailability = false);
      _handleUnauthorized(error.message);
    } catch (error) {
      setState(() => _addingAvailability = false);
      _showSnack(
        error.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> _deleteAvailabilitySlot(LawyerAvailabilitySlot slot) async {
    final session = SessionService.instance.session;
    if (session == null) return;

    try {
      await ApiClient.deleteLawyerAvailabilitySlot(
        token: session.token,
        userId: session.usuarioId,
        slotId: slot.id,
      );
      setState(() {
        _availability =
            _availability.where((element) => element.id != slot.id).toList();
      });
      _showSnack(
        'Disponibilidad eliminada',
        color: AppColors.text3Color,
      );
    } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
    } catch (error) {
      _showSnack(
        error.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> _saveLawFirm() async {
    if (_savingLawFirm) return;
    final session = SessionService.instance.session;
    if (session == null) return;

    final String name = _lawFirmNameController.text.trim();
    if (name.isEmpty) {
      _showSnack('Ingresa el nombre comercial del estudio.');
      return;
    }

    setState(() => _savingLawFirm = true);
    try {
      LawFirmSummary? firm = _selectedLawFirm;
      if (firm == null) {
        firm = await ApiClient.createLawFirm(
          token: session.token,
          ruc: _lawFirmRucController.text.trim(),
          nombreComercial: name,
          pais: _lawFirmCountryController.text.trim(),
          ciudad: _lawFirmCityController.text.trim(),
          correoContacto: _lawFirmEmailController.text.trim(),
          telefono: _lawFirmPhoneController.text.trim(),
          direccion: _lawFirmAddressController.text.trim(),
        );
      }

      final assignment = await ApiClient.upsertLawyerStudy(
        token: session.token,
        userId: session.usuarioId,
        studyId: firm.id,
        principal: _lawFirmPrincipal,
        role: _lawFirmRoleController.text.trim().isEmpty
            ? null
            : _lawFirmRoleController.text.trim(),
      );

      setState(() {
        _savingLawFirm = false;
        _selectedLawFirm = assignment.estudio;
        _studies = _mergeStudyAssignment(_studies, assignment);
      });

      _showSnack(
        'Estudio actualizado',
        color: AppColors.button2Color,
      );
    } on UnauthorizedException catch (error) {
      setState(() => _savingLawFirm = false);
      _handleUnauthorized(error.message);
    } catch (error) {
      setState(() => _savingLawFirm = false);
      _showSnack(
        error.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  List<LawyerStudyAssignment> _mergeStudyAssignment(
    List<LawyerStudyAssignment> current,
    LawyerStudyAssignment updated,
  ) {
    final List<LawyerStudyAssignment> mutable =
        List<LawyerStudyAssignment>.from(current);
    final index = mutable.indexWhere((item) => item.estudioId == updated.estudioId);
    if (index >= 0) {
      mutable[index] = updated;
    } else {
      mutable.add(updated);
    }
    if (updated.principal) {
      for (var i = 0; i < mutable.length; i++) {
        final item = mutable[i];
        if (item.estudioId != updated.estudioId && item.principal) {
          mutable[i] = LawyerStudyAssignment(
            id: item.id,
            usuarioId: item.usuarioId,
            estudioId: item.estudioId,
            principal: false,
            rolEnEstudio: item.rolEnEstudio,
            estudio: item.estudio,
          );
        }
      }
    }
    return mutable;
  }

  Future<void> _deleteStudy(LawyerStudyAssignment assignment) async {
    final session = SessionService.instance.session;
    if (session == null) return;

    try {
      await ApiClient.deleteLawyerStudy(
        token: session.token,
        userId: session.usuarioId,
        studyId: assignment.estudioId,
      );
      setState(() {
        _studies =
            _studies.where((item) => item.estudioId != assignment.estudioId).toList();
        if (_selectedLawFirm?.id == assignment.estudioId) {
          _clearLawFirmForm();
        }
      });
      _showSnack(
        'Estudio eliminado',
        color: AppColors.text3Color,
      );
    } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
    } catch (error) {
      _showSnack(
        error.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> _pickTime({required bool isStart}) async {
    final initialTime = isStart ? _newSlotStart : _newSlotEnd;
    final picked = await showTimePicker(
      context: context,
      initialTime: initialTime ?? const TimeOfDay(hour: 9, minute: 0),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _newSlotStart = picked;
      } else {
        _newSlotEnd = picked;
      }
    });
  }

  String _dayName(int day) {
    switch (day) {
      case 1:
        return 'Lunes';
      case 2:
        return 'Martes';
      case 3:
        return 'Miércoles';
      case 4:
        return 'Jueves';
      case 5:
        return 'Viernes';
      case 6:
        return 'Sábado';
      case 7:
        return 'Domingo';
      default:
        return 'Día $day';
    }
  }

  String _formatTimeForDisplay(TimeOfDay? time) {
    if (time == null) return '--:--';
    return time.format(context);
  }

  Future<void> _openStudySearch() async {
    final session = SessionService.instance.session;
    if (session == null) return;

    final TextEditingController searchController = TextEditingController();
    List<LawFirmSummary> results = const [];
    bool isSearching = false;

    final LawFirmSummary? selected = await showDialog<LawFirmSummary>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            Future<void> performSearch() async {
              final query = searchController.text.trim();
              if (query.isEmpty) {
                setState(() => results = const []);
                return;
              }
              setState(() => isSearching = true);
              try {
                final fetched = await ApiClient.searchLawFirms(
                  token: session.token,
                  query: query,
                );
                setState(() {
                  results = fetched;
                  isSearching = false;
                });
              } on UnauthorizedException catch (error) {
                Navigator.of(context).pop();
                _handleUnauthorized(error.message);
              } catch (error) {
                setState(() => isSearching = false);
                _showSnack(
                  error.toString().replaceFirst('Exception: ', ''),
                );
              }
            }

            return AlertDialog(
              title: const Text('Buscar estudio'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: searchController,
                    decoration: const InputDecoration(
                      labelText: 'Nombre o RUC',
                    ),
                  ),
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerRight,
                    child: ElevatedButton.icon(
                      onPressed: isSearching ? null : performSearch,
                      icon: const Icon(Icons.search),
                      label: const Text('Buscar'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.buttonColor,
                      ),
                    ),
                  ),
                  if (isSearching) const SizedBox(height: 12),
                  if (isSearching) const CircularProgressIndicator(),
                  if (!isSearching && results.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 240,
                      width: double.maxFinite,
                      child: ListView.separated(
                        itemCount: results.length,
                        separatorBuilder: (_, __) => const Divider(),
                        itemBuilder: (context, index) {
                          final item = results[index];
                          return ListTile(
                            title: Text(item.nombreComercial ?? 'Sin nombre'),
                            subtitle: Text(
                              [item.ruc, item.ciudad].where((value) => (value?.isNotEmpty ?? false)).join(' • '),
                            ),
                            onTap: () => Navigator.of(context).pop(item),
                          );
                        },
                      ),
                    ),
                  ],
                  if (!isSearching && results.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 12),
                      child: Text(
                        'Ingresa un término de búsqueda para encontrar estudios registrados.',
                        textAlign: TextAlign.center,
                      ),
                    ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Cerrar'),
                ),
              ],
            );
          },
        );
      },
    );

    if (selected != null) {
      setState(() {
        _selectedLawFirm = selected;
        _lawFirmRucController.text = selected.ruc ?? '';
        _lawFirmNameController.text = selected.nombreComercial ?? '';
        _lawFirmCountryController.text = selected.pais ?? '';
        _lawFirmCityController.text = selected.ciudad ?? '';
        _lawFirmEmailController.text = selected.correoContacto ?? '';
        _lawFirmPhoneController.text = selected.telefono ?? '';
        _lawFirmAddressController.text = selected.direccion ?? '';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Perfil de Abogado'),
        backgroundColor: AppColors.buttonColor,
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadInitialData,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: [
                  _buildProfileSection(),
                  const SizedBox(height: 16),
                  _buildSpecialtiesSection(),
                  const SizedBox(height: 16),
                  _buildAvailabilitySection(),
                  const SizedBox(height: 16),
                  _buildLawFirmSection(),
                ],
              ),
            ),
    );
  }

  Widget _buildSectionTitle(String title, {IconData? icon}) {
    return Row(
      children: [
        if (icon != null) ...[
          Icon(icon, color: AppColors.buttonColor),
          const SizedBox(width: 8),
        ],
        Text(
          title,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: AppColors.buttonColor,
          ),
        ),
      ],
    );
  }

  Widget _buildProfileSection() {
    return ShadowCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSectionTitle('Información profesional', icon: Icons.badge),
          const SizedBox(height: 12),
           _buildAvatarPicker(!_savingProfile),
          const SizedBox(height: 16),
          TextField(
            controller: _baseRateController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              labelText: 'Tarifa base (S/)',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _durationController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Duración estándar (minutos)',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _addressController,
            decoration: const InputDecoration(
              labelText: 'Dirección de atención',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _bioController,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'Biografía profesional',
            ),
          ),
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerRight,
            child: ElevatedButton.icon(
              onPressed: _savingProfile ? null : _saveProfileInfo,
              icon: _savingProfile
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save),
              label: Text(_savingProfile ? 'Guardando...' : 'Guardar cambios'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.buttonColor,
                foregroundColor: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSpecialtiesSection() {
    return ShadowCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSectionTitle('Especialidades', icon: Icons.gavel),
          const SizedBox(height: 12),
          if (_catalogSpecialties.isEmpty)
            const Text(
              'No hay especialidades registradas en el catálogo.',
            )
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _catalogSpecialties.map((specialty) {
                final selected = _selectedSpecialties.contains(specialty.id);
                return FilterChip(
                  label: Text(specialty.nombre),
                  selected: selected,
                  onSelected: (value) {
                    setState(() {
                      if (value) {
                        _selectedSpecialties.add(specialty.id);
                      } else {
                        _selectedSpecialties.remove(specialty.id);
                      }
                    });
                  },
                  selectedColor: AppColors.buttonColor.withOpacity(0.2),
                );
              }).toList(),
            ),
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerRight,
            child: ElevatedButton.icon(
              onPressed: _savingSpecialties ? null : _saveSpecialties,
              icon: _savingSpecialties
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_alt),
              label:
                  Text(_savingSpecialties ? 'Guardando...' : 'Guardar especialidades'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.buttonColor,
                foregroundColor: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvailabilitySection() {
    return ShadowCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSectionTitle('Disponibilidad', icon: Icons.calendar_today),
          const SizedBox(height: 12),
          if (_availability.isEmpty)
            const Text('Aún no registras horarios de atención.'),
          if (_availability.isNotEmpty)
            Column(
              children: _availability.map((slot) {
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    '${_dayName(slot.diaSemana)} · '
                    '${_formatTimeForDisplay(slot.horaInicio)} - '
                    '${_formatTimeForDisplay(slot.horaFin)}',
                  ),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete, color: Colors.red),
                    onPressed: () => _deleteAvailabilitySlot(slot),
                  ),
                );
              }).toList(),
            ),
          const Divider(height: 32),
          const Text(
            'Agregar nuevo horario',
            style: TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<int>(
            value: _newSlotDay,
            decoration: const InputDecoration(labelText: 'Día de la semana'),
            items: List.generate(7, (index) {
              final day = index + 1;
              return DropdownMenuItem<int>(
                value: day,
                child: Text(_dayName(day)),
              );
            }),
            onChanged: (value) {
              if (value != null) {
                setState(() => _newSlotDay = value);
              }
            },
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _pickTime(isStart: true),
                  child: Text('Inicio: ${_formatTimeForDisplay(_newSlotStart)}'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _pickTime(isStart: false),
                  child: Text('Fin: ${_formatTimeForDisplay(_newSlotEnd)}'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: ElevatedButton.icon(
              onPressed: _addingAvailability ? null : _addAvailabilitySlot,
              icon: _addingAvailability
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.add),
              label: Text(_addingAvailability ? 'Agregando...' : 'Agregar horario'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.buttonColor,
                foregroundColor: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLawFirmSection() {
    return ShadowCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSectionTitle('Estudios asociados', icon: Icons.domain),
          const SizedBox(height: 12),
          if (_studies.isEmpty)
            const Text('No tienes estudios vinculados todavía.'),
          if (_studies.isNotEmpty)
            Column(
              children: _studies.map((assignment) {
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  title:
                      Text(assignment.estudio.nombreComercial ?? 'Sin nombre'),
                  subtitle: Text(
                    [
                      assignment.estudio.ruc,
                      assignment.estudio.ciudad,
                      assignment.rolEnEstudio
                    ].where((value) => (value?.isNotEmpty ?? false)).join(' • '),
                  ),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete, color: Colors.red),
                    onPressed: () => _deleteStudy(assignment),
                  ),
                  onTap: () {
                    setState(() {
                      _selectedLawFirm = assignment.estudio;
                      _lawFirmPrincipal = assignment.principal;
                      _lawFirmRoleController.text = assignment.rolEnEstudio ?? '';
                      _lawFirmRucController.text = assignment.estudio.ruc ?? '';
                      _lawFirmNameController.text =
                          assignment.estudio.nombreComercial ?? '';
                      _lawFirmCountryController.text =
                          assignment.estudio.pais ?? '';
                      _lawFirmCityController.text =
                          assignment.estudio.ciudad ?? '';
                      _lawFirmEmailController.text =
                          assignment.estudio.correoContacto ?? '';
                      _lawFirmPhoneController.text =
                          assignment.estudio.telefono ?? '';
                      _lawFirmAddressController.text =
                          assignment.estudio.direccion ?? '';
                    });
                  },
                );
              }).toList(),
            ),
          const Divider(height: 32),
          const Text(
            'Registrar o vincular estudio',
            style: TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            children: [
              ElevatedButton.icon(
                onPressed: _openStudySearch,
                icon: const Icon(Icons.search),
                label: const Text('Buscar registrado'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.buttonColor,
                  foregroundColor: Colors.white,
                ),
              ),
              TextButton(
                onPressed: _clearLawFirmForm,
                child: const Text('Limpiar formulario'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _lawFirmNameController,
            decoration: const InputDecoration(labelText: 'Nombre comercial'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _lawFirmRucController,
            decoration: const InputDecoration(labelText: 'RUC'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _lawFirmCountryController,
            decoration: const InputDecoration(labelText: 'País'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _lawFirmCityController,
            decoration: const InputDecoration(labelText: 'Ciudad'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _lawFirmAddressController,
            decoration: const InputDecoration(labelText: 'Dirección'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _lawFirmEmailController,
            keyboardType: TextInputType.emailAddress,
            decoration:
                const InputDecoration(labelText: 'Correo de contacto (opcional)'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _lawFirmPhoneController,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'Teléfono (opcional)'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _lawFirmRoleController,
            decoration:
                const InputDecoration(labelText: 'Rol dentro del estudio'),
          ),
          const SizedBox(height: 12),
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: const Text('Marcar como estudio principal'),
            value: _lawFirmPrincipal,
            onChanged: (value) => setState(() => _lawFirmPrincipal = value),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: ElevatedButton.icon(
              onPressed: _savingLawFirm ? null : _saveLawFirm,
              icon: _savingLawFirm
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_as),
              label:
                  Text(_savingLawFirm ? 'Guardando...' : 'Guardar estudio'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.buttonColor,
                foregroundColor: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
