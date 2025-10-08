import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../constants/colors.dart';
import '../../../models/client_contact_settings.dart';
import '../../../models/ubigeo_option.dart';
import '../../../services/api_client.dart';
import '../../../services/session_service.dart';
import '../../../widgets/custombtn.dart';
import '../../../widgets/shadow_card.dart';
import '../../authentication/login_screen.dart';

class ClientSettingsScreen extends StatefulWidget {
final ClientSettingsSubsection subsection;
  final bool embedded;

  const ClientSettingsScreen({
    super.key,
    this.subsection = ClientSettingsSubsection.overview,
    this.embedded = false,
  });
  @override
  State<ClientSettingsScreen> createState() => _ClientSettingsScreenState();
}

enum ClientSettingsSubsection { overview, contact, security }

class _ClientSettingsScreenState extends State<ClientSettingsScreen> {
  final GlobalKey<FormState> _contactFormKey = GlobalKey<FormState>();
  final GlobalKey<FormState> _passwordFormKey = GlobalKey<FormState>();

  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _lineaExactaController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmPasswordController =
      TextEditingController();

  bool _loading = true;
  bool _loadingDepartamentos = false;
  bool _loadingProvincias = false;
  bool _loadingDistritos = false;
  bool _savingContact = false;
  bool _savingPassword = false;
  late ClientSettingsSubsection _currentSubsection;


  List<UbigeoOption> _departamentos = const <UbigeoOption>[];
  List<UbigeoOption> _provincias = const <UbigeoOption>[];
  List<UbigeoOption> _distritos = const <UbigeoOption>[];

  String? _selectedDepartamentoCodigo;
  String? _selectedProvinciaCodigo;
  String? _selectedDistritoCodigo;

  ClientContactSettings? _initialSettings;

  @override
  void initState() {
    super.initState();
    _currentSubsection = widget.subsection;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadInitialData();
    });
  }
