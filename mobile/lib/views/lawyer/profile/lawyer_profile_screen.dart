import 'dart:io' as io;
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  const LawyerProfileScreen({
    super.key,
    this.initialSubsection = LawyerProfileSubsection.profile,
    this.onSubsectionChanged,
    this.embedded = false,
  });

  final LawyerProfileSubsection initialSubsection;
  final ValueChanged<LawyerProfileSubsection>? onSubsectionChanged;
  final bool embedded;

  @override
  State<LawyerProfileScreen> createState() => LawyerProfileScreenState();
}

enum LawyerProfileSubsection {
  profile,
  specialties,
  acceptanceCriteria,
  studies,
}

class LawyerProfileScreenState extends State<LawyerProfileScreen> {
  final TextEditingController _bioController = TextEditingController();
  final TextEditingController _baseRateController = TextEditingController();

  // Estudios
  final TextEditingController _lawFirmRucController = TextEditingController();


  bool _loading = true;
  bool _savingProfile = false;
  bool _savingSpecialties = false;
  bool _addingAvailability = false;
  bool _savingLawFirm = false;
  static const int _maxAvatarFileSizeBytes = 5 * 1024 * 1024;

  LawyerProfileInfo? _profileInfo;
  List<LawyerSpecialty> _catalogSpecialties = const <LawyerSpecialty>[];
  Set<int> _selectedSpecialties = <int>{};
  List<LawyerAvailabilitySlot> _availability = const <LawyerAvailabilitySlot>[];
  List<LawyerStudyAssignment> _studies = const <LawyerStudyAssignment>[];
  late LawyerProfileSubsection _currentSubsection;

