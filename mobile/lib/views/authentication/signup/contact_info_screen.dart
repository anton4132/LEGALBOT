import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../constants/colors.dart';
import '../../../widgets/custombtn.dart';
import '../../../services/api_client.dart';
import '../../../models/ubigeo_option.dart';
import '../../../models/dni_lookup_result.dart';
import 'personal_info_screen.dart';

class ContactInfoScreen extends StatefulWidget {
  final String userType;

  const ContactInfoScreen({super.key, required this.userType});

  @override
  State<ContactInfoScreen> createState() => _ContactInfoScreenState();
}

class _ContactInfoScreenState extends State<ContactInfoScreen> {
  final TextEditingController _dniController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _direccionExactaController =
      TextEditingController();
  final TextEditingController _emailCodeController = TextEditingController();

  final RegExp _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  List<UbigeoOption> _departamentos = const <UbigeoOption>[];
  List<UbigeoOption> _provincias = const <UbigeoOption>[];
  List<UbigeoOption> _distritos = const <UbigeoOption>[];

  String? _selectedDepartamentoCodigo;
  String? _selectedProvinciaCodigo;
  String? _selectedDistritoCodigo;

  bool _loadingDepartamentos = false;
  bool _loadingProvincias = false;
  bool _loadingDistritos = false;

  bool _verificandoIdentidad = false;
  bool _buscandoDni = false;
  String? _dniError;
  String? _lastConsultedDni;
  DniLookupResult? _dniLookup;
  bool _isCheckingEmailExistence = false;
  bool _isSendingEmailCode = false;
  bool _isVerifyingEmailCode = false;
  bool _emailCodeSent = false;
  bool _emailVerified = false;
  String? _emailError;
  String? _emailCodeError;
  String? _emailUsedForCode;
  String? _verifiedEmail;
  DateTime? _emailCodeSentAt;
  DateTime? _emailCodeExpiration;

  @override
  void initState() {
    super.initState();
    _loadDepartamentos();
  }

  bool get _isLoadingUbigeo =>
      _loadingDepartamentos || _loadingProvincias || _loadingDistritos;

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
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

