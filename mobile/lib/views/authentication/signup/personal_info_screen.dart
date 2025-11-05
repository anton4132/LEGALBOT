import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../constants/colors.dart';
import '../../../services/api_client.dart';
import '../../../widgets/custombtn.dart';
import 'security_screen.dart';

class PersonalInfoScreen extends StatefulWidget {
  final String userType;
  final Map<String, String> personalInfo;
  final Map<String, String> contactInfo;
  final Map<String, dynamic>? verification;

  const PersonalInfoScreen({
    super.key,
    required this.userType,
    required this.personalInfo,
    required this.contactInfo,
    this.verification,
  });

  @override
  State<PersonalInfoScreen> createState() => _PersonalInfoScreenState();
}

class _PersonalInfoScreenState extends State<PersonalInfoScreen> {
  final TextEditingController _codeController = TextEditingController();
  final GlobalKey<FormState> _codeFormKey = GlobalKey<FormState>();

  bool _isSendingCode = false;
  bool _isVerifyingCode = false;
  bool _isAdvancing = false;
  bool _codeValidated = false;

  String? _codeError;
  DateTime? _codeSentAt;
  DateTime? _codeExpiresAt;

  Map<String, dynamic>? _verificationData;

  @override
  void initState() {
    super.initState();
    _verificationData = widget.verification != null
        ? Map<String, dynamic>.from(widget.verification!)
        : null;

    final emailVerification =
        (_verificationData?['emailVerification'] as Map<String, dynamic>?) ?? {};
    _codeValidated = emailVerification['verified'] == true;

    final sentAtRaw = emailVerification['codeSentAt'];
    if (sentAtRaw is String) {
      _codeSentAt = DateTime.tryParse(sentAtRaw);
    }

    final expiresAtRaw = emailVerification['codeExpiresAt'];
    if (expiresAtRaw is String) {
      _codeExpiresAt = DateTime.tryParse(expiresAtRaw);
    }
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  String _fallback(Map<String, String> source, String key) {
    return source[key]?.trim() ?? '';
  }

  Map<String, String> _normalizedPersonalInfo() {
    return {
      'primerNombre': _fallback(widget.personalInfo, 'primerNombre'),
      'segundoNombre': _fallback(widget.personalInfo, 'segundoNombre'),
      'apellidoPaterno': _fallback(widget.personalInfo, 'apellidoPaterno'),
      'apellidoMaterno': _fallback(widget.personalInfo, 'apellidoMaterno'),
    };
  }

  Widget _buildReadOnlyField(String label, String value) {
    final displayValue = value.isNotEmpty ? value : 'No disponible';
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      child: TextFormField(
        initialValue: displayValue,
        readOnly: true,
        enableInteractiveSelection: false,
        decoration: InputDecoration(
          labelText: label,
          suffixIcon: const Icon(Icons.lock_outline, color: Colors.grey),
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
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        ),
      ),
    );
  }

  List<Widget> _buildNameFields(String primerNombre, String segundoNombre) {
    final hasPrimer = primerNombre.isNotEmpty;
    final hasSegundo = segundoNombre.isNotEmpty;

    if (hasPrimer && hasSegundo) {
      return [
        Row(
          children: [
            Expanded(
              child: _buildReadOnlyField('Primer Nombre', primerNombre),
            ),
            const SizedBox(width: 15),
            Expanded(
              child: _buildReadOnlyField('Segundo Nombre', segundoNombre),
            ),
          ],
        ),
      ];
    }

    if (hasPrimer) {
      return [_buildReadOnlyField('Nombre', primerNombre)];
    }

    if (hasSegundo) {
      return [_buildReadOnlyField('Nombre', segundoNombre)];
    }

    return [_buildReadOnlyField('Nombre', '')];
  }