   bool _lookingUpLawFirm = false;


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
    _currentSubsection = widget.initialSubsection;
    _loadInitialData();
  }

  @override
  void dispose() {
    _bioController.dispose();
    _baseRateController.dispose();

    // Estudios
    _lawFirmRucController.dispose();

    super.dispose();
  }

  @override
  void didUpdateWidget(covariant LawyerProfileScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialSubsection != oldWidget.initialSubsection &&
        widget.initialSubsection != _currentSubsection) {
      selectSubsection(widget.initialSubsection);
    }
  }

  void _setSubsection(
    LawyerProfileSubsection subsection, {
    bool notifyParent = true,
  }) {
    if (_currentSubsection == subsection) return;
    setState(() {
      _currentSubsection = subsection;
    });
    if (notifyParent) {
      widget.onSubsectionChanged?.call(subsection);
    }
  }

  void selectSubsection(LawyerProfileSubsection subsection) {
    _setSubsection(subsection, notifyParent: false);
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
      final List<LawyerSpecialty> catalog = results[2] as List<LawyerSpecialty>;
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
      _showSnack(error.toString().replaceFirst('Exception: ', ''));
    }
  }

  void _applyProfileToControllers(LawyerProfileInfo? info) {
    if (info == null) {
      _bioController.clear();
      _baseRateController.clear();
      return;
    }
    _bioController.text = info.bio ?? '';
    _baseRateController.text =
        info.tarifaBase != null ? info.tarifaBase!.toStringAsFixed(2) : '';
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
   _lawFirmRucController.text = primary.estudio.ruc ?? '';
    setState(() {
      _selectedLawFirm = primary.estudio;
      _lawFirmPrincipal = primary.principal;
    });
  }

  void _clearLawFirmForm() {
    _lawFirmRucController.clear();
    setState(() {
      _selectedLawFirm = null;
      _lawFirmPrincipal = false;
    });
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

  void _showAvatarViewer(ImageProvider<Object> provider) {
    showDialog<void>(
      context: context,
      builder: (context) {
        return Dialog(
          insetPadding: const EdgeInsets.all(16),
          backgroundColor: Colors.black,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600, maxHeight: 600),
            child: InteractiveViewer(
              maxScale: 5,
              child: Center(
                child: Image(
                  image: provider,
                  fit: BoxFit.contain,
                  errorBuilder: (context, error, stackTrace) {
                    return const Center(
                      child: Icon(
                        Icons.broken_image_outlined,
                        size: 64,
                        color: Colors.white70,
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildAvatarPlaceholder() {
    return Container(
      width: 80,
      height: 80,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.strokeColor,
      ),
      alignment: Alignment.center,
      child: const Icon(
        Icons.person_outline,
        size: 40,
        color: AppColors.text2Color,
      ),
    );
  }

  Widget _buildAvatarImage(ImageProvider<Object> provider, bool enablePreview) {
    final avatar = Container(
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.strokeColor),
      ),
      clipBehavior: Clip.antiAlias,
      child: Image(
        image: provider,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) {
          return _buildAvatarPlaceholder();
        },
      ),
    );

    if (!enablePreview) {
      return avatar;
    }

    return GestureDetector(
      onTap: () => _showAvatarViewer(provider),
      child: avatar,
    );
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
    final avatarWidget =
        imageProvider != null
            ? _buildAvatarImage(imageProvider, true)
            : _buildAvatarPlaceholder();

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        avatarWidget,
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ElevatedButton.icon(
                onPressed: canInteract ? _pickAvatarFile : null,
                icon: const Icon(Icons.camera_alt_rounded),
                label: Text(canInteract ? 'Cambiar foto' : 'Foto de perfil'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.buttonColor,
                  foregroundColor: Colors.white,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Usa una imagen cuadrada de buena calidad (máx. 5 MB).',
                style: TextStyle(fontSize: 12, color: AppColors.text2Color),
              ),
              if ((_selectedAvatarFile != null || hasExisting) && canInteract)
                TextButton.icon(
                  onPressed:
                      _selectedAvatarFile != null
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
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message), backgroundColor: color));
  }

  void _handleUnauthorized(String? message) {
    SessionService.instance.clear();
    if (!mounted) {
      return;
    }
    final resolvedMessage =
        (message?.trim().isNotEmpty ?? false)
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

    final info = LawyerProfileInfo(
      tarifaBase: tarifaBase,
      bio: _bioController.text.trim(),
      // Perfil: sin dirección ni UBIGEO
      direccionAtencion: null,
      direccionUbigeoCodigo: null,
      lineaExactaDireccion: null,
      avatarArchivo: _retainExistingAvatar ? _existingAvatarArchivo : null,
    );

    final PlatformFile? avatarFile = _selectedAvatarFile;
    ArchivoReference? avatarArchivoUpload;
    int? avatarArchivoId =
        _retainExistingAvatar ? _existingAvatarArchivo?.id : null;

    setState(() => _savingProfile = true);
    try {
      if (avatarFile != null) {
        final String? previousPath =
            _existingAvatarArchivo?.ruta ?? _existingAvatarArchivo?.resolvedUrl;
        final bool reuseExistingPath =
            previousPath != null &&
            !BlobStorageService.isLegacyPath(previousPath);
        if (previousPath != null && previousPath.trim().isNotEmpty) {
          try {
            await BlobStorageService.delete(previousPath);
          } catch (error, stackTrace) {
            debugPrint(
              'No se pudo eliminar el avatar anterior: $error\n$stackTrace',
            );
          }
        }
        final Uint8List bytes;
        if (avatarFile.bytes != null) {
          bytes = avatarFile.bytes!;
        } else if (!kIsWeb &&
            avatarFile.path != null &&
            avatarFile.path!.isNotEmpty) {
          bytes = await io.File(avatarFile.path!).readAsBytes();
        } else {
          throw Exception('No se pudo leer la foto seleccionada.');
        }

        final upload = await BlobStorageService.upload(
          bytes: bytes,
          fileName: avatarFile.name,
          prefix: '${session.usuarioId}/perfil',
          allowOverwrite: reuseExistingPath,
          existingPath: reuseExistingPath ? previousPath : null,
        );
        avatarArchivoUpload = ArchivoReference(
          id: _existingAvatarArchivo?.id,
          ruta: upload.pathname,
          tamano: upload.size,
          tipo: upload.contentType,
          url: upload.url,
        );
        avatarArchivoId = _existingAvatarArchivo?.id;
      }

      final saved = await ApiClient.saveLawyerProfileInfo(
        token: session.token,
        userId: session.usuarioId,
        info: info,
        avatarArchivo: avatarArchivoUpload,
        avatarArchivoId: avatarArchivoId,
      );

      setState(() {
        _savingProfile = false;
        final savedAvatar = saved.avatarArchivo;
        if (savedAvatar != null || avatarArchivoUpload != null) {
          final mergedAvatar = (savedAvatar ?? avatarArchivoUpload)!.copyWith(
            id: savedAvatar?.id ?? avatarArchivoUpload?.id,
            ruta: savedAvatar?.ruta ?? avatarArchivoUpload?.ruta,
            tamano: savedAvatar?.tamano ?? avatarArchivoUpload?.tamano,
            tipo: savedAvatar?.tipo ?? avatarArchivoUpload?.tipo,
            url:
                savedAvatar?.url ??
                avatarArchivoUpload?.url ??
                savedAvatar?.resolvedUrl,
          );
          _existingAvatarArchivo = mergedAvatar;
          _profileInfo = LawyerProfileInfo(
            tarifaBase: saved.tarifaBase,
            bio: saved.bio,
            direccionAtencion: saved.direccionAtencion,
            avatarArchivo: mergedAvatar,
          );
        } else {
          _existingAvatarArchivo = null;
          _profileInfo = LawyerProfileInfo(
            tarifaBase: saved.tarifaBase,
            bio: saved.bio,
            direccionAtencion: saved.direccionAtencion,
            avatarArchivo: null,
          );
        }
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
      _showSnack(error.toString().replaceFirst('Exception: ', ''));
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
      _showSnack('Especialidades guardadas', color: AppColors.button2Color);
    } on UnauthorizedException catch (error) {
      setState(() => _savingSpecialties = false);
      _handleUnauthorized(error.message);
    } catch (error) {
      setState(() => _savingSpecialties = false);
      _showSnack(error.toString().replaceFirst('Exception: ', ''));
    }
  }

  // Helper faltante que ya estabas usando
  String formatTimeOfDay(TimeOfDay t) {
    final h = t.hour.toString().padLeft(2, '0');
    final m = t.minute.toString().padLeft(2, '0');
    return '$h:$m';
    // Si tu backend espera "HH:mm:ss", usa: return '$h:$m:00';
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
        _availability =
            List<LawyerAvailabilitySlot>.from(_availability)
              ..add(slot)
              ..sort((a, b) {
                final dayComparison = a.diaSemana.compareTo(b.diaSemana);
                if (dayComparison != 0) return dayComparison;
                final startA =
                    a.horaInicio ?? const TimeOfDay(hour: 0, minute: 0);
                final startB =
                    b.horaInicio ?? const TimeOfDay(hour: 0, minute: 0);
                return (startA.hour * 60 + startA.minute).compareTo(
                  startB.hour * 60 + startB.minute,
                );
              });
        _addingAvailability = false;
        _newSlotStart = null;
        _newSlotEnd = null;
      });
      _showSnack('Disponibilidad registrada', color: AppColors.button2Color);
    } on UnauthorizedException catch (error) {
      setState(() => _addingAvailability = false);
      _handleUnauthorized(error.message);
    } catch (error) {
      setState(() => _addingAvailability = false);
      _showSnack(error.toString().replaceFirst('Exception: ', ''));
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
      _showSnack('Disponibilidad eliminada', color: AppColors.text3Color);
    } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
    } catch (error) {
      _showSnack(error.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _saveLawFirm() async {
    if (_savingLawFirm) return;
    final session = SessionService.instance.session;
    if (session == null) return;

    final LawFirmSummary? selected = _selectedLawFirm;
    if (selected == null) {
      _showSnack('Busca un estudio por RUC antes de guardar.');
      return;
    }

    final direccionCodigo = selected.direccionUbigeoCodigo?.trim();
    final direccionExacta = selected.lineaExactaDireccion?.trim();
    if (direccionCodigo == null || direccionCodigo.isEmpty) {
      _showSnack(
        'El estudio no tiene un ubigeo registrado. Intenta consultarlo nuevamente.',
      );
      return;
    }
    if (direccionExacta == null || direccionExacta.isEmpty) {
      _showSnack(
        'El estudio no tiene dirección exacta registrada. Intenta consultarlo nuevamente.',
      );
      return;
    }
    setState(() => _savingLawFirm = true);
    try {
      final assignment = await ApiClient.upsertLawyerStudy(
        token: session.token,
        userId: session.usuarioId,
        studyId: selected.id,
        principal: _lawFirmPrincipal,
        role: null,
        direccionUbigeoCodigo: direccionCodigo,
        lineaExactaDireccion: direccionExacta,
      );

      setState(() {
        _savingLawFirm = false;
        _selectedLawFirm = assignment.estudio;
        _studies = _mergeStudyAssignment(_studies, assignment);
        _lawFirmRucController.text = assignment.estudio.ruc ??
            selected.ruc ??
            _lawFirmRucController.text;
        _lawFirmPrincipal = assignment.principal;
      });

      _showSnack('Estudio actualizado', color: AppColors.button2Color);
    } on UnauthorizedException catch (error) {
      setState(() => _savingLawFirm = false);
      _handleUnauthorized(error.message);
    } catch (error) {
      setState(() => _savingLawFirm = false);
      _showSnack(error.toString().replaceFirst('Exception: ', ''));
    }
  }

   Future<void> _lookupLawFirmByRuc() async {
    if (_lookingUpLawFirm) return;
    final session = SessionService.instance.session;
    if (session == null) return;

    final ruc = _lawFirmRucController.text.replaceAll(RegExp(r'\D'), '');
    if (ruc.length != 11 || int.tryParse(ruc) == null) {
      _showSnack('Ingresa un RUC válido de 11 dígitos.');
      return;
    }

    setState(() => _lookingUpLawFirm = true);
    try {
      final summary = await ApiClient.lookupLawFirmByRuc(
        token: session.token,
        ruc: ruc,
      );
      if (!mounted) return;
      setState(() {
        _selectedLawFirm = summary;
        _lawFirmRucController.text = summary.ruc ?? ruc;
      });
      _showSnack(
        'Estudio consultado correctamente.',
        color: AppColors.button2Color,
      );
    } on UnauthorizedException catch (error) {
      setState(() => _lookingUpLawFirm = false);
      _handleUnauthorized(error.message);
    } catch (error) {
      setState(() => _lookingUpLawFirm = false);
      _showSnack(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) {
        setState(() => _lookingUpLawFirm = false);
      }
    }
  }

  List<LawyerStudyAssignment> _mergeStudyAssignment(
    List<LawyerStudyAssignment> current,
    LawyerStudyAssignment updated,
  ) {
    final List<LawyerStudyAssignment> mutable =
        List<LawyerStudyAssignment>.from(current);
    final index = mutable.indexWhere(
      (item) => item.estudioId == updated.estudioId,
    );
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
            _studies
                .where((item) => item.estudioId != assignment.estudioId)
                .toList();
        if (_selectedLawFirm?.id == assignment.estudioId) {
          _clearLawFirmForm();
        }
      });
      _showSnack('Estudio eliminado', color: AppColors.text3Color);
    } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
    } catch (error) {
      _showSnack(error.toString().replaceFirst('Exception: ', ''));
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
    List<LawFirmSummary> results = const <LawFirmSummary>[];
    bool isSearching = false;

    final LawFirmSummary? selected = await showDialog<LawFirmSummary>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            Future<void> performSearch() async {
              final query = searchController.text.trim();
              if (query.isEmpty) {
                setState(() => results = const <LawFirmSummary>[]);
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
                _showSnack(error.toString().replaceFirst('Exception: ', ''));
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
                            title: Text(item.displayName),
                            subtitle: Text(
                              [item.ruc, item.formattedLocation]
                                  .where(
                                    (value) => (value?.isNotEmpty ?? false),
                                  )
                                  .join(' • '),
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
      _lawFirmRucController.text = selected.ruc ?? '';
      setState(() {
        _selectedLawFirm = selected;
      });
    }
  }


  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    return _buildScrollableContent();
  }

  Widget _buildScrollableContent() {
    final scrollable = SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: widget.embedded ? EdgeInsets.zero : const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(
                _iconForSection(_currentSubsection),
                color: AppColors.buttonColor,
              ),
              const SizedBox(width: 8),
              Text(
                _labelForSection(_currentSubsection),
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: AppColors.buttonColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildCurrentSection(),
        ],
      ),
    );
    return RefreshIndicator(onRefresh: _loadInitialData, child: scrollable);
  }

  Widget _buildCurrentSection() {
    switch (_currentSubsection) {
      case LawyerProfileSubsection.profile:
        return _buildProfileSection();
      case LawyerProfileSubsection.specialties:
        return _buildSpecialtiesSection();
      case LawyerProfileSubsection.acceptanceCriteria:
        return _buildAvailabilitySection();
      case LawyerProfileSubsection.studies:
        return _buildLawFirmSection();
    }
  }

  IconData _iconForSection(LawyerProfileSubsection subsection) {
    switch (subsection) {
      case LawyerProfileSubsection.profile:
        return Icons.badge;
      case LawyerProfileSubsection.specialties:
        return Icons.gavel;
      case LawyerProfileSubsection.acceptanceCriteria:
        return Icons.rule;
      case LawyerProfileSubsection.studies:
        return Icons.domain;
    }
  }

  String _labelForSection(LawyerProfileSubsection subsection) {
    switch (subsection) {
      case LawyerProfileSubsection.profile:
        return 'Perfil de Abogado';
      case LawyerProfileSubsection.specialties:
        return 'Especialidades';
      case LawyerProfileSubsection.acceptanceCriteria:
        return 'Disponibilidad';
      case LawyerProfileSubsection.studies:
        return 'Estudios asociados';
    }
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
 Widget _buildSummaryRow(String label, String? value) {
    final resolved = (value ?? '').trim();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 150,
            child: Text(
              label,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                color: AppColors.text1Color,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              resolved.isEmpty ? '--' : resolved,
              style: const TextStyle(color: AppColors.text2Color),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLawFirmSummaryCard(LawFirmSummary firm) {
    final estadoCondicion = [firm.estado, firm.condicion]
        .whereType<String>()
        .map((value) => value.trim())
        .where((value) => value.isNotEmpty)
        .join(' • ');
    final direccion = firm.lineaExactaDireccion?.trim();

    final flagChips = <Widget>[];
    void addFlag(String label, bool? value) {
      if (value == true) {
        flagChips.add(
          Chip(
            label: Text(label),
            backgroundColor: AppColors.buttonColor.withOpacity(0.12),
            labelStyle: const TextStyle(color: AppColors.buttonColor),
          ),
        );
      }
    }

    addFlag('Agente de retención', firm.esAgenteRetencion);
    addFlag('Agente de percepción', firm.esAgentePercepcion);
    addFlag('Agente percepción combustible', firm.esAgentePercepcionCombustible);
    addFlag('Buen contribuyente', firm.esBuenContribuyente);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.strokeColor),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            firm.displayName,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.text1Color,
            ),
          ),
          const SizedBox(height: 8),
          _buildSummaryRow('RUC', firm.ruc),
          _buildSummaryRow(
            'Estado / Condición',
            estadoCondicion.isEmpty ? null : estadoCondicion,
          ),
          _buildSummaryRow('Dirección exacta', direccion),
          _buildSummaryRow('Ubicación', firm.formattedLocation),
          _buildSummaryRow('Ubigeo SUNAT', firm.direccionUbigeoCodigo),
          _buildSummaryRow('Correo', firm.correoContacto),
          _buildSummaryRow('Teléfono', firm.telefono),
          if (flagChips.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: flagChips,
            ),
          ],
          if (direccion == null || direccion.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: Text(
                'Este estudio no cuenta con dirección exacta registrada. Consulta nuevamente el RUC para completar la información.',
                style: TextStyle(
                  color: AppColors.text3Color,
                  fontSize: 12,
                ),
              ),
            ),
        ],
      ),
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
            decoration: const InputDecoration(labelText: 'Tarifa base (S/)'),
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
              icon:
                  _savingProfile
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
            const Text('No hay especialidades registradas en el catálogo.')
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children:
                  _catalogSpecialties.map((specialty) {
                    final selected = _selectedSpecialties.contains(
                      specialty.id,
                    );
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
              icon:
                  _savingSpecialties
                      ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                      : const Icon(Icons.save_alt),
              label: Text(
                _savingSpecialties ? 'Guardando...' : 'Guardar especialidades',
              ),
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
          _buildSectionTitle('Disponibilidad', icon: Icons.rule),
          const SizedBox(height: 12),
          if (_availability.isEmpty)
            const Text('Aún no registras horarios de atención.'),
          if (_availability.isNotEmpty)
            Column(
              children:
                  _availability.map((slot) {
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                         '${_dayName(slot.diaSemana)} · ${_formatTimeForDisplay(slot.horaInicio)} - ${_formatTimeForDisplay(slot.horaFin)}',
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
                  child: Text(
                    'Inicio: ${_formatTimeForDisplay(_newSlotStart)}',
                  ),
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
              icon:
                  _addingAvailability
                      ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                      : const Icon(Icons.add),
              label: Text(
                _addingAvailability ? 'Agregando...' : 'Agregar horario',
              ),
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
              children:
                  _studies.map((assignment) {
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        assignment.estudio.displayName,
                      ),
                      subtitle: Text(
                        [
                              assignment.estudio.ruc,
                              assignment.estudio.formattedLocation,
                              assignment.rolEnEstudio,
                            ]
                            .where((value) => (value?.isNotEmpty ?? false))
                            .join(' • '),
                      ),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete, color: Colors.red),
                        onPressed: () => _deleteStudy(assignment),
                      ),
                      onTap: () {
                        _lawFirmRucController.text =
                            assignment.estudio.ruc ?? '';
                        setState(() {
                          _selectedLawFirm = assignment.estudio;
                          _lawFirmPrincipal = assignment.principal;
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
          TextField(
            controller: _lawFirmRucController,
            keyboardType: TextInputType.number,
            maxLength: 11,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: InputDecoration(
              labelText: 'RUC del estudio',
              counterText: '',
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            runSpacing: 8,
            children: [
              ElevatedButton.icon(
                onPressed:
                    (_lookingUpLawFirm || _savingLawFirm) ? null : _lookupLawFirmByRuc,
                icon: _lookingUpLawFirm
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.manage_search_rounded),
                label: Text(
                  _lookingUpLawFirm ? 'Buscando...' : 'Buscar registro',
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.buttonColor,
                  foregroundColor: Colors.white,
                ),
              ),
              OutlinedButton.icon(
                onPressed: _openStudySearch,
                icon: const Icon(Icons.list_alt),
                label: const Text('Ver registrados'),
              ),
              TextButton(
                onPressed: _clearLawFirmForm,
                child: const Text('Limpiar formulario'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_selectedLawFirm != null)
            _buildLawFirmSummaryCard(_selectedLawFirm!)
          else
            const Text(
              'Consulta el RUC del estudio o selecciona un registro existente para ver su información.',
            ),
          const SizedBox(height: 16),
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            title: const Text('Marcar como estudio principal'),
            value: _lawFirmPrincipal,
            onChanged: _selectedLawFirm == null
                ? null
                : (value) => setState(() => _lawFirmPrincipal = value),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: ElevatedButton.icon(
              onPressed:
                  (_savingLawFirm || _selectedLawFirm == null)
                      ? null
                      : _saveLawFirm,
              icon:
                  _savingLawFirm
                      ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                      : const Icon(Icons.save_as),
              label: Text(_savingLawFirm ? 'Guardando...' : 'Guardar estudio'),
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