@override
  void didUpdateWidget(covariant ClientSettingsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.subsection != oldWidget.subsection) {
      setState(() {
        _currentSubsection = widget.subsection;
      });
    }
  }
  @override
  void dispose() {
    _phoneController.dispose();
    _emailController.dispose();
    _lineaExactaController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  bool get _isLoadingUbigeo =>
      _loadingDepartamentos || _loadingProvincias || _loadingDistritos;
   String? _formatUbigeo({
    String? departamento,
    String? provincia,
    String? distrito,
  }) {
    final parts = <String>[
      if ((departamento ?? '').trim().isNotEmpty) departamento!.trim(),
      if ((provincia ?? '').trim().isNotEmpty) provincia!.trim(),
      if ((distrito ?? '').trim().isNotEmpty) distrito!.trim(),
    ];

    if (parts.isEmpty) {
      return null;
    }

    return parts.join(' – ');
  }

  String? _findUbigeoName(List<UbigeoOption> options, String? codigo) {
    if (codigo == null) {
      return null;
    }
    for (final option in options) {
      if (option.codigo == codigo) {
        return option.nombre;
      }
    }
    return null;
  }

  String? get _selectedUbigeoDisplay {
    final departamento =
        _findUbigeoName(_departamentos, _selectedDepartamentoCodigo);
    final provincia = _findUbigeoName(_provincias, _selectedProvinciaCodigo);
    final distrito = _findUbigeoName(_distritos, _selectedDistritoCodigo);
    final fromSelection = _formatUbigeo(
      departamento: departamento,
      provincia: provincia,
      distrito: distrito,
    );
    if (fromSelection != null) {
      return fromSelection;
    }

    final settings = _initialSettings;
    if (settings == null) {
      return null;
    }
    return _formatUbigeo(
      departamento: settings.departamento,
      provincia: settings.provincia,
      distrito: settings.distrito,
    );
  }
  void _showSnack(
    String message, {
    Color color = AppColors.buttonColor,
  }) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: color),
    );
  }

  void _handleUnauthorized(String? message) {
    SessionService.instance.clear();
    if (!mounted) return;

    final resolvedMessage = (() {
      final trimmed = message?.trim();
      if (trimmed != null && trimmed.isNotEmpty) {
        return trimmed;
      }
      return 'Tu sesión ha expirado. Inicia sesión nuevamente.';
    })();

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(resolvedMessage),
        backgroundColor: AppColors.button2Color,
      ),
    );

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  Future<void> _loadInitialData() async {
    final session = SessionService.instance.session;
    if (session == null) {
      _handleUnauthorized('Tu sesión ha caducado.');
      return;
    }

    setState(() => _loading = true);
    try {
      final settings = await ApiClient.fetchClientContactSettings(
        token: session.token,
        userId: session.usuarioId,
      );

      if (!mounted) return;

      _initialSettings = settings;
      _phoneController.text = settings.telefono ?? '';
      _emailController.text = settings.correo;
      _lineaExactaController.text = settings.lineaExactaDireccion ?? '';

      await _loadDepartamentos();
      if (!mounted) return;

      await _preselectUbigeo(settings.direccionId);
    } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
      return;
    } catch (error) {
      _showSnack('No se pudo cargar la información del usuario.');
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _loadDepartamentos() async {
    setState(() => _loadingDepartamentos = true);
    try {
      final options = await ApiClient.fetchDepartamentos();
      if (!mounted) return;
      setState(() {
        _departamentos = options;
      });
    } catch (error) {
      _showSnack('No se pudieron cargar los departamentos.');
    } finally {
      if (mounted) {
        setState(() => _loadingDepartamentos = false);
      }
    }
  }

  Future<void> _loadProvincias(
    String departamentoCodigo, {
    String? preselect,
  }) async {
    setState(() {
      _loadingProvincias = true;
      _provincias = const <UbigeoOption>[];
      _distritos = const <UbigeoOption>[];
      if (preselect == null) {
        _selectedProvinciaCodigo = null;
        _selectedDistritoCodigo = null;
      }
    });

    try {
      final options = await ApiClient.fetchProvincias(departamentoCodigo);
      if (!mounted) return;
      setState(() {
        _provincias = options;
        if (preselect != null &&
            options.any((option) => option.codigo == preselect)) {
          _selectedProvinciaCodigo = preselect;
        }
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _selectedDepartamentoCodigo = null;
      });
      _showSnack('No se pudieron cargar las provincias.');
    } finally {
      if (mounted) {
        setState(() => _loadingProvincias = false);
      }
    }
  }

  Future<void> _loadDistritos(
    String provinciaCodigo, {
    String? preselect,
  }) async {
    setState(() {
      _loadingDistritos = true;
      _distritos = const <UbigeoOption>[];
      if (preselect == null) {
        _selectedDistritoCodigo = null;
      }
    });

    try {
      final options = await ApiClient.fetchDistritos(provinciaCodigo);
      if (!mounted) return;
      setState(() {
        _distritos = options;
        if (preselect != null &&
            options.any((option) => option.codigo == preselect)) {
          _selectedDistritoCodigo = preselect;
        }
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _selectedProvinciaCodigo = null;
      });
      _showSnack('No se pudieron cargar los distritos.');
    } finally {
      if (mounted) {
        setState(() => _loadingDistritos = false);
      }
    }
  }

  Future<void> _preselectUbigeo(String? direccionId) async {
    if (direccionId == null || direccionId.length < 2) {
      return;
    }

    final departamentoCodigo = direccionId.substring(0, 2);
    if (_departamentos.any(
      (departamento) => departamento.codigo == departamentoCodigo,
    )) {
      setState(() {
        _selectedDepartamentoCodigo = departamentoCodigo;
      });
      final provinciaCodigo =
          direccionId.length >= 4 ? direccionId.substring(0, 4) : null;
      if (provinciaCodigo != null) {
        await _loadProvincias(departamentoCodigo, preselect: provinciaCodigo);
        if (!mounted) return;
        final distritoCodigo =
            direccionId.length >= 6 ? direccionId.substring(0, 6) : null;
        if (distritoCodigo != null) {
          await _loadDistritos(provinciaCodigo, preselect: distritoCodigo);
        }
      }
    }
  }

  String? _validateEmail(String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) {
      return 'Ingresa un correo válido.';
    }
    final normalized = trimmed.toLowerCase();

    final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
    if (!emailRegex.hasMatch(normalized)) {
      return 'El correo electrónico no es válido.';
    }
    return null;
  }

  String? _validatePhone(String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) {
      return null;
    }
    final digits = trimmed.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 6) {
      return 'Ingresa al menos 6 dígitos.';
    }
    if (digits.length > 15) {
      return 'El teléfono no puede exceder los 15 dígitos.';
    }
    return null;
  }

  Future<void> _handleSaveContact() async {
    final formState = _contactFormKey.currentState;
    if (formState == null || !formState.validate()) {
      return;
    }

    final session = SessionService.instance.session;
    if (session == null) {
      _handleUnauthorized('Tu sesión ha caducado.');
      return;
    }

    final currentSettings = _initialSettings;
    if (currentSettings == null) {
      _showSnack('No se pudo determinar el estado actual.');
      return;
    }

    final rawTelefono = _phoneController.text.trim();
    final normalizedTelefono = rawTelefono.replaceAll(RegExp(r'\D'), '');
    final telefonoActual = (currentSettings.telefono ?? '').replaceAll(
      RegExp(r'\D'),
      '',
    );
    final trimmedCorreo = _emailController.text.trim();
    final normalizedCorreo = trimmedCorreo.toLowerCase();
    if (trimmedCorreo != normalizedCorreo) {
      _emailController.value = TextEditingValue(
        text: normalizedCorreo,
        selection: TextSelection.collapsed(offset: normalizedCorreo.length),
      );
    }
    final correoActual = currentSettings.correo.trim().toLowerCase();
    final lineaExacta = _lineaExactaController.text.trim();
    final lineaActual =
        (currentSettings.lineaExactaDireccion ?? '').trim().toLowerCase();

    final String? direccionId = _selectedDistritoCodigo;
    final direccionActual = currentSettings.direccionId;

    final bool telefonoChanged = normalizedTelefono != telefonoActual;
    final bool correoChanged = normalizedCorreo != correoActual;

    final bool direccionChanged = direccionId != direccionActual;
    final bool lineaChanged = lineaExacta.toLowerCase() != lineaActual;

    if (!(telefonoChanged ||
        correoChanged ||
        direccionChanged ||
        lineaChanged)) {
      _showSnack(
        'No se detectaron cambios para guardar.',
        color: AppColors.buttonColor,
      );
      return;
    }

    if (telefonoChanged || correoChanged) {
      try {
        final conflicts = await ApiClient.checkPersonaConflicts(
          telefono: telefonoChanged ? normalizedTelefono : null,
          correo: correoChanged ? normalizedCorreo : null,
        );
        if (telefonoChanged && conflicts.contains('telefono')) {
          _showSnack('El teléfono ya está registrado por otro usuario.');
          return;
        }
        if (correoChanged && conflicts.contains('correo')) {
          _showSnack('El correo ya está registrado por otro usuario.');
          return;
        }
      } catch (error) {
        _showSnack('No se pudieron validar los datos.');
        return;
      }
    }

    setState(() => _savingContact = true);
    try {
      final updated = await ApiClient.updateClientContactSettings(
        token: session.token,
        userId: session.usuarioId,
        telefono: telefonoChanged ? normalizedTelefono : null,
        correo: correoChanged ? normalizedCorreo : null,
        direccionId: direccionChanged ? direccionId : null,
        lineaExactaDireccion: lineaChanged ? lineaExacta : null,
      );

       final mergedSettings = currentSettings.copyWith(
        telefono: updated.telefono ?? currentSettings.telefono,
        correo:
            updated.correo.trim().isEmpty ? currentSettings.correo : updated.correo,
        direccionId: updated.direccionId ?? currentSettings.direccionId,
        lineaExactaDireccion:
            updated.lineaExactaDireccion ?? currentSettings.lineaExactaDireccion,
        departamento: updated.departamento ?? currentSettings.departamento,
        provincia: updated.provincia ?? currentSettings.provincia,
        distrito: updated.distrito ?? currentSettings.distrito,
      );

      final enhancedSettings = direccionChanged
          ? mergedSettings.copyWith(
              departamento: _findUbigeoName(
                    _departamentos,
                    _selectedDepartamentoCodigo,
                  ) ??
                  mergedSettings.departamento,
              provincia: _findUbigeoName(
                    _provincias,
                    _selectedProvinciaCodigo,
                  ) ??
                  mergedSettings.provincia,
              distrito: _findUbigeoName(
                    _distritos,
                    _selectedDistritoCodigo,
                  ) ??
                  mergedSettings.distrito,
            )
          : mergedSettings;

      _initialSettings = enhancedSettings;
      _phoneController.text = enhancedSettings.telefono ?? '';
      _emailController.text = enhancedSettings.correo;
      _lineaExactaController.text =
          enhancedSettings.lineaExactaDireccion ?? '';

      if (direccionChanged) {
        await _preselectUbigeo(enhancedSettings.direccionId);
      }

      SessionService.instance.setSession(
          session.copyWith(
          telefono: enhancedSettings.telefono,
          correo: enhancedSettings.correo,
        ),      );

      _showSnack(
        'Información actualizada correctamente.',
        color: AppColors.button2Color,
      );
    } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
      return;
    } on ApiException catch (error) {
      _showSnack(error.message);
    } catch (error) {
      _showSnack('No se pudieron guardar los cambios.');
    } finally {
      if (mounted) {
        setState(() => _savingContact = false);
      }
    }
  }

  Future<void> _handleSavePassword() async {
    final formState = _passwordFormKey.currentState;
    if (formState == null || !formState.validate()) {
      return;
    }

    final session = SessionService.instance.session;
    if (session == null) {
      _handleUnauthorized('Tu sesión ha caducado.');
      return;
    }

    setState(() => _savingPassword = true);
    try {
      await ApiClient.updateUserPassword(
        token: session.token,
        userId: session.usuarioId,
        password: _passwordController.text.trim(),
      );
      _passwordController.clear();
      _confirmPasswordController.clear();
      _showSnack(
        'Contraseña actualizada correctamente.',
        color: AppColors.buttonColor,
      );
    } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
      return;
    } on ApiException catch (error) {
      _showSnack(error.message);
    } catch (error) {
      _showSnack('No se pudo actualizar la contraseña.');
    } finally {
      if (mounted) {
        setState(() => _savingPassword = false);
      }
    }
  }

  DropdownButtonFormField<String> _buildUbigeoDropdown({
    required String label,
    required List<UbigeoOption> options,
    required String? value,
    required bool isLoading,
    required ValueChanged<String?> onChanged,
  }) {
    return DropdownButtonFormField<String>(
      value: options.any((option) => option.codigo == value) ? value : null,
      items:
          options
              .map(
                (option) => DropdownMenuItem<String>(
                  value: option.codigo,
                  child: Text(option.nombre),
                ),
              )
              .toList(),
      onChanged: isLoading ? null : onChanged,
      isExpanded: true,
      decoration: InputDecoration(
        labelText: label,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(
            color: AppColors.textFormFieldBorderColor,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(
            color: AppColors.textFormFieldBorderColor,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.button2Color, width: 2),
        ),
        filled: true,
        fillColor: AppColors.bgColor,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
      ),
    );
  }

  TextFormField _buildTextField({
    required TextEditingController controller,
    required String label,
    TextInputType? keyboardType,
    List<TextInputFormatter>? inputFormatters,
    int? maxLength,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      inputFormatters: inputFormatters,
      maxLength: maxLength,
      validator: validator,
      decoration: InputDecoration(
        labelText: label,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(
            color: AppColors.textFormFieldBorderColor,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(
            color: AppColors.textFormFieldBorderColor,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.button2Color, width: 2),
        ),
        filled: true,
        fillColor: AppColors.bgColor,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
      ),
    );
  }

  Widget _buildSummaryTile(
    String label,
    String? value, {
    bool editable = false,
  }) {
    final resolved = (value ?? '').trim();
    final displayValue = resolved.isEmpty ? 'Sin registrar' : resolved;
    final icon = editable ? Icons.edit_outlined : Icons.lock_outline;
    final iconColor = editable ? AppColors.buttonColor : AppColors.text2Color;
    return ListTile(
      dense: true,
      contentPadding: EdgeInsets.zero,
      title: Text(
        label,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: AppColors.buttonColor,
        ),
      ),
      subtitle: Text(
        displayValue,
        style: const TextStyle(fontSize: 14, color: AppColors.text2Color),
      ),
      trailing: Icon(icon, size: 18, color: iconColor),
    );
  }

  Widget _buildOverviewSection(ClientContactSettings settings) {
    final nombreCompleto = settings.nombreCompleto;
    final locationDisplay = _formatUbigeo(
      departamento: settings.departamento,
      provincia: settings.provincia,
      distrito: settings.distrito,
    );

    return KeyedSubtree(
      key: const ValueKey('overview'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ShadowCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Datos personales',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.buttonColor,
                  ),
                ),
                const SizedBox(height: 12),
                _buildSummaryTile(
                  'Nombre completo',
                  nombreCompleto.isEmpty ? null : nombreCompleto,
                ),
                const Divider(height: 20, color: AppColors.strokeColor),
                _buildSummaryTile('Primer nombre', settings.primerNombre),
                const Divider(height: 20, color: AppColors.strokeColor),
                _buildSummaryTile('Segundo nombre', settings.segundoNombre),
                const Divider(height: 20, color: AppColors.strokeColor),
                _buildSummaryTile('Apellido paterno', settings.apellidoPaterno),
                const Divider(height: 20, color: AppColors.strokeColor),
                _buildSummaryTile('Apellido materno', settings.apellidoMaterno),
                const Divider(height: 20, color: AppColors.strokeColor),
                _buildSummaryTile('Documento de identidad (DNI)', settings.dni),
              ],
            ),
          ),
          const SizedBox(height: 16),
          ShadowCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Contacto y ubicación',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.buttonColor,
                  ),
                ),
                const SizedBox(height: 12),
                _buildSummaryTile(
                  'Correo electrónico',
                  settings.correo,
                  editable: true,
                ),
                const Divider(height: 20, color: AppColors.strokeColor),
                _buildSummaryTile(
                  'Número de teléfono',
                  settings.telefono,
                  editable: true,
                ),
                const Divider(height: 20, color: AppColors.strokeColor),
                _buildSummaryTile('Ubigeo', locationDisplay, editable: true),
                const Divider(height: 20, color: AppColors.strokeColor),
                _buildSummaryTile(
                  'Código de distrito (UBIGEO)',
                  settings.direccionId,
                  editable: true,
                ),
                const Divider(height: 20, color: AppColors.strokeColor),
                _buildSummaryTile(
                  'Dirección exacta',
                  settings.lineaExactaDireccion,
                  editable: true,
                ),
                const Divider(height: 20, color: AppColors.strokeColor),
                _buildSummaryTile(
                  'Contraseña',
                  'Oculta por seguridad. Actualízala desde "Seguridad".',
                  editable: true,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContactSection() {
     final selectedUbigeo = _selectedUbigeoDisplay;
    final ubigeoDisplay = selectedUbigeo ?? 'Sin registrar';
    return KeyedSubtree(
      key: const ValueKey('contact'),
      child: ShadowCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Editar datos de contacto',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: AppColors.buttonColor,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Modifica tu correo, teléfono y dirección manteniendo el resto de tu perfil sin cambios.',
              style: TextStyle(
                fontSize: 13,
                color: AppColors.text2Color,
              ),
            ),
            const SizedBox(height: 18),
            Text(
              'Ubigeo seleccionado: $ubigeoDisplay',
              style: TextStyle(
                fontSize: 13,
                fontWeight:
                    selectedUbigeo != null ? FontWeight.w600 : FontWeight.w500,
                color: AppColors.buttonColor,
              ),
            ),
            const SizedBox(height: 12),
            Form(
              key: _contactFormKey,
              child: Column(
                children: [
                  _buildTextField(
                    controller: _phoneController,
                    label: 'Teléfono',
                    keyboardType: TextInputType.phone,
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(
                        RegExp(r'[0-9+\s-]'),
                      ),
                    ],
                    maxLength: 15,
                    validator: _validatePhone,
                  ),
                  const SizedBox(height: 12),
                  _buildTextField(
                    controller: _emailController,
                    label: 'Correo electrónico',
                    keyboardType: TextInputType.emailAddress,
                    validator: _validateEmail,
                  ),
                  const SizedBox(height: 12),
                  _buildUbigeoDropdown(
                    label: 'Departamento',
                    options: _departamentos,
                    value: _selectedDepartamentoCodigo,
                    isLoading: _loadingDepartamentos,
                    onChanged: (value) async {
                      if (value == null) {
                        setState(() {
                          _selectedDepartamentoCodigo = null;
                          _selectedProvinciaCodigo = null;
                          _selectedDistritoCodigo = null;
                          _provincias = const <UbigeoOption>[];
                          _distritos = const <UbigeoOption>[];
                        });
                        return;
                      }
                      setState(() {
                        _selectedDepartamentoCodigo = value;
                      });
                      await _loadProvincias(value);
                    },
                  ),
                  const SizedBox(height: 12),
                  _buildUbigeoDropdown(
                    label: 'Provincia',
                    options: _provincias,
                    value: _selectedProvinciaCodigo,
                    isLoading: _loadingProvincias,
                    onChanged: (value) async {
                      if (value == null) {
                        setState(() {
                          _selectedProvinciaCodigo = null;
                          _selectedDistritoCodigo = null;
                          _distritos = const <UbigeoOption>[];
                        });
                        return;
                      }
                      setState(() {
                        _selectedProvinciaCodigo = value;
                      });
                      await _loadDistritos(value);
                    },
                  ),
                  const SizedBox(height: 12),
                  _buildUbigeoDropdown(
                    label: 'Distrito',
                    options: _distritos,
                    value: _selectedDistritoCodigo,
                    isLoading: _loadingDistritos,
                    onChanged: (value) {
                      if (!_isLoadingUbigeo) {
                        setState(() {
                          _selectedDistritoCodigo = value;
                        });
                      }
                    },
                  ),
                  const SizedBox(height: 12),
                  _buildTextField(
                    controller: _lineaExactaController,
                    label: 'Dirección exacta',
                    keyboardType: TextInputType.streetAddress,
                  ),
                  const SizedBox(height: 20),
                  CustomButton(
                    text: _savingContact ? 'Guardando...' : 'Guardar cambios',
                    onTap: _savingContact ? null : _handleSaveContact,
                    color: _savingContact
                        ? AppColors.text2Color
                        : AppColors.buttonColor,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSecuritySection() {
    return KeyedSubtree(
      key: const ValueKey('security'),
      child: ShadowCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Actualizar contraseña',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: AppColors.buttonColor,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'La nueva contraseña reemplazará únicamente a tu clave de acceso.',
              style: TextStyle(
                fontSize: 13,
                color: AppColors.text2Color,
              ),
            ),
            const SizedBox(height: 18),
            Form(
              key: _passwordFormKey,
              child: Column(
                children: [
                  _buildTextField(
                    controller: _passwordController,
                    label: 'Nueva contraseña',
                    keyboardType: TextInputType.visiblePassword,
                    validator: (value) {
                      final trimmed = value?.trim() ?? '';
                      if (trimmed.length < 6) {
                        return 'La contraseña debe tener al menos 6 caracteres.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  _buildTextField(
                    controller: _confirmPasswordController,
                    label: 'Confirmar contraseña',
                    keyboardType: TextInputType.visiblePassword,
                    validator: (value) {
                      final trimmed = value?.trim() ?? '';
                      if (trimmed != _passwordController.text.trim()) {
                        return 'Las contraseñas no coinciden.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 20),
                  CustomButton(
                    text: _savingPassword
                        ? 'Actualizando...'
                        : 'Actualizar contraseña',
                    onTap: _savingPassword ? null : _handleSavePassword,
                    color: _savingPassword
                        ? AppColors.text2Color
                        : AppColors.button2Color,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  _SectionInfo _sectionInfoFor(ClientSettingsSubsection subsection) {
    switch (subsection) {
      case ClientSettingsSubsection.overview:
        return const _SectionInfo(
          title: 'Resumen general',
          description:
              'Consulta tus datos personales y de contacto registrados.',
        );
      case ClientSettingsSubsection.contact:
        return const _SectionInfo(
          title: 'Edición de datos de contacto',
          description: 'Actualiza tu correo, teléfono y dirección registrados.',
        );
      case ClientSettingsSubsection.security:
        return const _SectionInfo(
          title: 'Seguridad',
          description: 'Gestiona la contraseña de acceso a tu cuenta.',
        );
    }
  }

  Widget _buildContent(ClientContactSettings settings) {
    final sectionInfo = _sectionInfoFor(_currentSubsection);
    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Configura los datos de tu cuenta',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: AppColors.buttonColor,
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Selecciona cada bloque para consultar tu información o actualizar los datos permitidos.',
          style: TextStyle(
            fontSize: 13,
            color: AppColors.text2Color,
          ),
        ),
        const SizedBox(height: 24),
        Text(
          sectionInfo.title,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.buttonColor,
          ),
        ),
        if (sectionInfo.description != null) ...[
          const SizedBox(height: 6),
          Text(
            sectionInfo.description!,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.text2Color,
            ),
          ),
        ],
        const SizedBox(height: 18),
        IndexedStack(
          index: _currentSubsection.index,
          children: [
            _buildOverviewSection(settings),
            _buildContactSection(),
            _buildSecuritySection(),
          ],
        ),
      ],
    );

    if (widget.embedded) {
      return content;
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      child: content,
    );
  }

  @override
  Widget build(BuildContext context) {
    final settings = _initialSettings;
    final Widget content;
    if (_loading) {
      content = const Center(child: CircularProgressIndicator());
    } else if (settings == null) {
      content = const Center(
        child: Text(
          'No se pudo cargar la información del usuario.',
          style: TextStyle(color: AppColors.text2Color),
        ),
      );
    } else {
      content = _buildContent(settings);
    }

    if (widget.embedded) {
      return content;
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Configuración'),
        backgroundColor: AppColors.buttonColor,
        foregroundColor: AppColors.buttonTextColor,
      ),
      body: content,
    );
  }
}

class _SectionInfo {
  final String title;
  final String? description;

  const _SectionInfo({
    required this.title,
    this.description,
  });
}