  List<Widget> _buildLastNameFields(String apellidoPaterno, String apellidoMaterno) {
    final hasPaterno = apellidoPaterno.isNotEmpty;
    final hasMaterno = apellidoMaterno.isNotEmpty;

    if (hasPaterno && hasMaterno) {
      return [
        Row(
          children: [
            Expanded(
              child: _buildReadOnlyField('Apellido Paterno', apellidoPaterno),
            ),
            const SizedBox(width: 15),
            Expanded(
              child: _buildReadOnlyField('Apellido Materno', apellidoMaterno),
            ),
          ],
        ),
      ];
    }

    final fields = <Widget>[];
    if (hasPaterno) {
      fields.add(_buildReadOnlyField('Apellido Paterno', apellidoPaterno));
    }
    if (hasMaterno) {
      fields.add(_buildReadOnlyField('Apellido Materno', apellidoMaterno));
    }

    if (fields.isEmpty) {
      fields.add(_buildReadOnlyField('Apellidos', ''));
    }

    return fields;
  }

  String? get _contactEmail {
    final correo = widget.contactInfo['email'] ?? widget.contactInfo['correo'];
    if (correo == null) return null;
    final trimmed = correo.trim();
    return trimmed.isEmpty ? null : trimmed.toLowerCase();
  }

