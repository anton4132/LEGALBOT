import 'dart:io' as io;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../constants/colors.dart';
import '../../../models/lawyer_application.dart';
import '../../../models/user_session.dart';
import '../../../services/api_client.dart';
import '../../../services/session_service.dart';
import 'package:intl/intl.dart';


class BecomeLawyerScreen extends StatefulWidget {
  const BecomeLawyerScreen({super.key});

  @override
  State<BecomeLawyerScreen> createState() => _BecomeLawyerScreenState();
}

class _BecomeLawyerScreenState extends State<BecomeLawyerScreen> {
  final TextEditingController _linkedinController = TextEditingController();
  final TextEditingController _degreeLinkController = TextEditingController();
  final TextEditingController _colegiaturaNumeroController =
      TextEditingController();
  final TextEditingController _colegioNombreController =
      TextEditingController();
  final TextEditingController _colegioRegionController =
      TextEditingController();
  final TextEditingController _colegiaturaCarnetController =
      TextEditingController();
  final TextEditingController _colegiaturaFechaEmisionController =
      TextEditingController();
  final TextEditingController _colegiaturaFechaVigenciaHastaController =
      TextEditingController();
  final TextEditingController _colegiaturaCarnetNombreController =
      TextEditingController();
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final GlobalKey<FormFieldState<PlatformFile?>> _carnetFileFieldKey =
      GlobalKey<FormFieldState<PlatformFile?>>();

  static const int _maxCarnetFileSizeBytes = 5 * 1024 * 1024; // 5 MB
  static final DateFormat _dateFormatter = DateFormat('dd/MM/yyyy');
  static const List<String> _colegioRegiones = [
    'Amazonas',
    'Áncash',
    'Apurímac',
    'Arequipa',
    'Ayacucho',
    'Cajamarca',
    'Callao',
    'Cusco',
    'Huancavelica',
    'Huánuco',
    'Ica',
    'Junín',
    'La Libertad',
    'Lambayeque',
    'Lima Metropolitana',
    'Lima Provincias',
    'Loreto',
    'Madre de Dios',
    'Moquegua',
    'Pasco',
    'Piura',
    'Puno',
    'San Martín',
    'Tacna',
    'Tumbes',
    'Ucayali',
  ];

  LawyerApplicationStatus _status = LawyerApplicationStatus.empty;
  bool _isLoading = true;
  bool _isSubmitting = false;
  UserSession? _session;
  PlatformFile? _selectedCarnetFile;
  String? _existingCarnetFileName;
  DateTime? _colegiaturaFechaEmision;
  DateTime? _colegiaturaFechaVigenciaHasta;
  String? _selectedColegioRegion;