  Future<void> _loadProvincias(String departamentoCodigo) async {
    setState(() {
      _loadingProvincias = true;
      _provincias = const <UbigeoOption>[];
      _distritos = const <UbigeoOption>[];
      _selectedProvinciaCodigo = null;
      _selectedDistritoCodigo = null;
    });
    try {
      final options = await ApiClient.fetchProvincias(departamentoCodigo);
      if (!mounted) return;
      setState(() {
        _provincias = options;
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

  Future<void> _loadDistritos(String provinciaCodigo) async {
    setState(() {
      _loadingDistritos = true;
      _distritos = const <UbigeoOption>[];
      _selectedDistritoCodigo = null;
    });
    try {
      final options = await ApiClient.fetchDistritos(provinciaCodigo);
      if (!mounted) return;
      setState(() {
        _distritos = options;
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

  Widget _buildCustomTextField({
    required TextEditingController controller,
    required String label,
    TextInputType? keyboardType,
    List<TextInputFormatter>? inputFormatters,
    int? maxLength,
    bool enabled = true,
    ValueChanged<String>? onChanged,
    Widget? suffixIcon,
    String? helperText,
    String? errorText,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        inputFormatters: inputFormatters,
        maxLength: maxLength,
        enabled: enabled,
        onChanged: onChanged,
        decoration: InputDecoration(
          labelText: label,
          errorText: errorText,
          helperText: helperText,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade300),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade300),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: AppColors.buttonColor, width: 2),
          ),
          filled: true,
          fillColor: Colors.grey.shade50,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 16,
          ),
          suffixIcon: suffixIcon,
        ),
      ),
    );
  }

  Widget _buildUbigeoDropdown({
    required String label,
    required String? value,
    required List<UbigeoOption> options,
    required bool isLoading,
    required ValueChanged<String?> onChanged,
    bool enabled = true,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      child: DropdownButtonFormField<String>(
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
        onChanged: !enabled || isLoading ? null : onChanged,
        isExpanded: true,
        decoration: InputDecoration(
          labelText: label,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade300),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade300),
          ),
          focusedBorder: const OutlineInputBorder(
            borderRadius: BorderRadius.all(Radius.circular(12)),
            borderSide: BorderSide(color: AppColors.buttonColor, width: 2),
          ),
          filled: true,
          fillColor: Colors.grey.shade50,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 4,
          ),
          suffixIcon:
              isLoading
                  ? const Padding(
                    padding: EdgeInsets.all(12.0),
                    child: SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                  : null,
        ),
      ),
    );
  }

  String _digitsOnly(String value) => value.replaceAll(RegExp(r'\D'), '');

  String _normalizeEmail(String value) => value.trim().toLowerCase();

  bool _isValidEmailFormat(String value) =>
      value.isNotEmpty && _emailPattern.hasMatch(value);

  void _handleEmailChanged(String value) {
    final normalized = _normalizeEmail(value);
    final shouldResetCode =
        _emailUsedForCode != null && normalized != _emailUsedForCode;
    final shouldResetVerification =
        _verifiedEmail != null && normalized != _verifiedEmail;
    final shouldClearErrors = _emailError != null || _emailCodeError != null;

    if (!shouldResetCode && !shouldResetVerification && !shouldClearErrors) {
      return;
    }

    setState(() {
      if (shouldResetVerification) {
        _emailVerified = false;
        _verifiedEmail = null;
      }
      if (shouldResetCode) {
        _emailCodeSent = false;
        _emailUsedForCode = null;
        _emailCodeController.clear();
        _emailCodeSentAt = null;
        _emailCodeExpiration = null;
      }
      if (shouldClearErrors) {
        _emailError = null;
        _emailCodeError = null;
      }
    });
  }

  void _handleDniChanged(String value) {
    final digits = _digitsOnly(value);
    if (digits.length == 8) {
      _ensureDniLookup(showErrors: false);
    } else {
      if (_dniLookup != null || _dniError != null) {
        setState(() {
          _dniLookup = null;
          _dniError = null;
          _lastConsultedDni = null;
        });
      }
    }
  }

  Future<DniLookupResult?> _ensureDniLookup({bool showErrors = true}) async {
    final dni = _digitsOnly(_dniController.text);
    if (dni.length != 8) {
      if (showErrors) {
        setState(() {
          _dniError = 'Ingresa un DNI válido';
        });
      }
      return null;
    }

    if (_dniLookup != null && _lastConsultedDni == dni) {
      return _dniLookup;
    }

    return _lookupDni(dni, showErrors: showErrors);
  }

  Future<DniLookupResult?> _lookupDni(
    String dni, {
    bool showErrors = true,
  }) async {
    setState(() {
      _buscandoDni = true;
      _dniError = null;
    });

    try {
      final result = await ApiClient.lookupDni(dni);
      if (!mounted) return null;
      setState(() {
        _dniLookup = result;
        _lastConsultedDni = dni;
      });
      return result;
    } on ApiException catch (error) {
      if (!mounted) return null;
      final message =
          error.message.isNotEmpty
              ? error.message
              : 'No se pudo verificar el DNI proporcionado.';
      setState(() {
        _dniLookup = null;
        _lastConsultedDni = null;
        _dniError = message;
      });
      if (showErrors) {
        _showSnack(message);
      }
    } catch (error) {
      if (!mounted) return null;
      final message = error.toString().replaceFirst('Exception: ', '');
      final fallback =
          message.isNotEmpty
              ? message
              : 'Ocurrió un error al consultar el DNI.';
      setState(() {
        _dniLookup = null;
        _lastConsultedDni = null;
        _dniError = fallback;
      });
      if (showErrors) {
        _showSnack(fallback);
      }
    } finally {
      if (mounted) {
        setState(() => _buscandoDni = false);
      }
    }

    return null;
  }

  Future<void> _sendEmailVerificationCode() async {
    FocusScope.of(context).unfocus();
    final normalizedEmail = _normalizeEmail(_emailController.text);

    if (normalizedEmail.isEmpty) {
      setState(() {
        _emailError = 'Ingresa tu correo electrónico';
      });
      _showSnack('Ingresa tu correo electrónico');
      return;
    }

    if (!_isValidEmailFormat(normalizedEmail)) {
      setState(() {
        _emailError = 'Ingresa un correo electrónico válido';
      });
      _showSnack('Ingresa un correo electrónico válido');
      return;
    }

    setState(() {
      _isCheckingEmailExistence = true;
      _emailError = null;
      _emailCodeError = null;
    });

    try {
      await ApiClient.validateEmailDeliverability(correo: normalizedEmail);
    } on ApiException catch (error) {
      if (!mounted) return;
      final message =
          error.message.isNotEmpty
              ? error.message
              : 'No se pudo verificar el correo proporcionado.';
      setState(() {
        _emailError = message;
      });
      _showSnack(message);
      return;
    } catch (error) {
      if (!mounted) return;
      final message = error.toString().replaceFirst('Exception: ', '');
      final fallback =
          message.isNotEmpty
              ? message
              : 'No se pudo verificar el correo proporcionado.';
      setState(() {
        _emailError = fallback;
      });
      _showSnack(fallback);
      return;
    } finally {
      if (mounted) {
        setState(() => _isCheckingEmailExistence = false);
      }
    }

    if (!mounted) return;

    setState(() => _isSendingEmailCode = true);

    try {
      final expiration = await ApiClient.requestEmailVerificationCode(
        correo: normalizedEmail,
      );
      if (!mounted) return;
      setState(() {
        _emailCodeSent = true;
        _emailVerified = false;
        _verifiedEmail = null;
        _emailUsedForCode = normalizedEmail;
        _emailCodeController.clear();
        _emailCodeSentAt = DateTime.now();
        _emailCodeExpiration = expiration;
        _emailCodeError = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Hemos enviado un código de verificación a $normalizedEmail',
          ),
          backgroundColor: Colors.green,
        ),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      final message =
          error.message.isNotEmpty
              ? error.message
              : 'No se pudo enviar el código de verificación.';
      setState(() {
        _emailError = message;
      });
      _showSnack(message);
    } catch (error) {
      if (!mounted) return;
      final message = error.toString().replaceFirst('Exception: ', '');
      final fallback =
          message.isNotEmpty
              ? message
              : 'No se pudo enviar el código de verificación.';
      setState(() {
        _emailError = fallback;
      });
      _showSnack(fallback);
    } finally {
      if (mounted) {
        setState(() => _isSendingEmailCode = false);
      }
    }
  }

  Future<void> _verifyEmailCode() async {
    FocusScope.of(context).unfocus();
    final normalizedEmail = _normalizeEmail(_emailController.text);
    if (!_emailCodeSent || _emailUsedForCode == null) {
      _showSnack('Primero solicita un código de verificación.');
      setState(() {
        _emailCodeError = 'Solicita un código antes de verificar.';
      });
      return;
    }

    if (normalizedEmail != _emailUsedForCode) {
      _showSnack('Solicita un nuevo código para el correo actualizado.');
      setState(() {
        _emailCodeError =
            'Solicita un nuevo código para el correo actualizado.';
      });
      return;
    }

    if (!_isValidEmailFormat(normalizedEmail)) {
      setState(() {
        _emailError = 'Ingresa un correo electrónico válido';
      });
      _showSnack('Ingresa un correo electrónico válido');
      return;
    }

    final code = _emailCodeController.text.trim();
    if (code.isEmpty) {
      setState(() {
        _emailCodeError = 'Ingresa el código de verificación';
      });
      _showSnack('Ingresa el código de verificación');
      return;
    }

    if (code.length < 6) {
      setState(() {
        _emailCodeError = 'El código debe tener al menos 6 dígitos';
      });
      _showSnack('El código debe tener al menos 6 dígitos');
      return;
    }

    setState(() {
      _isVerifyingEmailCode = true;
      _emailCodeError = null;
    });

    try {
      await ApiClient.verifyEmailVerificationCode(
        correo: normalizedEmail,
        codigo: code,
      );
      if (!mounted) return;
      setState(() {
        _emailVerified = true;
        _verifiedEmail = normalizedEmail;
        _emailCodeError = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Correo verificado correctamente.'),
          backgroundColor: Colors.green,
        ),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      final message =
          error.message.isNotEmpty
              ? error.message
              : 'Código incorrecto o expirado.';
      setState(() {
        _emailVerified = false;
        _verifiedEmail = null;
        _emailCodeError = message;
      });
      _showSnack(message);
    } catch (error) {
      if (!mounted) return;
      final message = error.toString().replaceFirst('Exception: ', '');
      final fallback =
          message.isNotEmpty
              ? message
              : 'No se pudo verificar el código proporcionado.';
      setState(() {
        _emailVerified = false;
        _verifiedEmail = null;
        _emailCodeError = fallback;
      });
      _showSnack(fallback);
    } finally {
      if (mounted) {
        setState(() => _isVerifyingEmailCode = false);
      }
    }
  }

  Future<void> _nextStep() async {
    if (!_validateFields()) return;

    final normalizedDni = _digitsOnly(_dniController.text);
    final normalizedTelefono = _digitsOnly(_phoneController.text);
    final normalizedCorreo = _normalizeEmail(_emailController.text);

    setState(() {
      _verificandoIdentidad = true;
      _dniError = null;
    });

    try {
      final dniLookup = await _ensureDniLookup();
      if (dniLookup == null) {
        return;
      }

      final conflicts = await ApiClient.checkPersonaConflicts(
        dni: normalizedDni,
        telefono: normalizedTelefono,
        correo: normalizedCorreo,
      );

      if (conflicts.contains('dni')) {
        _showSnack('DNI ya registrado');
        return;
      }
      if (conflicts.contains('telefono')) {
        _showSnack('Teléfono ya registrado');
        return;
      }
      if (conflicts.contains('correo')) {
        _showSnack('Correo ya registrado');
        return;
      }

      if (!mounted) return;

      final contactInfo = {
        'dni': normalizedDni,
        'phone': normalizedTelefono,
        'email': normalizedCorreo,
        'ubigeoCodigo': _selectedDistritoCodigo ?? '',
        'lineaExactaDireccion': _direccionExactaController.text.trim(),
      };

      final personalInfo = {
        'primerNombre': dniLookup.primerNombre.trim(),
        'segundoNombre': dniLookup.segundoNombre.trim(),
        'apellidoPaterno': dniLookup.apellidoPaterno.trim(),
        'apellidoMaterno': dniLookup.apellidoMaterno.trim(),
      };

      final verificationTimestamp = DateTime.now().toIso8601String();
      final emailVerification = <String, dynamic>{
        'email': normalizedCorreo,
        'verified': true,
        'verifiedAt': verificationTimestamp,
      };
      if (_emailCodeSentAt != null) {
        emailVerification['codeSentAt'] = _emailCodeSentAt!.toIso8601String();
      }
      if (_emailCodeExpiration != null) {
        emailVerification['codeExpiresAt'] =
            _emailCodeExpiration!.toIso8601String();
      }

      final verification = {
        'dniMatch': true,
        'conflictsCleared': true,
        'dniLookup': {
          'numero': dniLookup.numero,
          'primerNombre': dniLookup.primerNombre,
          'segundoNombre': dniLookup.segundoNombre,
          'apellidoPaterno': dniLookup.apellidoPaterno,
          'apellidoMaterno': dniLookup.apellidoMaterno,
        },
        'verifiedAt': verificationTimestamp,
        'emailVerification': emailVerification,
      };
      Navigator.push(
        context,
        MaterialPageRoute(
          builder:
              (context) => PersonalInfoScreen(
                userType: widget.userType,
                personalInfo: personalInfo,
                contactInfo: contactInfo,
                verification: verification,
              ),
        ),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      final message =
          error.message.isNotEmpty
              ? error.message
              : 'No se pudo verificar los datos ingresados';
      _showSnack(message);
    } catch (error) {
      if (!mounted) return;
      final message = error.toString().replaceFirst('Exception: ', '');
      _showSnack(
        message.isNotEmpty
            ? message
            : 'Ocurrió un error al verificar tus datos. Inténtalo nuevamente.',
      );
    } finally {
      if (mounted) {
        setState(() => _verificandoIdentidad = false);
      }
    }
  }

  bool _validateFields() {
    if (_dniController.text.isEmpty ||
        _phoneController.text.isEmpty ||
        _emailController.text.isEmpty ||
        _selectedDepartamentoCodigo == null ||
        _selectedProvinciaCodigo == null ||
        _selectedDistritoCodigo == null ||
        _direccionExactaController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Por favor completa todos los campos obligatorios'),
          backgroundColor: Colors.red,
        ),
      );
      return false;
    }

    final normalizedEmail = _normalizeEmail(_emailController.text);
    if (!_isValidEmailFormat(normalizedEmail)) {
      setState(() {
        _emailError = 'Ingresa un correo electrónico válido';
      });
      _showSnack('Ingresa un correo electrónico válido');
      return false;
    }

    if (!_emailVerified || _verifiedEmail != normalizedEmail) {
      setState(() {
        _emailCodeError = 'Debes verificar tu correo antes de continuar.';
      });
      _showSnack('Debes verificar tu correo antes de continuar.');
      return false;
    }

    return true;
  }

  @override
  void dispose() {
    _dniController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _emailCodeController.dispose();
    _direccionExactaController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bool isProcessing =
        _isLoadingUbigeo ||
        _verificandoIdentidad ||
        _buscandoDni ||
        _isCheckingEmailExistence ||
        _isSendingEmailCode ||
        _isVerifyingEmailCode;
    final String primaryButtonText;
    if (_isLoadingUbigeo) {
      primaryButtonText = 'Cargando ubicaciones...';
    } else if (_verificandoIdentidad) {
      primaryButtonText = 'Verificando datos...';
    } else if (_buscandoDni) {
      primaryButtonText = 'Consultando DNI...';
    } else if (_isVerifyingEmailCode) {
      primaryButtonText = 'Verificando correo...';
    } else if (_isCheckingEmailExistence || _isSendingEmailCode) {
      primaryButtonText = 'Procesando correo...';
    } else {
      primaryButtonText = 'Siguiente';
    }
    final Color primaryButtonColor =
        isProcessing ? Colors.grey.shade400 : AppColors.buttonColor;

    final dniLookup = _dniLookup;
    final String? dniHelperText;
    if (dniLookup != null && _dniError == null) {
      final parts =
          [
                dniLookup.primerNombre,
                dniLookup.segundoNombre,
                dniLookup.apellidoPaterno,
                dniLookup.apellidoMaterno,
              ]
              .map((value) => value.trim())
              .where((value) => value.isNotEmpty)
              .toList();
      dniHelperText = parts.isEmpty ? null : 'Se encontró: ${parts.join(' ')}';
    } else {
      dniHelperText = null;
    }

    Widget? dniSuffixIcon;
    if (_buscandoDni) {
      dniSuffixIcon = const Padding(
        padding: EdgeInsets.all(12.0),
        child: SizedBox(
          width: 16,
          height: 16,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    } else if (dniLookup != null && _dniError == null) {
      dniSuffixIcon = const Icon(Icons.verified, color: Colors.green);
    }

    final trimmedEmail = _emailController.text.trim();
    final emailDisplay =
        trimmedEmail.isNotEmpty ? trimmedEmail : (_emailUsedForCode ?? '');
    final bool showEmailCodeField = _emailCodeSent || _emailVerified;
    String? emailHelperText;
    if (_emailVerified && _verifiedEmail != null) {
      emailHelperText = 'Correo verificado correctamente.';
    } else if (_emailCodeSent) {
      final expiration = _emailCodeExpiration;
      if (expiration != null) {
        final remaining = expiration.difference(DateTime.now());
        if (remaining.isNegative) {
          emailHelperText =
              'Hemos enviado un código de verificación a $emailDisplay. Solicita uno nuevo si expiró.';
        } else {
          emailHelperText =
              'Hemos enviado un código de verificación a $emailDisplay. Ingresa el código recibido.';
        }
      } else {
        emailHelperText =
            'Hemos enviado un código de verificación a $emailDisplay. Ingresa el código recibido.';
      }
    }

    Widget? emailSuffixIcon;
    if (_isCheckingEmailExistence || _isSendingEmailCode) {
      emailSuffixIcon = const Padding(
        padding: EdgeInsets.all(12.0),
        child: SizedBox(
          width: 16,
          height: 16,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation<Color>(AppColors.buttonColor),
          ),
        ),
      );
    } else if (_emailVerified) {
      emailSuffixIcon = const Icon(Icons.verified, color: Colors.green);
    } else if (_emailCodeSent) {
      emailSuffixIcon = const Icon(
        Icons.mark_email_unread,
        color: AppColors.buttonColor,
      );
    }

    Widget? emailCodeSuffixIcon;
    if (_isVerifyingEmailCode) {
      emailCodeSuffixIcon = const Padding(
        padding: EdgeInsets.all(12.0),
        child: SizedBox(
          width: 16,
          height: 16,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation<Color>(AppColors.buttonColor),
          ),
        ),
      );
    } else if (_emailVerified) {
      emailCodeSuffixIcon = const Icon(Icons.verified, color: Colors.green);
    }

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.buttonColor,
        foregroundColor: Colors.white,
        title: Text(
          widget.userType == 'abogado'
              ? 'Registro de Abogado'
              : 'Registro de Cliente',
        ),
        elevation: 0,
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.buttonColor, Colors.white],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 20),

                // Progress indicator
                Row(
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: AppColors.buttonColor,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.check,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                    Expanded(
                      child: Container(
                        height: 3,
                        color: AppColors.buttonColor,
                        margin: const EdgeInsets.symmetric(horizontal: 10),
                      ),
                    ),
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: AppColors.buttonColor,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.person,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                    Expanded(
                      child: Container(
                        height: 3,
                        color: Colors.grey.shade300,
                        margin: const EdgeInsets.symmetric(horizontal: 10),
                      ),
                    ),
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.security,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 30),

                const Text(
                  'Información de Contacto',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Completa tus datos de contacto',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.white.withOpacity(0.8),
                  ),
                ),

                const SizedBox(height: 40),

                // Información de Contacto
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(15),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.grey.withOpacity(0.2),
                        spreadRadius: 1,
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.contact_phone,
                            color: AppColors.buttonColor,
                            size: 24,
                          ),
                          const SizedBox(width: 10),
                          Text(
                            'Datos de Contacto',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: AppColors.buttonColor,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // DNI
                      _buildCustomTextField(
                        controller: _dniController,
                        label: 'DNI *',
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(8),
                        ],
                        maxLength: 8,
                        onChanged: _handleDniChanged,
                        suffixIcon: dniSuffixIcon,
                        helperText: dniHelperText,
                        errorText: _dniError,
                      ),

                      // Teléfono
                      _buildCustomTextField(
                        controller: _phoneController,
                        label: 'Número de Teléfono *',
                        keyboardType: TextInputType.phone,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(10),
                        ],
                        maxLength: 10,
                      ),

                      // Email
                      _buildCustomTextField(
                        controller: _emailController,
                        label: 'Correo Electrónico *',
                        keyboardType: TextInputType.emailAddress,
                        onChanged: _handleEmailChanged,
                        helperText: emailHelperText,
                        errorText: _emailError,
                        suffixIcon: emailSuffixIcon,
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: SizedBox(
                              height: 48,
                              child: ElevatedButton(
                                onPressed:
                                    _isCheckingEmailExistence ||
                                            _isSendingEmailCode
                                        ? null
                                        : _sendEmailVerificationCode,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.buttonColor,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                                child:
                                    _isCheckingEmailExistence ||
                                            _isSendingEmailCode
                                        ? Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.center,
                                          children: [
                                            SizedBox(
                                              width: 18,
                                              height: 18,
                                              child: CircularProgressIndicator(
                                                strokeWidth: 2,
                                                valueColor:
                                                    const AlwaysStoppedAnimation<
                                                      Color
                                                    >(Colors.white),
                                              ),
                                            ),
                                            const SizedBox(width: 12),
                                            const Text(
                                              'Procesando...',
                                              style: TextStyle(
                                                color: Colors.white,
                                              ),
                                            ),
                                          ],
                                        )
                                        : Text(
                                          _emailCodeSent
                                              ? 'Reenviar código'
                                              : 'Enviar código',
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            color: Colors.white,
                                          ),
                                        ),
                              ),
                            ),
                          ),
                          if (showEmailCodeField) ...[
                            const SizedBox(width: 12),
                            Expanded(
                              child: SizedBox(
                                height: 48,
                                child: OutlinedButton(
                                  onPressed:
                                      _emailVerified || _isVerifyingEmailCode
                                          ? null
                                          : _verifyEmailCode,
                                  style: OutlinedButton.styleFrom(
                                    side: BorderSide(
                                      color:
                                          _emailVerified
                                              ? Colors.green
                                              : AppColors.buttonColor,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                  child:
                                      _isVerifyingEmailCode
                                          ? Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.center,
                                            children: [
                                              SizedBox(
                                                width: 18,
                                                height: 18,
                                                child: CircularProgressIndicator(
                                                  strokeWidth: 2,
                                                  valueColor:
                                                      const AlwaysStoppedAnimation<
                                                        Color
                                                      >(AppColors.buttonColor),
                                                ),
                                              ),
                                              const SizedBox(width: 12),
                                              const Text('Verificando...'),
                                            ],
                                          )
                                          : Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.center,
                                            children: [
                                              Icon(
                                                _emailVerified
                                                    ? Icons.verified
                                                    : Icons.verified_outlined,
                                                color:
                                                    _emailVerified
                                                        ? Colors.green.shade700
                                                        : AppColors.buttonColor,
                                                size: 18,
                                              ),
                                              const SizedBox(width: 8),
                                              Text(
                                                _emailVerified
                                                    ? 'Correo verificado'
                                                    : 'Validar código',
                                                style: TextStyle(
                                                  color:
                                                      _emailVerified
                                                          ? Colors
                                                              .green
                                                              .shade700
                                                          : AppColors
                                                              .buttonColor,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ],
                                          ),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      if (showEmailCodeField) ...[
                        const SizedBox(height: 16),
                        _buildCustomTextField(
                          controller: _emailCodeController,
                          label: 'Código de verificación',
                          keyboardType: TextInputType.number,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(6),
                          ],
                          enabled: !_emailVerified,
                          onChanged: (value) {
                            if (_emailCodeError != null) {
                              setState(() {
                                _emailCodeError = null;
                              });
                            }
                          },
                          helperText:
                              _emailVerified
                                  ? 'Correo verificado correctamente.'
                                  : 'Ingresa el código recibido en tu correo.',
                          errorText: _emailCodeError,
                          suffixIcon: emailCodeSuffixIcon,
                        ),
                      ],

                      // Departamento
                      _buildUbigeoDropdown(
                        label: 'Departamento *',
                        value: _selectedDepartamentoCodigo,
                        options: _departamentos,
                        isLoading: _loadingDepartamentos,
                        onChanged: (value) {
                          if (value == null) {
                            setState(() {
                              _selectedDepartamentoCodigo = null;
                              _provincias = const <UbigeoOption>[];
                              _distritos = const <UbigeoOption>[];
                              _selectedProvinciaCodigo = null;
                              _selectedDistritoCodigo = null;
                            });
                          } else {
                            setState(() {
                              _selectedDepartamentoCodigo = value;
                            });
                            _loadProvincias(value);
                          }
                        },
                      ),

                      // Provincia
                      _buildUbigeoDropdown(
                        label: 'Provincia *',
                        value: _selectedProvinciaCodigo,
                        options: _provincias,
                        isLoading: _loadingProvincias,
                        enabled: _selectedDepartamentoCodigo != null,
                        onChanged: (value) {
                          if (value == null) {
                            setState(() {
                              _selectedProvinciaCodigo = null;
                              _distritos = const <UbigeoOption>[];
                              _selectedDistritoCodigo = null;
                            });
                          } else {
                            setState(() {
                              _selectedProvinciaCodigo = value;
                            });
                            _loadDistritos(value);
                          }
                        },
                      ),

                      // Distrito
                      _buildUbigeoDropdown(
                        label: 'Distrito *',
                        value: _selectedDistritoCodigo,
                        options: _distritos,
                        isLoading: _loadingDistritos,
                        enabled: _selectedProvinciaCodigo != null,
                        onChanged: (value) {
                          setState(() {
                            _selectedDistritoCodigo = value;
                          });
                        },
                      ),

                      // Dirección exacta
                      _buildCustomTextField(
                        controller: _direccionExactaController,
                        label: 'Dirección exacta *',
                        enabled: _selectedDistritoCodigo != null,
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 30),

                // Botón siguiente
                SizedBox(
                  width: double.infinity,
                  height: 55,
                  child: CustomButton(
                    text: primaryButtonText,
                    onTap: isProcessing ? null : _nextStep,
                    color: primaryButtonColor,
                  ),
                ),

                const SizedBox(height: 20),

                // Botón volver
                SizedBox(
                  width: double.infinity,
                  height: 55,
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(color: AppColors.buttonColor),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'Volver',
                      style: TextStyle(
                        color: AppColors.buttonColor,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
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
}