  String? get _contactPhone {
    final telefono =
        widget.contactInfo['telefono'] ?? widget.contactInfo['phone'];
    if (telefono == null) return null;
    final trimmed = telefono.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  bool get _requiresCodeValidation {
    final email = _contactEmail;
    if (email == null) return false;
    return !_codeValidated;
  }

  void _updateEmailVerification({
    required bool verified,
    DateTime? codeSentAt,
    DateTime? codeExpiresAt,
    DateTime? verifiedAt,
  }) {
    final email = _contactEmail;
    if (email == null) return;
    _verificationData =
        Map<String, dynamic>.from(_verificationData ?? <String, dynamic>{});
    final current = Map<String, dynamic>.from(
      (_verificationData?['emailVerification'] as Map<String, dynamic>?) ??
          <String, dynamic>{},
    );
    current['email'] = email;
    current['verified'] = verified;
    if (codeSentAt != null) {
      current['codeSentAt'] = codeSentAt.toIso8601String();
      _codeSentAt = codeSentAt;
    }
    if (codeExpiresAt != null) {
      current['codeExpiresAt'] = codeExpiresAt.toIso8601String();
      _codeExpiresAt = codeExpiresAt;
    }
    if (verifiedAt != null) {
      current['verifiedAt'] = verifiedAt.toIso8601String();
    }
    _verificationData!['emailVerification'] = current;
  }

  Future<void> _resendVerificationCode() async {
    final email = _contactEmail;
    if (email == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No se encontró un correo válido para reenviar el código.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() {
      _isSendingCode = true;
      _codeError = null;
    });

    try {
      final expiration = await ApiClient.requestEmailVerificationCode(
        correo: email,
      );
      if (!mounted) return;
      setState(() {
        _codeValidated = false;
        _codeController.clear();
        _updateEmailVerification(
          verified: false,
          codeSentAt: DateTime.now(),
          codeExpiresAt: expiration,
        );
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Se envió un nuevo código a $email'),
          backgroundColor: Colors.green.shade600,
        ),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      final message = error.message.isNotEmpty
          ? error.message
          : 'No se pudo reenviar el código.';
      setState(() => _codeError = message);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), backgroundColor: Colors.red),
      );
    } catch (error) {
      if (!mounted) return;
      final message = error.toString().replaceFirst('Exception: ', '');
      final fallback =
          message.isNotEmpty ? message : 'Ocurrió un error al reenviar el código.';
      setState(() => _codeError = fallback);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(fallback), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) {
        setState(() => _isSendingCode = false);
      }
    }
  }

  Future<bool> _verifyCode({bool showFeedback = true}) async {
    if (_isVerifyingCode) return false;

    final formState = _codeFormKey.currentState;
    if (formState == null || !formState.validate()) {
      return false;
    }

    final email = _contactEmail;
    if (email == null) {
      return false;
    }

    final code = _codeController.text.trim();
    setState(() {
      _isVerifyingCode = true;
      _codeError = null;
    });

    try {
      await ApiClient.verifyEmailVerificationCode(
        correo: email,
        codigo: code,
      );
      if (!mounted) return false;
      setState(() {
        _codeValidated = true;
        _codeError = null;
        _updateEmailVerification(
          verified: true,
          verifiedAt: DateTime.now(),
        );
      });
      if (showFeedback && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Código verificado correctamente.'),
            backgroundColor: Colors.green,
          ),
        );
      }
      return true;
    } on ApiException catch (error) {
      if (!mounted) return false;
      final message = error.message.isNotEmpty
          ? error.message
          : 'Código incorrecto o expirado.';
      setState(() {
        _codeValidated = false;
        _codeError = message;
      });
      if (showFeedback) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message), backgroundColor: Colors.red),
        );
      }
      return false;
    } catch (error) {
      if (!mounted) return false;
      final message = error.toString().replaceFirst('Exception: ', '');
      final fallback = message.isNotEmpty
          ? message
          : 'No se pudo verificar el código proporcionado.';
      setState(() {
        _codeValidated = false;
        _codeError = fallback;
      });
      if (showFeedback) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(fallback), backgroundColor: Colors.red),
        );
      }
      return false;
    } finally {
      if (mounted) {
        setState(() => _isVerifyingCode = false);
      }
    }
  }

  Future<bool> _checkPhoneAvailability() async {
    final phone = _contactPhone;
    if (phone == null) {
      return true;
    }

    try {
      final exists = await ApiClient.isPhoneRegistered(phone);
      if (exists) {
        if (!mounted) return false;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('El teléfono proporcionado ya está asociado a otra cuenta.'),
            backgroundColor: Colors.red,
          ),
        );
        return false;
      }
      return true;
    } on ApiException catch (error) {
      if (!mounted) return false;
      final message = error.message.isNotEmpty
          ? error.message
          : 'No se pudo validar el teléfono proporcionado.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), backgroundColor: Colors.red),
      );
      return false;
    } catch (error) {
      if (!mounted) return false;
      final message = error.toString().replaceFirst('Exception: ', '');
      final fallback = message.isNotEmpty
          ? message
          : 'Ocurrió un error al validar el teléfono.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(fallback), backgroundColor: Colors.red),
      );
      return false;
    }
  }

  Future<void> _handleContinue(Map<String, String> sanitizedPersonalInfo) async {
    if (_isAdvancing) return;
    setState(() => _isAdvancing = true);

    try {
      final phoneAvailable = await _checkPhoneAvailability();
      if (!phoneAvailable) {
        return;
      }

      if (_requiresCodeValidation) {
        final success = await _verifyCode(showFeedback: false);
        if (!success) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Verifica tu código antes de continuar.'),
                backgroundColor: Colors.orange,
              ),
            );
          }
          return;
        }
      }

      if (!mounted) return;
      _goToSecurity(
        context,
        sanitizedPersonalInfo,
        (_verificationData == null || _verificationData!.isEmpty)
            ? widget.verification
            : _verificationData,
      );
    } finally {
      if (mounted) {
        setState(() => _isAdvancing = false);
      }
    }
  }

  void _goToSecurity(
    BuildContext context,
    Map<String, String> sanitizedPersonalInfo,
    Map<String, dynamic>? verification,
  ) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => SecurityScreen(
          userType: widget.userType,
          personalInfo: sanitizedPersonalInfo,
          contactInfo: widget.contactInfo,
          verification: verification,
        ),
      ),
    );
  }

  Widget _buildVerificationSection() {
    if (!_requiresCodeValidation) {
      final email = _contactEmail;
      if (email == null) {
        return const SizedBox.shrink();
      }
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.green.shade50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.green.shade200),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.verified, color: Colors.green.shade600),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Correo verificado: $email',
                style: TextStyle(
                  color: Colors.green.shade700,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      );
    }

    final expirationText = (() {
      if (_codeExpiresAt == null) {
        return null;
      }
      final expires = _codeExpiresAt!;
      return 'El código expira el ${expires.day.toString().padLeft(2, '0')}/${expires.month.toString().padLeft(2, '0')}/${expires.year.toString()} a las ${expires.hour.toString().padLeft(2, '0')}:${expires.minute.toString().padLeft(2, '0')}.';
    })();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(15),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.18),
            spreadRadius: 1,
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.mark_email_read, color: AppColors.buttonColor),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Verifica tu correo',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.buttonColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Ingresa el código de verificación enviado a ${_contactEmail ?? 'tu correo'} y confirma antes de continuar.',
          ),
          const SizedBox(height: 16),
          Form(
            key: _codeFormKey,
            child: TextFormField(
              controller: _codeController,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(6),
              ],
              decoration: InputDecoration(
                labelText: 'Código de verificación',
                errorText: _codeError,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      const BorderSide(color: AppColors.buttonColor, width: 2),
                ),
                filled: true,
                fillColor: Colors.grey.shade50,
              ),
              validator: (value) {
                final trimmed = value?.trim() ?? '';
                if (trimmed.isEmpty) {
                  return 'Ingresa el código recibido';
                }
                if (trimmed.length < 4) {
                  return 'El código debe tener al menos 4 dígitos';
                }
                return null;
              },
            ),
          ),
          if (expirationText != null) ...[
            const SizedBox(height: 12),
            Text(
              expirationText,
              style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
            ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _isSendingCode ? null : _resendVerificationCode,
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: AppColors.buttonColor),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _isSendingCode
                      ? Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                            SizedBox(width: 10),
                            Text('Reenviando...'),
                          ],
                        )
                      : const Text('Reenviar código'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: _isVerifyingCode ? null : () => _verifyCode(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.buttonColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _isVerifyingCode
                      ? Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor:
                                    const AlwaysStoppedAnimation<Color>(
                                  Colors.white,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            const Text('Validando...'),
                          ],
                        )
                      : const Text('Validar código'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final sanitizedPersonalInfo = _normalizedPersonalInfo();
    final primerNombre = sanitizedPersonalInfo['primerNombre'] ?? '';
    final segundoNombre = sanitizedPersonalInfo['segundoNombre'] ?? '';
    final apellidoPaterno = sanitizedPersonalInfo['apellidoPaterno'] ?? '';
    final apellidoMaterno = sanitizedPersonalInfo['apellidoMaterno'] ?? '';
    final dni = widget.contactInfo['dni'] ?? '';

    final helperText = dni.isNotEmpty
        ? 'Datos obtenidos automáticamente para el DNI $dni.'
        : 'Datos obtenidos automáticamente del padrón oficial.';

    final verificationSection = _contactEmail == null
        ? const SizedBox.shrink()
        : _buildVerificationSection();

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
                Row(
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      decoration: const BoxDecoration(
                        color: AppColors.buttonColor,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.check, color: Colors.white, size: 20),
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
                      decoration: const BoxDecoration(
                        color: AppColors.buttonColor,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.person, color: Colors.white, size: 20),
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
                      child: const Icon(Icons.security,
                          color: Colors.white, size: 20),
                    ),
                  ],
                ),
                const SizedBox(height: 30),
                const Text(
                  'Verifica tu identidad',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Confirma que los datos mostrados coinciden contigo.',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.white.withOpacity(0.8),
                  ),
                ),
                const SizedBox(height: 40),
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
                          Icon(Icons.badge,
                              color: AppColors.buttonColor, size: 24),
                          const SizedBox(width: 10),
                          Text(
                            'Datos personales',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: AppColors.buttonColor,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      ..._buildNameFields(primerNombre, segundoNombre),
                      ..._buildLastNameFields(apellidoPaterno, apellidoMaterno),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Colors.blue.shade200),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.info_outline,
                                color: Colors.blue.shade600, size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                helperText,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Colors.blue.shade700,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 30),
                verificationSection,
                if (verificationSection is! SizedBox) const SizedBox(height: 30),
                SizedBox(
                  width: double.infinity,
                  height: 55,
                  child: CustomButton(
                    text: _isAdvancing ? 'Validando...' : 'Sí, soy yo',
                    onTap: _isAdvancing
                        ? null
                        : () => _handleContinue(sanitizedPersonalInfo),
                    color: _isAdvancing
                        ? AppColors.buttonColor.withOpacity(0.7)
                        : AppColors.buttonColor,
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 55,
                  child: OutlinedButton(
                    onPressed: _isAdvancing ? null : () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(color: AppColors.buttonColor),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'No soy yo',
                      style: TextStyle(
                        color: AppColors.buttonColor,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Si los datos no coinciden, regresa y verifica tu DNI.',
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.white.withOpacity(0.8),
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