  @override
  void initState() {
    super.initState();
    _session = SessionService.instance.session;

    if (_session == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _showSnack('Debes iniciar sesión nuevamente.');
        Navigator.of(context).pop();
      });
      return;
    }

    if (_session!.hasLawyerAccount) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _showSnack('Ya cuentas con un rol de abogado activo.',
            color: AppColors.button2Color);
        Navigator.of(context).pop();
      });
      return;
    }

    _loadStatus();
  }

  @override
  void dispose() {
    _linkedinController.dispose();
    _degreeLinkController.dispose();
    _colegiaturaNumeroController.dispose();
    _colegioNombreController.dispose();
    _colegioRegionController.dispose();
    _colegiaturaCarnetController.dispose();
    _colegiaturaFechaEmisionController.dispose();
    _colegiaturaFechaVigenciaHastaController.dispose();
    _colegiaturaCarnetNombreController.dispose();
    super.dispose();
  }

  void _showSnack(String message, {Color color = Colors.red}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: color,
      ),
    );
  }

  void _populateFormFromStatus(LawyerApplicationStatus status) {
    _linkedinController.text = status.linkedinUrl ?? '';
    _degreeLinkController.text = status.tituloUrl ?? '';
    _colegiaturaNumeroController.text = status.colegiaturaNumero ?? '';
    _colegiaturaCarnetController.text = status.colegiaturaCarnet ?? '';
    _colegioNombreController.text = status.colegioNombre ?? '';

    _colegiaturaFechaEmision = status.colegiaturaFechaEmision;
    _colegiaturaFechaVigenciaHasta = status.colegiaturaFechaVigenciaHasta;
    _colegiaturaFechaEmisionController.text =
        _formatDate(_colegiaturaFechaEmision);
    _colegiaturaFechaVigenciaHastaController.text =
        _formatDate(_colegiaturaFechaVigenciaHasta);

    final carnetArchivoNombre = status.colegiaturaCarnetNombre?.trim();
    final carnetNombreDisplay = (carnetArchivoNombre != null &&
            carnetArchivoNombre.isNotEmpty)
        ? _extractFileName(carnetArchivoNombre)
        : '';
    _colegiaturaCarnetNombreController.text = carnetNombreDisplay;

    if (!mounted) {
      return;
    }

    setState(() {
      final region = status.colegioRegion;
      _selectedColegioRegion =
          (region != null && region.trim().isNotEmpty) ? region : null;
      _colegioRegionController.text = _selectedColegioRegion ?? '';

      final trimmedCarnetNombre = carnetArchivoNombre;
      _existingCarnetFileName = (trimmedCarnetNombre != null &&
              trimmedCarnetNombre.isNotEmpty)
          ? trimmedCarnetNombre
          : null;
      _selectedCarnetFile = null;
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _carnetFileFieldKey.currentState?.didChange(_selectedCarnetFile);
    });
  }

  String _extractFileName(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null) return url;
    if (uri.pathSegments.isNotEmpty) {
      return Uri.decodeComponent(uri.pathSegments.last);
    }
    return uri.path.isNotEmpty ? Uri.decodeComponent(uri.path) : url;
  }

  String _formatFileSize(int bytes) {
    if (bytes >= 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(2)} MB';
    }
    if (bytes >= 1024) {
      return '${(bytes / 1024).toStringAsFixed(1)} KB';
    }
    return '$bytes B';
  }

  String _formatDate(DateTime? date) {
    if (date == null) {
      return '';
    }
    return _dateFormatter.format(date);
  }

  DateTime? _parseFormDate(String? value) {
    final text = value?.trim();
    if (text == null || text.isEmpty) {
      return null;
    }
    try {
      return _dateFormatter.parseStrict(text);
    } catch (_) {
      return DateTime.tryParse(text);
    }
  }

  Future<void> _pickColegiaturaDate({
    required TextEditingController controller,
    required DateTime? currentValue,
    required ValueSetter<DateTime?> onSelected,
    DateTime? firstDate,
    DateTime? lastDate,
  }) async {
    if (!_status.canEdit || _isSubmitting || !mounted) {
      return;
    }

    FocusScope.of(context).unfocus();

    final DateTime now = DateTime.now();
    DateTime minDate = firstDate ?? DateTime(now.year - 80, 1, 1);
    DateTime maxDate = lastDate ?? DateTime(now.year + 10, 12, 31);

    if (minDate.isAfter(maxDate)) {
      maxDate = DateTime(minDate.year, minDate.month, minDate.day);
    }

    DateTime initialDate = currentValue ?? now;
    if (initialDate.isBefore(minDate)) {
      initialDate = minDate;
    } else if (initialDate.isAfter(maxDate)) {
      initialDate = maxDate;
    }

    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: minDate,
      lastDate: maxDate,
      helpText: 'Selecciona una fecha',
      cancelText: 'Cancelar',
      confirmText: 'Aceptar',
    );

    if (picked != null && mounted) {
      setState(() {
        onSelected(picked);
        controller.text = _formatDate(picked);
      });
    }
  }

  Future<void> _selectFechaEmision() async {
    await _pickColegiaturaDate(
      controller: _colegiaturaFechaEmisionController,
      currentValue: _colegiaturaFechaEmision,
      firstDate: DateTime(DateTime.now().year - 80, 1, 1),
      lastDate: DateTime(DateTime.now().year + 5, 12, 31),
      onSelected: (picked) {
        _colegiaturaFechaEmision = picked;
        if (_colegiaturaFechaVigenciaHasta != null &&
            picked != null &&
            _colegiaturaFechaVigenciaHasta!.isBefore(picked)) {
          _colegiaturaFechaVigenciaHasta = null;
          _colegiaturaFechaVigenciaHastaController.clear();
        }
      },
    );
  }

  Future<void> _selectFechaVigencia() async {
    final DateTime now = DateTime.now();
    final DateTime first = _colegiaturaFechaEmision ?? DateTime(now.year - 80, 1, 1);
    await _pickColegiaturaDate(
      controller: _colegiaturaFechaVigenciaHastaController,
      currentValue: _colegiaturaFechaVigenciaHasta ??
          (_colegiaturaFechaEmision != null
              ? _colegiaturaFechaEmision!
                  .add(const Duration(days: 1))
              : now),
      firstDate: first,
      lastDate: DateTime(now.year + 10, 12, 31),
      onSelected: (picked) {
        _colegiaturaFechaVigenciaHasta = picked;
      },
    );
  }


  Future<void> _pickCarnetFile(FormFieldState<PlatformFile?> field) async {
    if (!(_status.canEdit) || _isSubmitting) {
      return;
    }

    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png'],
        withData: kIsWeb,
      );

      if (!mounted || result == null || result.files.isEmpty) {
        return;
      }

      final PlatformFile file = result.files.single;
      if (file.size > _maxCarnetFileSizeBytes) {
        _showSnack(
          'El archivo supera el máximo permitido de ${_formatFileSize(_maxCarnetFileSizeBytes)}.',
        );
        return;
      }

      if (file.bytes == null && (file.path == null || file.path!.isEmpty)) {
        _showSnack('No se pudo leer el archivo seleccionado.');
        return;
      }

      setState(() {
        _selectedCarnetFile = file;
        _existingCarnetFileName = null;
        _colegiaturaCarnetNombreController.text = file.name;
      });
      field.didChange(file);
    } catch (error) {
      _showSnack('No se pudo seleccionar el archivo: $error');
    }
  }

  void _clearSelectedCarnetFile(FormFieldState<PlatformFile?> field) {
    setState(() {
      _selectedCarnetFile = null;
      _colegiaturaCarnetNombreController.text = _existingCarnetFileName != null
          ? _extractFileName(_existingCarnetFileName!)
          : '';
    });
    field.didChange(null);
  }

  Future<List<int>> _readCarnetFileBytes(PlatformFile file) async {
    if (file.bytes != null) {
      return file.bytes!;
    }
    if (!kIsWeb && file.path != null && file.path!.isNotEmpty) {
      final io.File localFile = io.File(file.path!);
      return localFile.readAsBytes();
    }
    throw Exception('No se pudo obtener el contenido del archivo seleccionado.');
  }

  Widget _buildCarnetFilePicker(bool canInteract) {
    return FormField<PlatformFile?>(
      key: _carnetFileFieldKey,
      enabled: canInteract,
      validator: (value) {
        final hasExisting = _existingCarnetFileName?.isNotEmpty ?? false;
        final hasNew = value != null ||
            _colegiaturaCarnetNombreController.text.trim().isNotEmpty;
        if (!hasExisting && !hasNew) {
          return 'Adjunta el archivo digital de tu carnet.';
        }
        return null;
      },
      builder: (field) {
        final hasValue = _colegiaturaCarnetNombreController.text.trim().isNotEmpty;
        final String helperText = hasValue
            ? _colegiaturaCarnetNombreController.text.trim()
            : 'Selecciona un archivo (PDF, JPG o PNG, máx. ${_formatFileSize(_maxCarnetFileSizeBytes)})';

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            InputDecorator(
              decoration: InputDecoration(
                labelText: 'Archivo digital del carnet',
                labelStyle:
                    const TextStyle(color: AppColors.textFormFieldLabelColor),
                prefixIcon: const Icon(Icons.upload_file_rounded,
                    color: AppColors.text2Color),
                enabled: canInteract,
                errorText: field.errorText,
                suffixIcon: canInteract
                    ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (_selectedCarnetFile != null)
                            IconButton(
                              tooltip: 'Quitar archivo',
                              icon: const Icon(Icons.close_rounded,
                                  color: AppColors.text2Color),
                              onPressed: () =>
                                  _clearSelectedCarnetFile(field),
                            ),
                          IconButton(
                            tooltip: 'Adjuntar archivo',
                            icon: const Icon(Icons.attach_file_rounded,
                                color: AppColors.text2Color),
                            onPressed: () => _pickCarnetFile(field),
                          ),
                        ],
                      )
                    : null,
              ),
              child: GestureDetector(
                onTap: canInteract ? () => _pickCarnetFile(field) : null,
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(vertical: 6.0, horizontal: 4),
                  child: Text(
                    helperText,
                    style: TextStyle(
                      color: hasValue
                          ? AppColors.text1Color
                          : AppColors.text2Color,
                    ),
                  ),
                ),
              ),
            ),
            if (_selectedCarnetFile != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  'Peso: ${_formatFileSize(_selectedCarnetFile!.size)}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.text2Color,
                  ),
                ),
              ),
            if ((_existingCarnetFileName?.isNotEmpty ?? false) &&
                _selectedCarnetFile == null)
              const Padding(
                padding: EdgeInsets.only(top: 6),
                child: Text(
                  'Se conservará el carnet digital previamente registrado. '
                  'Puedes adjuntar uno nuevo si necesitas actualizarlo.',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.text2Color,
                    height: 1.3,
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _buildStatusIndicator() {
    final LawyerApplicationStatus status = _status;

    IconData icon;
    Color color;
    String title;
    String description;

    switch (status.state) {
      case LawyerApplicationState.pendiente:
        icon = Icons.hourglass_top_rounded;
        color = AppColors.button2Color;
        title = 'Solicitud en revisión';
        description =
            'Nuestro equipo está evaluando la información que enviaste.';
        break;
      case LawyerApplicationState.observada:
        icon = Icons.error_outline_rounded;
        color = AppColors.text3Color;
        title = 'Solicitud con observaciones';
        description =
            'Revisa los comentarios y vuelve a enviar la información solicitada.';
        break;
      case LawyerApplicationState.aprobada:
        icon = Icons.verified_rounded;
        color = Colors.green;
        title = 'Solicitud aprobada';
        description =
            'Tu documentación fue validada. Activaremos tu perfil profesional en breve.';
        break;
      case LawyerApplicationState.rechazada:
        icon = Icons.highlight_off_rounded;
        color = Colors.redAccent;
        title = 'Solicitud rechazada';
        description =
            'Tu postulación no fue aprobada. Puedes comunicarte con soporte para más detalles.';
        break;
      case LawyerApplicationState.none:
      default:
        icon = Icons.info_outline_rounded;
        color = AppColors.text2Color;
        title = 'Sin estado disponible';
        description =
            'Aún no registramos movimientos en tu postulación de abogado.';
        break;
    }

    final String? observation = status.observation?.trim();
    final bool hasObservation = observation != null && observation.isNotEmpty;

    return Container(
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            decoration: BoxDecoration(
              color: color.withOpacity(0.18),
              shape: BoxShape.circle,
            ),
            padding: const EdgeInsets.all(10),
            child: Icon(icon, color: color, size: 26),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  description,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.text2Color,
                    height: 1.4,
                  ),
                ),
                if (hasObservation) ...[
                  const SizedBox(height: 10),
                  Container(
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: AppColors.buttonTextColor,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.strokeColor),
                    ),
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Observaciones',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: color,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          observation!,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.text1Color,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _loadStatus() async {
    final session = _session;
    if (session == null) return;

    setState(() => _isLoading = true);
    try {
      final status =
          await ApiClient.fetchLawyerApplicationStatus(token: session.token);
      SessionService.instance.updateApplication(status);
      setState(() {
        _status = status;
        _isLoading = false;
      });
      _populateFormFromStatus(status);
    } catch (error) {
      setState(() => _isLoading = false);
      final message = error.toString().replaceFirst('Exception: ', '');
      _showSnack(
        message.isEmpty
            ? 'No se pudo obtener el estado de tu solicitud'
            : message,
      );
    }
  }

  Future<void> _submitApplication() async {
    final session = _session;
    if (session == null) {
      return;
    }

    final isValid = _formKey.currentState!.validate();
    final bool isFileValid =
        _carnetFileFieldKey.currentState?.validate() ?? true;
    if (!isValid || !isFileValid) {
      return;
    }

    final linkedin = _linkedinController.text.trim();
    final degreeLink = _degreeLinkController.text.trim();
    final colegiaturaNumero = _colegiaturaNumeroController.text.trim();
    final colegiaturaCarnet = _colegiaturaCarnetController.text.trim();
    final colegioNombre = _colegioNombreController.text.trim();
    final colegioRegion = _colegioRegionController.text.trim().isNotEmpty
        ? _colegioRegionController.text.trim()
        : (_selectedColegioRegion ?? '');

     DateTime? fechaEmision = _colegiaturaFechaEmision;
    fechaEmision ??=
        _parseFormDate(_colegiaturaFechaEmisionController.text.trim());
    DateTime? fechaVigencia = _colegiaturaFechaVigenciaHasta;
    fechaVigencia ??=
        _parseFormDate(_colegiaturaFechaVigenciaHastaController.text.trim());

    if (fechaEmision == null || fechaVigencia == null) {
      _showSnack(
          'Selecciona las fechas de emisión y vigencia de tu carnet.');
      return;
    }

    if (fechaVigencia.isBefore(fechaEmision)) {
      _showSnack('La fecha de vigencia no puede ser anterior a la de emisión.');
      return;
    }

    final PlatformFile? carnetArchivo = _selectedCarnetFile;
    List<int>? carnetArchivoBytes;
    String? carnetArchivoNombre =
        _colegiaturaCarnetNombreController.text.trim();

    if (carnetArchivo != null) {
      try {
        carnetArchivoBytes = await _readCarnetFileBytes(carnetArchivo);
        carnetArchivoNombre = carnetArchivo.name;
      } catch (error) {
        _showSnack('No se pudo leer el archivo del carnet seleccionado: $error');
        return;
      }
    } else if (_existingCarnetFileName != null &&
        _existingCarnetFileName!.trim().isNotEmpty) {
      carnetArchivoNombre = _existingCarnetFileName!;
    }

    if (carnetArchivoNombre != null && carnetArchivoNombre.trim().isEmpty) {
      carnetArchivoNombre = null;
    }

    final String colegiaturaFechaEmision = fechaEmision.toIso8601String();
    final String colegiaturaFechaVigenciaHasta =
        fechaVigencia.toIso8601String();

    setState(() => _isSubmitting = true);
    try {
      final status = await ApiClient.submitLawyerApplication(
        token: session.token,
        linkedinUrl: linkedin,
        tituloUrl: degreeLink,
        colegiaturaNumero: colegiaturaNumero,
        colegioNombre: colegioNombre,
        colegioRegion: colegioRegion,
        colegiaturaCarnet: colegiaturaCarnet,
        colegiaturaFechaEmision: colegiaturaFechaEmision,
        colegiaturaFechaVigenciaHasta: colegiaturaFechaVigenciaHasta,
        colegiaturaCarnetNombre: carnetArchivoNombre,
        colegiaturaCarnetArchivoBytes: carnetArchivoBytes,
      );
      SessionService.instance.updateApplication(status);
      setState(() {
        _status = status;
        _isSubmitting = false;
      });
      _populateFormFromStatus(status);

      _showSnack(
        status.state == LawyerApplicationState.pendiente
            ? 'Solicitud enviada. Revisaremos tu información pronto.'
            : 'Solicitud actualizada correctamente.',
        color: AppColors.button2Color,
      );
    } catch (error) {
      setState(() => _isSubmitting = false);
      final message = error.toString().replaceFirst('Exception: ', '');
      _showSnack(
        message.isEmpty
            ? 'No se pudo enviar la solicitud'
            : message,
      );
    }
  }

    @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgColor,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: AppColors.bgColor,
        foregroundColor: AppColors.text1Color,
        title: const Text('Postular como Abogado'),
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new_rounded,
            color: AppColors.text1Color,
          ),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20.0),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: const [
                        Icon(Icons.workspace_premium_rounded,
                            color: AppColors.buttonColor, size: 26),
                        SizedBox(width: 10),
                        Text(
                          'Completa tu postulación',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            color: AppColors.buttonColor,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Envía tus datos para que nuestro equipo pueda verificar tu perfil profesional.',
                      style: TextStyle(
                        fontSize: 14,
                        color: AppColors.text2Color,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 24),
                    if (_status.state != LawyerApplicationState.none) ...[
                      _buildStatusIndicator(),
                      const SizedBox(height: 24),
                    ],
                    if (!_status.isFinalized) _buildApplicationForm(),
                    if (_status.isFinalized)
                      const Text(
                        'Tu solicitud ha sido cerrada. Si necesitas asistencia adicional, contacta a soporte.',
                        style: TextStyle(
                          color: AppColors.text2Color,
                          fontSize: 13,
                          height: 1.35,
                        ),
                      ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildApplicationForm() {
    final bool isEditable = _status.canEdit;
    final bool canInteract = isEditable && !_isSubmitting;

    final List<String> regionOptions = List<String>.from(_colegioRegiones);
    if (_selectedColegioRegion != null &&
        _selectedColegioRegion!.isNotEmpty &&
        !regionOptions.contains(_selectedColegioRegion)) {
      regionOptions.add(_selectedColegioRegion!);
    }


    return Container(
      decoration: BoxDecoration(
        color: AppColors.buttonTextColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.strokeColor),
      ),
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _linkedinController,
            enabled: canInteract,
            decoration: const InputDecoration(
              labelText: 'URL de tu perfil de LinkedIn',
              labelStyle: TextStyle(color: AppColors.textFormFieldLabelColor),
              prefixIcon: Icon(Icons.link_rounded, color: AppColors.text2Color),
              hintText: 'https://www.linkedin.com/in/usuario',
              hintStyle: TextStyle(color: AppColors.text2Color),
              enabledBorder: OutlineInputBorder(
                borderSide: BorderSide(color: AppColors.textFormFieldBorderColor),
                borderRadius: BorderRadius.all(Radius.circular(14)),
              ),
              focusedBorder: OutlineInputBorder(
                borderSide: BorderSide(color: AppColors.button2Color, width: 2),
                borderRadius: BorderRadius.all(Radius.circular(14)),
              ),
              filled: true,
              fillColor: AppColors.buttonTextColor,
              contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            ),
            validator: (value) {
              final trimmed = value?.trim() ?? '';
              if (trimmed.isEmpty || !trimmed.startsWith('http')) {
                return 'Por favor, introduce una URL válida.';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _degreeLinkController,
            enabled: canInteract,
            decoration: const InputDecoration(
              labelText: 'Link a tu Título (Google Drive, etc.)',
              labelStyle: TextStyle(color: AppColors.textFormFieldLabelColor),
              prefixIcon: Icon(Icons.school_rounded, color: AppColors.text2Color),
              hintText: 'Asegúrate de que sea un enlace público',
              hintStyle: TextStyle(color: AppColors.text2Color),
              enabledBorder: OutlineInputBorder(
                borderSide: BorderSide(color: AppColors.textFormFieldBorderColor),
                borderRadius: BorderRadius.all(Radius.circular(14)),
              ),
              focusedBorder: OutlineInputBorder(
                borderSide: BorderSide(color: AppColors.button2Color, width: 2),
                borderRadius: BorderRadius.all(Radius.circular(14)),
              ),
              filled: true,
              fillColor: AppColors.buttonTextColor,
              contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            ),
            validator: (value) {
              final trimmed = value?.trim() ?? '';
              if (trimmed.isEmpty || !trimmed.startsWith('http')) {
                return 'Por favor, introduce una URL válida.';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _colegioNombreController,
            enabled: canInteract,
            decoration: const InputDecoration(
              labelText: 'Colegio de Abogados',
              labelStyle: TextStyle(color: AppColors.textFormFieldLabelColor),
              prefixIcon:
                  Icon(Icons.account_balance_rounded, color: AppColors.text2Color),
              hintText: 'Ej. Ilustre Colegio de Abogados de Lima',
              hintStyle: TextStyle(color: AppColors.text2Color),
              enabledBorder: OutlineInputBorder(
                borderSide: BorderSide(color: AppColors.textFormFieldBorderColor),
                borderRadius: BorderRadius.all(Radius.circular(14)),
              ),
              focusedBorder: OutlineInputBorder(
                borderSide: BorderSide(color: AppColors.button2Color, width: 2),
                borderRadius: BorderRadius.all(Radius.circular(14)),
              ),
              filled: true,
              fillColor: AppColors.buttonTextColor,
              contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            ),
            validator: (value) {
              final trimmed = value?.trim() ?? '';
              if (trimmed.length < 3) {
                return 'Ingresa el nombre del colegio profesional.';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            value: (_selectedColegioRegion?.isNotEmpty ?? false)
                ? _selectedColegioRegion
                : null,
            decoration: const InputDecoration(
              labelText: 'Región del colegio',
              labelStyle: TextStyle(color: AppColors.textFormFieldLabelColor),
              prefixIcon: Icon(Icons.map_rounded, color: AppColors.text2Color),
              contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            ),
            items: regionOptions
                .map(
                  (region) => DropdownMenuItem<String>(
                    value: region,
                    child: Text(region),
                  ),
                )
                .toList(),
            onChanged: canInteract
                ? (value) {
                    setState(() {
                      _selectedColegioRegion = value;
                      _colegioRegionController.text = value ?? '';
                    });
                  }
                : null,
            validator: (value) {
              final text = (value ?? _colegioRegionController.text).trim();
              if (text.isEmpty) {
                return 'Selecciona la región del colegio.';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _colegiaturaNumeroController,
            enabled: canInteract,
            decoration: const InputDecoration(
              labelText: 'Número de colegiatura',
              labelStyle: TextStyle(color: AppColors.textFormFieldLabelColor),
              prefixIcon: Icon(Icons.badge_rounded, color: AppColors.text2Color),
              hintText: 'Ej. 12345',
              hintStyle: TextStyle(color: AppColors.text2Color),
              enabledBorder: OutlineInputBorder(
                borderSide: BorderSide(color: AppColors.textFormFieldBorderColor),
                borderRadius: BorderRadius.all(Radius.circular(14)),
              ),
              focusedBorder: OutlineInputBorder(
                borderSide: BorderSide(color: AppColors.button2Color, width: 2),
                borderRadius: BorderRadius.all(Radius.circular(14)),
              ),
              filled: true,
              fillColor: AppColors.buttonTextColor,
              contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            ),
            validator: (value) {
              final trimmed = value?.trim() ?? '';
              if (trimmed.isEmpty) {
                return 'Ingresa tu número de colegiatura.';
              }
              if (trimmed.length < 4) {
                return 'El número de colegiatura debe tener al menos 4 caracteres.';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
           TextFormField(
            controller: _colegiaturaCarnetController,
            enabled: canInteract,
            decoration: const InputDecoration(
              labelText: 'Número de carnet',
              labelStyle: TextStyle(color: AppColors.textFormFieldLabelColor),
              prefixIcon:
                  Icon(Icons.credit_card_rounded, color: AppColors.text2Color),
              hintText: 'Identificador de tu carnet profesional',
              hintStyle: TextStyle(color: AppColors.text2Color),
              enabledBorder: OutlineInputBorder(
                borderSide: BorderSide(color: AppColors.textFormFieldBorderColor),
                borderRadius: BorderRadius.all(Radius.circular(14)),
              ),
              focusedBorder: OutlineInputBorder(
                borderSide: BorderSide(color: AppColors.button2Color, width: 2),
                borderRadius: BorderRadius.all(Radius.circular(14)),
              ),
              filled: true,
              fillColor: AppColors.buttonTextColor,
              contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            ),
            validator: (value) {
              final trimmed = value?.trim() ?? '';
              if (trimmed.isEmpty) {
                return 'Ingresa el número de tu carnet profesional.';
              }
              if (trimmed.length < 3) {
                return 'El número de carnet debe tener al menos 3 caracteres.';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _colegiaturaFechaEmisionController,
            readOnly: true,
            enabled: canInteract,
            decoration: InputDecoration(
              labelText: 'Fecha de emisión del carnet',
              labelStyle:
                  const TextStyle(color: AppColors.textFormFieldLabelColor),
              prefixIcon: const Icon(Icons.event_available_rounded,
                  color: AppColors.text2Color),
              hintText: 'Selecciona la fecha de emisión',
              hintStyle: const TextStyle(color: AppColors.text2Color),
              enabledBorder: const OutlineInputBorder(
                borderSide: BorderSide(color: AppColors.textFormFieldBorderColor),
                borderRadius: BorderRadius.all(Radius.circular(14)),
              ),
              focusedBorder: const OutlineInputBorder(
                borderSide: BorderSide(color: AppColors.button2Color, width: 2),
                borderRadius: BorderRadius.all(Radius.circular(14)),
              ),
              filled: true,
              fillColor: AppColors.buttonTextColor,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              suffixIcon: IconButton(
                icon: const Icon(Icons.calendar_month_rounded,
                    color: AppColors.text2Color),
                onPressed: canInteract ? _selectFechaEmision : null,
              ),
            ),
            onTap: canInteract ? _selectFechaEmision : null,
            validator: (value) {
              final trimmed = value?.trim() ?? '';
              if (trimmed.isEmpty) {
                return 'Selecciona la fecha de emisión.';
              }
              if (_parseFormDate(trimmed) == null) {
                return 'Selecciona una fecha de emisión válida.';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _colegiaturaFechaVigenciaHastaController,
            readOnly: true,
            enabled: canInteract,
            decoration: InputDecoration(
              labelText: 'Vigencia del carnet (hasta)',
              labelStyle:
                  const TextStyle(color: AppColors.textFormFieldLabelColor),
              prefixIcon: const Icon(Icons.event_available,
                  color: AppColors.text2Color),
              hintText: 'Selecciona la fecha de vigencia',
              hintStyle: const TextStyle(color: AppColors.text2Color),
              enabledBorder: const OutlineInputBorder(
                borderSide: BorderSide(color: AppColors.textFormFieldBorderColor),
                borderRadius: BorderRadius.all(Radius.circular(14)),
              ),
              focusedBorder: const OutlineInputBorder(
                borderSide: BorderSide(color: AppColors.button2Color, width: 2),
                borderRadius: BorderRadius.all(Radius.circular(14)),
              ),
              filled: true,
              fillColor: AppColors.buttonTextColor,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              suffixIcon: IconButton(
                icon: const Icon(Icons.calendar_today_rounded,
                    color: AppColors.text2Color),
                onPressed: canInteract ? _selectFechaVigencia : null,
              ),
            ),
            onTap: canInteract ? _selectFechaVigencia : null,
            validator: (value) {
              final trimmed = value?.trim() ?? '';
              if (trimmed.isEmpty) {
                return 'Selecciona la fecha de vigencia.';
              }
              final parsed = _parseFormDate(trimmed);
              if (parsed == null) {
                return 'Selecciona una fecha de vigencia válida.';
              }
              final DateTime? emision =
                  _parseFormDate(_colegiaturaFechaEmisionController.text);
              if (emision != null && parsed.isBefore(emision)) {
                return 'La vigencia debe ser posterior a la fecha de emisión.';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          _buildCarnetFilePicker(canInteract),
          const SizedBox(height: 22),
          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: canInteract ? _submitApplication : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.buttonColor,
                foregroundColor: AppColors.buttonTextColor,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                elevation: 0,
              ),
              child: Text(
                _isSubmitting
                    ? 'Enviando...'
                    : (_status.state == LawyerApplicationState.observada
                        ? 'Reenviar solicitud'
                        : 'Enviar postulación'),
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  letterSpacing: .2,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}