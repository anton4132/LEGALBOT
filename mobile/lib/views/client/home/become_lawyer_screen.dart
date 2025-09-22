import 'dart:io' as io;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../constants/colors.dart';
import '../../../models/lawyer_application.dart';
import '../../../models/user_session.dart';
import '../../../services/api_client.dart';
import '../../../services/session_service.dart';

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
  final TextEditingController _colegiaturaEstadoController =
      TextEditingController();
  final TextEditingController _comprobanteUrlController =
      TextEditingController();
  final TextEditingController _colegioNombreController =
      TextEditingController();
  final TextEditingController _colegioRegionController =
      TextEditingController();
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final GlobalKey<FormFieldState<PlatformFile?>> _comprobanteFieldKey =
      GlobalKey<FormFieldState<PlatformFile?>>();

  static const int _maxComprobanteSizeBytes = 5 * 1024 * 1024; // 5 MB
  static const Map<String, String> _colegiaturaEstadoLabels = {
    'VIGENTE': 'Vigente',
    'SUSPENDIDA': 'Suspendida',
    'CANCELADA': 'Cancelada',
  };
  static const List<String> _colegiaturaEstados = [
    'VIGENTE',
    'SUSPENDIDA',
    'CANCELADA',
  ];
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
  PlatformFile? _selectedComprobante;
  String? _existingComprobanteUrl;
  String? _selectedColegiaturaEstado;
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
    _colegiaturaEstadoController.dispose();
    _comprobanteUrlController.dispose();
    _colegioNombreController.dispose();
    _colegioRegionController.dispose();
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
    _colegioNombreController.text = status.colegioNombre ?? '';

    if (!mounted) {
      return;
    }

    setState(() {
      final estado = status.colegiaturaEstado;
      final region = status.colegioRegion;
      final comprobante = status.colegiaturaComprobanteUrl;

      _selectedColegiaturaEstado =
          (estado != null && estado.trim().isNotEmpty) ? estado : null;
      _selectedColegioRegion =
          (region != null && region.trim().isNotEmpty) ? region : null;
      _colegiaturaEstadoController.text =
          _selectedColegiaturaEstado ?? '';
      _colegioRegionController.text = _selectedColegioRegion ?? '';

      _existingComprobanteUrl =
          (comprobante != null && comprobante.trim().isNotEmpty)
              ? comprobante
              : null;
      _selectedComprobante = null;
      _comprobanteUrlController.text = _existingComprobanteUrl != null
          ? _extractFileName(_existingComprobanteUrl!)
          : '';
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _comprobanteFieldKey.currentState?.didChange(_selectedComprobante);
    });
  }

  String _estadoLabel(String value) {
    final upper = value.toUpperCase();
    return _colegiaturaEstadoLabels[upper] ?? value;
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

  Future<void> _pickComprobante(FormFieldState<PlatformFile?> field) async {
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
      if (file.size > _maxComprobanteSizeBytes) {
        _showSnack(
          'El archivo supera el máximo permitido de ${_formatFileSize(_maxComprobanteSizeBytes)}.',
        );
        return;
      }

      if (file.bytes == null && (file.path == null || file.path!.isEmpty)) {
        _showSnack('No se pudo leer el archivo seleccionado.');
        return;
      }

      setState(() {
        _selectedComprobante = file;
        _existingComprobanteUrl = null;
        _comprobanteUrlController.text = file.name;
      });
      field.didChange(file);
    } catch (error) {
      _showSnack('No se pudo seleccionar el archivo: $error');
    }
  }

  void _clearSelectedComprobante(FormFieldState<PlatformFile?> field) {
    setState(() {
      _selectedComprobante = null;
      _comprobanteUrlController.text = _existingComprobanteUrl != null
          ? _extractFileName(_existingComprobanteUrl!)
          : '';
    });
    field.didChange(null);
  }

  Future<List<int>> _readComprobanteBytes(PlatformFile file) async {
    if (file.bytes != null) {
      return file.bytes!;
    }
    if (!kIsWeb && file.path != null && file.path!.isNotEmpty) {
      final io.File localFile = io.File(file.path!);
      return localFile.readAsBytes();
    }
    throw Exception('No se pudo obtener el contenido del comprobante seleccionado.');
  }

  Widget _buildComprobantePicker(bool canInteract) {
    return FormField<PlatformFile?>(
      key: _comprobanteFieldKey,
      enabled: canInteract,
      validator: (value) {
        final hasExisting = _existingComprobanteUrl?.isNotEmpty ?? false;
        if (!hasExisting && value == null) {
          return 'Adjunta el comprobante de tu colegiatura.';
        }
        return null;
      },
      builder: (field) {
        final hasValue = _comprobanteUrlController.text.trim().isNotEmpty;
        final String helperText = hasValue
            ? _comprobanteUrlController.text.trim()
            : 'Selecciona un archivo (PDF, JPG o PNG, máx. ${_formatFileSize(_maxComprobanteSizeBytes)})';

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            InputDecorator(
              decoration: InputDecoration(
                labelText: 'Comprobante de colegiatura',
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
                          if (_selectedComprobante != null)
                            IconButton(
                              tooltip: 'Quitar archivo',
                              icon: const Icon(Icons.close_rounded,
                                  color: AppColors.text2Color),
                              onPressed: () =>
                                  _clearSelectedComprobante(field),
                            ),
                          IconButton(
                            tooltip: 'Adjuntar archivo',
                            icon: const Icon(Icons.attach_file_rounded,
                                color: AppColors.text2Color),
                            onPressed: () => _pickComprobante(field),
                          ),
                        ],
                      )
                    : null,
              ),
              child: GestureDetector(
                onTap: canInteract ? () => _pickComprobante(field) : null,
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
            if (_selectedComprobante != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  'Peso: ${_formatFileSize(_selectedComprobante!.size)}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.text2Color,
                  ),
                ),
              ),
            if ((_existingComprobanteUrl?.isNotEmpty ?? false) &&
                _selectedComprobante == null)
              const Padding(
                padding: EdgeInsets.only(top: 6),
                child: Text(
                  'Se conservará el comprobante previamente registrado. '
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
    _comprobanteFieldKey.currentState?.validate();
    if (!isValid) {
      return;
    }

    final linkedin = _linkedinController.text.trim();
    final degreeLink = _degreeLinkController.text.trim();
    final colegiaturaNumero = _colegiaturaNumeroController.text.trim();
    final colegiaturaEstado = (_colegiaturaEstadoController.text.isNotEmpty
            ? _colegiaturaEstadoController.text
            : _selectedColegiaturaEstado ?? '')
        .toUpperCase();
    final colegioNombre = _colegioNombreController.text.trim();
    final colegioRegion = _colegioRegionController.text.trim().isNotEmpty
        ? _colegioRegionController.text.trim()
        : (_selectedColegioRegion ?? '');

    final PlatformFile? comprobante = _selectedComprobante;
    List<int>? comprobanteBytes;
    String? comprobanteNombre;
    if (comprobante != null) {
      try {
        comprobanteBytes = await _readComprobanteBytes(comprobante);
        comprobanteNombre = comprobante.name;
      } catch (error) {
        _showSnack('No se pudo leer el comprobante seleccionado: $error');
        return;
      }
    }

    final String? colegiaturaComprobanteUrl =
        comprobante == null ? _existingComprobanteUrl : null;

    setState(() => _isSubmitting = true);
    try {
      final status = await ApiClient.submitLawyerApplication(
        token: session.token,
        linkedinUrl: linkedin,
        tituloUrl: degreeLink,
        colegiaturaNumero: colegiaturaNumero,
        colegiaturaEstado: colegiaturaEstado,
        colegioNombre: colegioNombre,
        colegioRegion: colegioRegion,
        colegiaturaComprobanteUrl: colegiaturaComprobanteUrl,
        comprobanteArchivoBytes: comprobanteBytes,
        comprobanteArchivoNombre: comprobanteNombre,
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

    final List<String> estadoOptions = List<String>.from(_colegiaturaEstados);
    if (_selectedColegiaturaEstado != null &&
        _selectedColegiaturaEstado!.isNotEmpty &&
        !estadoOptions.contains(_selectedColegiaturaEstado)) {
      estadoOptions.add(_selectedColegiaturaEstado!);
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
          DropdownButtonFormField<String>(
            value: (_selectedColegiaturaEstado?.isNotEmpty ?? false)
                ? _selectedColegiaturaEstado
                : null,
            decoration: const InputDecoration(
              labelText: 'Estado de la colegiatura',
              labelStyle: TextStyle(color: AppColors.textFormFieldLabelColor),
              prefixIcon: Icon(Icons.verified_user_rounded,
                  color: AppColors.text2Color),
              contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            ),
            items: estadoOptions
                .map(
                  (estado) => DropdownMenuItem<String>(
                    value: estado,
                    child: Text(_estadoLabel(estado)),
                  ),
                )
                .toList(),
            onChanged: canInteract
                ? (value) {
                    setState(() {
                      _selectedColegiaturaEstado = value;
                      _colegiaturaEstadoController.text = value ?? '';
                    });
                  }
                : null,
            validator: (value) {
              final text = (value ?? _colegiaturaEstadoController.text).trim();
              if (text.isEmpty) {
                return 'Selecciona el estado de tu colegiatura.';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          _buildComprobantePicker(canInteract),
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