import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';

import '../../../constants/colors.dart';
import '../../../models/lawyer_application.dart';
import '../../../models/user_session.dart';
import '../../../services/api_client.dart';
import '../../../services/session_service.dart';
import '../../../widgets/consultation_input.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../../widgets/custombtn.dart';
import '../../../widgets/gradient_container.dart';
import '../../../widgets/section_header.dart';
import '../../../widgets/shadow_card.dart';
import '../../authentication/login_screen.dart';
import '../../lawyer/home/lawyer_home.dart';
import '../../wallet/wallet_screen.dart';
import '../lawyers/client_lawyer_search_screen.dart';
import 'become_lawyer_screen.dart';
import 'client_settings_screen.dart';
import '../widgets/client_navigation_drawer.dart';


class ClientHome extends StatefulWidget {
  final bool showSettings;
  final ClientSettingsSubsection initialSettingsSubsection;

  const ClientHome({
    super.key,
    this.showSettings = false,
    this.initialSettingsSubsection = ClientSettingsSubsection.overview,
  });

  @override
  State<ClientHome> createState() => _ClientHomeState();
}
enum _ClientHomeView { dashboard, settings }

class _ClientHomeState extends State<ClientHome> {
  static const String _apiBaseUrl = 'http://localhost:3000/api';
  final TextEditingController _consultationController = TextEditingController();
  bool _isRecording = false;
  bool _isSwitchingAccount = false;
  late _ClientHomeView _activeView;
  late ClientSettingsSubsection _activeSettingsSubsection;
  bool _isLoadingCatalog = false;
  String? _catalogError;
  String? _catalogTariffWarning;
  List<_ServicePlanCatalogItem> _catalogItems = const [];

  @override
  void initState() {
    super.initState();
    _activeView =
        widget.showSettings ? _ClientHomeView.settings : _ClientHomeView.dashboard;
    _activeSettingsSubsection = widget.initialSettingsSubsection;
    WidgetsBinding.instance.addPostFrameCallback(
      (_) {
        _refreshApplicationStatus();
        _loadServicePlanCatalog();
      },
    );
  }

  @override
  void dispose() {
    _consultationController.dispose();
    super.dispose();
  }

  Future<void> _refreshApplicationStatus() async {
    final session = SessionService.instance.session;
    if (session == null) return;

    try {
      final status = await ApiClient.fetchLawyerApplicationStatus(
        token: session.token,
      );
      SessionService.instance.updateApplication(status);
        try {
        final accounts = await ApiClient.fetchMobileAccounts(
          token: session.token,
        );
        
        SessionService.instance.updateAccounts(accounts.accounts);
      } catch (_) {
        // Ignorar fallos al refrescar cuentas; no bloquear UI
      }
    } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
    } catch (_) {
      // Ignorar fallos silenciosamente; el usuario puede actualizar manualmente en la pantalla de postulación
    }
  }

  Future<void> _loadServicePlanCatalog() async {
    setState(() {
      _isLoadingCatalog = true;
      _catalogError = null;
      _catalogTariffWarning = null;

    });

     try {
      final services = await _fetchServices();
      final plans = await _fetchPlans();

      List<_TariffRule> tariffs = const [];
      String? tariffWarning;
      try {
        tariffs = await _fetchTariffRules();
      } on UnauthorizedException {
        rethrow;
      } on ApiException catch (error) {
        tariffWarning = _resolveTariffWarning(error.message);
      } catch (_) {
        tariffWarning = _resolveTariffWarning(null);
      }

      final items = <_ServicePlanCatalogItem>[];
      for (final service in services) {
        final item =
            _ServicePlanCatalogItem.fromService(service, tariffs: tariffs);
        if (item.isActive) {
          items.add(item);
        }
      }
      for (final plan in plans) {
        final item = _ServicePlanCatalogItem.fromPlan(plan, tariffs: tariffs);
        if (item.isActive) {
          items.add(item);
        }
      }

      items.sort((a, b) {
        final typeComparison = a.type.index.compareTo(b.type.index);
        if (typeComparison != 0) {
          return typeComparison;
        }
        return a.name.toLowerCase().compareTo(b.name.toLowerCase());
      });

      if (!mounted) return;
      setState(() {
        _catalogItems = items;
        _catalogTariffWarning = tariffWarning;

      });
    } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _catalogError = error.message;
        _catalogTariffWarning = null;

      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _catalogError = 'No se pudieron cargar los servicios y planes.';
        _catalogTariffWarning = null;

      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoadingCatalog = false;
        });
      }
    }
  }

  Future<List<Map<String, dynamic>>> _fetchServices() async {
    final json = await _getJson('/services?estado=true');
    if (json is List) {
      return json.whereType<Map<String, dynamic>>().toList();
    }
    if (json is Map<String, dynamic>) {
      final services = json['services'];
      if (services is List) {
        return services.whereType<Map<String, dynamic>>().toList();
      }
    }
    return const [];
  }

  Future<List<Map<String, dynamic>>> _fetchPlans() async {
    final json = await _getJson('/plans');
    if (json is List) {
      return json.whereType<Map<String, dynamic>>().toList();
    }
    if (json is Map<String, dynamic>) {
      final plans = json['plans'];
      if (plans is List) {
        return plans.whereType<Map<String, dynamic>>().toList();
      }
    }
    return const [];
  }

  Future<List<_TariffRule>> _fetchTariffRules() async {
    final json = await _getJson('/tarifas?per_page=200&activo=true&vigencia=vigentes');
    final List<_TariffRule> rules = [];
    if (json is Map<String, dynamic>) {
      final items = json['items'];
      if (items is List) {
        for (final item in items) {
          if (item is Map<String, dynamic>) {
            final rule = _TariffRule.fromJson(item);
            if (rule.isActive) {
              rules.add(rule);
            }
          }
        }
      }
    } else if (json is List) {
      for (final item in json) {
        if (item is Map<String, dynamic>) {
          final rule = _TariffRule.fromJson(item);
          if (rule.isActive) {
            rules.add(rule);
          }
        }
      }
    }
    return rules;
  }

  Future<Object?> _getJson(String path) async {
    final session = SessionService.instance.session;
    final headers = <String, String>{'Accept': 'application/json'};
    if (session != null) {
      headers['Authorization'] = 'Bearer ${session.token}';
    }

    final uri = Uri.parse('$_apiBaseUrl$path');
    final response = await http.get(uri, headers: headers);
    if (response.statusCode == 401) {
      final message = _extractMessage(response.body);
      final resolvedMessage = (() {
        final trimmed = message?.trim();
        if (trimmed != null && trimmed.isNotEmpty) {
          return trimmed;
        }
        return 'Tu sesión ha expirado. Inicia sesión nuevamente.';
      })();
throw UnauthorizedException(resolvedMessage);
    }    if (response.statusCode >= 400) {
      throw ApiException(
        _extractMessage(response.body) ??
            'Error ${response.statusCode} al consultar $path',
        statusCode: response.statusCode,
      );
    }
    if (response.body.isEmpty) {
      return null;
    }
    try {
      return jsonDecode(response.body);
    } catch (_) {
      return null;
    }
  }

  String? _extractMessage(String body) {
    if (body.isEmpty) return null;
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) {
        final message = decoded['message'];
        if (message is String && message.trim().isNotEmpty) {
          return message.trim();
        }
      }
    } catch (_) {
      return null;
    }
    return null;
  }

  String _resolveTariffWarning(String? detail) {
    const baseMessage =
        'Mostramos el catálogo sin información de tarifas por ahora.';
    final trimmed = detail?.trim();
    if (trimmed == null || trimmed.isEmpty ||
        trimmed == 'Error obteniendo tarifas') {
      return baseMessage;
    }
    return '$baseMessage\nDetalle: $trimmed';
  }

  void _handleSendConsultation() {
    final text = _consultationController.text.trim();
    if (text.isNotEmpty) {
      // TODO: Implementar envío de consulta al backend
      // ignore: avoid_print
      print('Consulta enviada: $text');
      _consultationController.clear();
    }
  }

  void _showSnackBar(String message,
      {Color color = AppColors.tabColor}) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message), backgroundColor: color));
  }

  void _handleUnauthorized(String? message) {
    SessionService.instance.clear();

    if (!mounted) {
      return;
    }

    final resolvedMessage = (() {
      final trimmed = message?.trim();
      if (trimmed != null && trimmed.isNotEmpty) {
        return trimmed;
      }
      return 'Tu sesión ha expirado. Inicia sesión nuevamente.';
    })();

    setState(() {
      _isRecording = false;
      _isSwitchingAccount = false;
      _consultationController.clear();
    });

    final messenger = ScaffoldMessenger.of(context);
    messenger.showSnackBar(
      SnackBar(
        content: Text(resolvedMessage),
        backgroundColor: AppColors.tabColor,
      ),
    );

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  Future<void> _switchToLawyerAccount(UserSession session) async {
    if (_isSwitchingAccount) return;

    final lawyerAccount = SessionService.instance.accountForRole('abogado');
    if (lawyerAccount == null) {
      _showSnackBar(
        'No tienes una cuenta de abogado activa',
        color: AppColors.text3Color,
      );
      return;
    }

    final LawyerApplicationStatus application =
        SessionService.instance.session?.application ??
            LawyerApplicationStatus.empty;
    final String? restrictionMessage =
        _lawyerRestrictionMessage(application, lawyerAccount);
    if (restrictionMessage != null) {
      _showSnackBar(
        restrictionMessage,
        color: AppColors.text3Color,
      );
      return;
    }

    setState(() => _isSwitchingAccount = true);
    try {
      final result = await ApiClient.switchAccount(
        token: session.token,
        usuarioId: lawyerAccount.usuarioId,
      );
      final updatedSession = session.applySwitchResult(result);
      SessionService.instance.setSession(updatedSession);

      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const LawyerHome()),
      );
      } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
    } catch (error) {
      if (!mounted) return;
      final message = error.toString().replaceFirst('Exception: ', '');
      _showSnackBar(
        message.isEmpty ? 'No se pudo cambiar a la cuenta de abogado' : message,
      );
    } finally {
      if (mounted) {
        setState(() => _isSwitchingAccount = false);
      }
    }
  }

  void _handleMicPressed() {
    setState(() => _isRecording = !_isRecording);
    // TODO: Implementar grabación de voz
    // ignore: avoid_print
    print(_isRecording ? 'Iniciando grabación...' : 'Deteniendo grabación...');
  }


  void _showHomeView() {
    if (_activeView == _ClientHomeView.dashboard) return;
    setState(() {
      _activeView = _ClientHomeView.dashboard;
    });
  }

  void _openSettingsSubsection(ClientSettingsSubsection subsection) {
    setState(() {
      _activeView = _ClientHomeView.settings;
      _activeSettingsSubsection = subsection;
    });
  }
  UserAccount? _lawyerAccountForSession(UserSession? session) {
    if (session == null) {
      return null;
    }
    for (final account in session.accounts) {
      if (account.isLawyer) {
        return account;
      }
    }
    return null;
  }

  String? _lawyerRestrictionMessage(
    LawyerApplicationStatus application,
    UserAccount? lawyerAccount,
  ) {
    if (lawyerAccount != null && !lawyerAccount.activo) {
      final detail = application.observation?.trim();
      if (detail != null && detail.isNotEmpty) {
        return detail;
      }
      return 'Tu cuenta de abogado está deshabilitada hasta regularizar la documentación solicitada.';
    }

    switch (application.state) {
      case LawyerApplicationState.pendiente:
        return 'Tu postulación como abogado está en revisión. Recibirás una notificación cuando sea aprobada.';
      case LawyerApplicationState.observada:
        final detail = application.observation?.trim();
        if (detail != null && detail.isNotEmpty) {
          return detail;
        }
        return 'Tu postulación fue observada. Corrige la información solicitada para continuar.';
      case LawyerApplicationState.rechazada:
        final detail = application.observation?.trim();
        if (detail != null && detail.isNotEmpty) {
          return detail;
        }
        return 'Tu postulación fue rechazada. Contáctanos para obtener más detalles.';
      case LawyerApplicationState.aprobada:
      case LawyerApplicationState.none:
      default:
        return null;
    }
  }

  Widget _buildServicePlanSection() {
    if (_isLoadingCatalog) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildCatalogStatusBlock(
            title: 'Servicios individuales',
            child: _buildCatalogLoadingCard(),
          ),
          const SizedBox(height: 24),
          _buildCatalogStatusBlock(
            title: 'Planes y membresías',
            child: _buildCatalogLoadingCard(),
          ),
        ],
      );
    }

    if (_catalogError != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildCatalogStatusBlock(
            title: 'Servicios individuales',
            child: _buildCatalogErrorCard(_catalogError!),
          ),
          const SizedBox(height: 24),
          _buildCatalogStatusBlock(
            title: 'Planes y membresías',
            child: _buildCatalogErrorCard(_catalogError!),
          ),
        ],
      );
    }

    if (_catalogItems.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_catalogTariffWarning != null) ...[
            _buildCatalogWarningCard(_catalogTariffWarning!),
            const SizedBox(height: 24),
          ],
          _buildCatalogStatusBlock(
            title: 'Servicios individuales',
            child: _buildCatalogEmptyCard(
              'No hay servicios individuales activos registrados por el momento.',
            ),
          ),
          const SizedBox(height: 24),
          _buildCatalogStatusBlock(
            title: 'Planes y membresías',
            child: _buildCatalogEmptyCard(
              'No hay planes disponibles todavía. Vuelve a intentarlo más tarde.',
            ),
          ),
        ],
      );
    }

    final services = _catalogItems
        .where((item) => item.type == _CatalogItemType.service)
        .toList();
    final plans = _catalogItems
        .where((item) => item.type == _CatalogItemType.plan)
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
         if (_catalogTariffWarning != null) ...[
          _buildCatalogWarningCard(_catalogTariffWarning!),
          const SizedBox(height: 28),
        ],
        _buildCatalogSection(
          title: 'Servicios individuales',
          items: services,
          type: _CatalogItemType.service,
        ),
        const SizedBox(height: 28),
        _buildCatalogSection(
          title: 'Planes y membresías',
          items: plans,
          type: _CatalogItemType.plan,
        ),
      ],
    );
  }

  Widget _buildCatalogStatusBlock({
    required String title,
    required Widget child,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: title),
        const SizedBox(height: 12),
        child,
      ],
    );
  }

  Widget _buildCatalogLoadingCard() {
    return ShadowCard(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: const [
          SizedBox(
            height: 24,
            width: 24,
            child: CircularProgressIndicator(strokeWidth: 2.6),
          ),
          SizedBox(width: 14),
          Expanded(
            child: Text(
              'Cargando catálogo personalizado...',
              style: TextStyle(
                fontSize: 14,
                color: AppColors.text2Color,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCatalogErrorCard(String message) {
    return ShadowCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(
                Icons.error_outline,
                color: AppColors.text3Color,
              ),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'No se pudo cargar el catálogo',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                    color: AppColors.buttonColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            message,
            style: const TextStyle(
              fontSize: 13,
              height: 1.35,
              color: AppColors.text2Color,
            ),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: _loadServicePlanCatalog,
              icon: const Icon(Icons.refresh),
              label: const Text('Reintentar'),
            ),
          ),
        ],
      ),
    );
  }
Widget _buildCatalogWarningCard(String message) {
    return ShadowCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(
                Icons.info_outline,
                color: AppColors.button2Color,
              ),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Mostramos el catálogo sin tarifas detalladas',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                    color: AppColors.buttonColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            message,
            style: const TextStyle(
              fontSize: 13,
              height: 1.35,
              color: AppColors.text2Color,
            ),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: _loadServicePlanCatalog,
              icon: const Icon(Icons.refresh),
              label: const Text('Intentar nuevamente'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCatalogEmptyCard(String message) {
    return ShadowCard(
      padding: const EdgeInsets.all(18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.info_outline,
            color: AppColors.button2Color,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                fontSize: 13,
                height: 1.35,
                color: AppColors.text2Color,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCatalogSection({
    required String title,
    required List<_ServicePlanCatalogItem> items,
    required _CatalogItemType type,
  }) {
    final accentColor = _accentColorForType(type);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: title),
        const SizedBox(height: 12),
        if (items.isEmpty)
          _buildCatalogEmptyState(
            type == _CatalogItemType.service
                ? 'Aún no contamos con servicios individuales en esta categoría.'
                : 'Todavía no hay planes disponibles. Pronto añadiremos nuevas propuestas.',
            accentColor,
          )
        else
          Column(
            children: [
              for (int index = 0; index < items.length; index++) ...[
                _CatalogCard(
                  item: items[index],
                  accentColor: accentColor,
                  gradient: _gradientForType(type),
                  icon: _iconForItem(items[index]),
                  actionLabel: _actionLabelForItem(items[index]),
                  onPressed: () => _handleCatalogItemAction(items[index]),
                ),
                if (index != items.length - 1) const SizedBox(height: 18),
              ],
            ],
          ),
      ],
    );
  }

  Widget _buildCatalogEmptyState(String message, Color color) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 18),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Text(
        message,
        style: TextStyle(
          fontSize: 13,
          height: 1.35,
          color: color.withOpacity(0.9),
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  void _handleCatalogItemAction(_ServicePlanCatalogItem item) {
    final message = item.type == _CatalogItemType.plan
        ? 'Muy pronto podrás contratar el plan "${item.name}" desde la app.'
        : 'Estamos preparando más detalles para el servicio "${item.name}".';
    _showSnackBar(
      message,
      color: item.type == _CatalogItemType.plan
          ? AppColors.button2Color
          : AppColors.tabColor,
    );
  }

  String _actionLabelForItem(_ServicePlanCatalogItem item) {
    return item.type == _CatalogItemType.plan ? 'Contratar' : 'Ver más';
  }

  Color _accentColorForType(_CatalogItemType type) {
    switch (type) {
      case _CatalogItemType.plan:
        return AppColors.button2Color;
      case _CatalogItemType.service:
      default:
        return AppColors.buttonColor;
    }
  }

  Gradient _gradientForType(_CatalogItemType type) {
    switch (type) {
      case _CatalogItemType.plan:
        return LinearGradient(
          colors: [
            AppColors.button2Color.withOpacity(0.95),
            AppColors.tabColor.withOpacity(0.95),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case _CatalogItemType.service:
      default:
        return LinearGradient(
          colors: [
            AppColors.buttonColor.withOpacity(0.95),
            AppColors.text3Color.withOpacity(0.9),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
    }
  }

  IconData _iconForItem(_ServicePlanCatalogItem item) {
    if (item.type == _CatalogItemType.plan) {
      return Icons.workspace_premium;
    }
    final category = item.category?.toLowerCase() ?? '';
    if (category.contains('veh')) {
      return Icons.directions_car_filled_outlined;
    }
    if (category.contains('famil')) {
      return Icons.family_restroom;
    }
    if (category.contains('labor')) {
      return Icons.work_history_outlined;
    }
    return Icons.gavel_outlined;
  }

  Widget _buildDashboardContent(
    UserSession? session,
    LawyerApplicationStatus application,
    String displayName,
    UserAccount? lawyerAccount,

  ) {
    final String? restrictionMessage =
        _lawyerRestrictionMessage(application, lawyerAccount);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ShadowCard(
          padding: const EdgeInsets.all(15),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.waving_hand,
                    color: AppColors.buttonColor,
                    size: 24,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '¡Hola, $displayName!',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: AppColors.buttonColor,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 5),
              const Text(
                '¿En qué puedo ayudarte hoy?',
                style: TextStyle(
                  fontSize: 14,
                  color: AppColors.text2Color,
                ),
              ),
            ],
          ),
        ),

        if (restrictionMessage != null) ...[
          const SizedBox(height: 16),
          ShadowCard(
            padding: const EdgeInsets.all(15),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.warning_amber_rounded,
                  color: AppColors.tabColor,
                  size: 28,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Atención sobre tu verificación',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.buttonColor,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        restrictionMessage,
                        style: const TextStyle(
                          fontSize: 13,
                          height: 1.35,
                          color: AppColors.text2Color,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 20),
        ShadowCard(
          padding: const EdgeInsets.all(15),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: const [
                  Icon(
                    Icons.chat_bubble_outline,
                    color: AppColors.buttonColor,
                    size: 20,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Consulta Rápida',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: AppColors.buttonColor,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'Escribe tu consulta legal o usa el micrófono para dictar',
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.text2Color,
                ),
              ),
              const SizedBox(height: 10),
              ConsultationInput(
                controller: _consultationController,
                hintText: 'Escribe tu consulta legal aquí...',
                onSendPressed: _handleSendConsultation,
                onMicPressed: _handleMicPressed,
                isRecording: _isRecording,
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _buildServicePlanSection(),
        const SizedBox(height: 20),
        ShadowCard(
          padding: const EdgeInsets.all(15),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: const [
                  Icon(
                    Icons.help_outline,
                    color: AppColors.buttonColor,
                    size: 20,
                  ),
                  SizedBox(width: 8),
                  Text(
                    '¿Necesitas ayuda?',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: AppColors.buttonColor,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'Nuestro equipo legal está disponible 24/7 para ayudarte con cualquier consulta.',
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.text2Color,
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: CustomButton(
                  text: 'Contactar Soporte',
                  onTap: () {
                    // TODO
                  },
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _buildBecomeLawyerCard(session, application),
      ],
    );
  }


  void _handleLogout() async {
    final bool? shouldLogout = await showDialog<bool>(
      context: context,
      builder:
          (context) => AlertDialog(
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

    if (!(shouldLogout ?? false) || !mounted) return;

    SessionService.instance.clear();
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  void _navigateToBecomeLawyer(UserSession? session) {
    if (_isSwitchingAccount) return;

    if (session?.hasLawyerAccount ?? false) {
      if (session != null) {
        _switchToLawyerAccount(session);
      }
      return;
    }

    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const BecomeLawyerScreen()),
    );
  }

  void _navigateToLawyerPanel(UserSession? session) {
    if (_isSwitchingAccount) return;

    if (session == null) {
      _showSnackBar(
        'Inicia sesión nuevamente para acceder al panel de abogado',
      );
      return;
    }

    if (!session.hasLawyerAccount) {
      _showSnackBar(
        'Solicita tu verificación para acceder al panel de abogado',
        color: AppColors.text3Color,
      );
      return;
    }

    _switchToLawyerAccount(session);
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<UserSession?>(
      valueListenable: SessionService.instance.notifier,
      builder: (context, session, _) {
        final LawyerApplicationStatus application =
            session?.application ?? LawyerApplicationStatus.empty;
        final String displayName =
            (session?.nombreCompleto?.trim().isNotEmpty ?? false)
                ? session!.nombreCompleto!.trim()
                : 'Cliente';
        final UserAccount? lawyerAccount = _lawyerAccountForSession(session);
        final bool settingsActive = _activeView == _ClientHomeView.settings;
        return Scaffold(
          appBar: CustomAppBar(
            title: 'LegalBot - Cliente',
            actions: [
              IconButton(
                icon: const Icon(Icons.notifications),
                onPressed: () {
                  // TODO: Implementar notificaciones
                },
              ),
              IconButton(
                icon: const Icon(Icons.account_balance_wallet_outlined),
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      settings:
                          const RouteSettings(name: WalletScreen.routeName),
                      builder: (_) => const WalletScreen(),
                    ),
                  );
                },
              ),
              IconButton(
                icon: const Icon(Icons.person),
                onPressed: () {
                  // TODO: Implementar perfil
                },
              ),
            ],
          ),
          drawer: ClientNavigationDrawer(
            activeDestination: settingsActive
                ? ClientDrawerDestination.settings
                : ClientDrawerDestination.dashboard,
            activeSettingsSubsection: _activeSettingsSubsection,
            onSelectDashboard: _showHomeView,
            onSelectSearch: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const ClientLawyerSearchScreen(),
                ),
              );
            },
            onSelectSettingsSubsection: _openSettingsSubsection,
            onSelectLawyerPanel: session == null
                ? null
                : (_) async {
                    _navigateToLawyerPanel(session);
                  },
            onLogout: _handleLogout,
            isSwitchingAccount: _isSwitchingAccount,
          ),
          body: GradientContainer(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
            child: IndexedStack(
              index: _activeView.index,
              children: [
                _buildDashboardContent(
                  session,
                  application,
                  displayName,
                  lawyerAccount,
                ),
                ClientSettingsScreen(
                  key: const ValueKey('client-settings'),
                  subsection: _activeSettingsSubsection,
                  embedded: true,
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildBecomeLawyerCard(
    UserSession? session,
    LawyerApplicationStatus application,
  ) {
    final bool hasLawyerAccount = session?.hasLawyerAccount ?? false;
    final _StatusDisplay display = _statusDisplayFor(
      application,
      hasLawyerAccount,
    );

    final Gradient gradient = LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        display.color.withOpacity(0.92),
        AppColors.button2Color.withOpacity(0.95),
      ],
    );
    final String actionText =
        hasLawyerAccount
            ? 'Ir al panel de abogado'
            : (application.state == LawyerApplicationState.none
                ? 'Postular ahora'
                : 'Ver detalles');

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: gradient,
        boxShadow: [
          BoxShadow(
            color: display.color.withOpacity(0.28),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap:
              _isSwitchingAccount
                  ? null
                  : () {
                    if (hasLawyerAccount && session != null) {
                      _switchToLawyerAccount(session);
                    } else {
                      _navigateToBecomeLawyer(session);
                    }
                  },
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      display.icon,
                      color: AppColors.buttonTextColor,
                      size: 40,
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            display.title,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 20,
                              color: AppColors.buttonTextColor,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            display.description,
                            style: const TextStyle(
                              color: AppColors.buttonTextColor,
                              fontSize: 14,
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: CustomButton(
                    text: _isSwitchingAccount ? 'Procesando...' : actionText,
                    onTap:
                        _isSwitchingAccount
                            ? null
                            : () {
                              if (hasLawyerAccount && session != null) {
                                _switchToLawyerAccount(session);
                              } else {
                                _navigateToBecomeLawyer(session);
                              }
                            },
                    color: display.color,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  _StatusDisplay _statusDisplayFor(
    LawyerApplicationStatus status,
    bool hasLawyerAccount,
  ) {
    switch (status.state) {
      case LawyerApplicationState.pendiente:
        return _StatusDisplay(
          title: 'Solicitud en revisión',
          description: 'Estamos verificando tu información profesional.',
          color: AppColors.text3Color,
          icon: Icons.hourglass_top_rounded,
        );
      case LawyerApplicationState.observada:
        final String detail =
            (status.observation?.trim().isNotEmpty ?? false)
                ? status.observation!.trim()
                : 'Actualiza la evidencia solicitada y vuelve a enviar tu solicitud.';
        return _StatusDisplay(
          title: 'Solicitud observada',
          description: detail,
          color: AppColors.buttonColor,
          icon: Icons.fact_check_rounded,
        );
      case LawyerApplicationState.aprobada:
        return _StatusDisplay(
          title: 'Solicitud aprobada',
          description:
              'Tu verificación fue exitosa. Cambia al panel de abogado para comenzar.',
          color: AppColors.button2Color,
          icon: Icons.verified_user,
        );
      case LawyerApplicationState.rechazada:
        final String detail =
            (status.observation?.trim().isNotEmpty ?? false)
                ? status.observation!.trim()
                : 'No pudimos validar la solicitud. Contáctanos para mayor detalle.';
        return _StatusDisplay(
          title: 'Solicitud rechazada',
          description: detail,
          color: AppColors.tabColor,
          icon: Icons.cancel_rounded,
        );
      case LawyerApplicationState.none:
      default:
        if (hasLawyerAccount) {
          return _StatusDisplay(
            title: 'Perfil de abogado activo',
            description:
                'Tu cuenta de abogado está lista. Ingresa para gestionar tus casos.',
            color: AppColors.button2Color,
            icon: Icons.workspace_premium,
          );
        }
        return _StatusDisplay(
          title: 'Conviértete en Abogado',
          description:
              'Únete a nuestra red de profesionales y amplía tus oportunidades.',
          color: AppColors.button2Color,
          icon: Icons.school_rounded,
        );
    }
  }
}

class _StatusDisplay {
  final String title;
  final String description;
  final Color color;
  final IconData icon;

  const _StatusDisplay({
    required this.title,
    required this.description,
    required this.color,
    required this.icon,
  });
}

enum _CatalogItemType { service, plan }

class _ServicePlanCatalogItem {
  final int id;
  final String name;
  final String? description;
  final _CatalogItemType type;
  final bool isActive;
  final List<_TariffRule> tariffs;
  final String? identifierLabel;
  final String? category;
  final List<String> associatedServices;

  const _ServicePlanCatalogItem({
    required this.id,
    required this.name,
    required this.type,
    required this.tariffs,
    this.description,
    this.isActive = true,
    this.identifierLabel,
    this.category,
    this.associatedServices = const [],
  });

  factory _ServicePlanCatalogItem.fromService(
    Map<String, dynamic> json, {
    required List<_TariffRule> tariffs,
  }) {
    final id = _asInt(json['id']) ?? 0;
    final codigoRaw = json['codigo'];
    final codigo = codigoRaw is String && codigoRaw.trim().isNotEmpty
        ? 'Código: ${codigoRaw.trim()}'
        : null;
    final filteredTariffs = tariffs
        .where((rule) => rule.servicioId == id)
        .toList()
      ..sort(_TariffRule.compareByPriority);
    return _ServicePlanCatalogItem(
      id: id,
      name: (json['nombre'] as String?)?.trim() ?? 'Servicio $id',
      description: json['descripcion'] as String?,
      type: _CatalogItemType.service,
      isActive: json['activo'] != false,
      identifierLabel: codigo,
      tariffs: List.unmodifiable(filteredTariffs),
      category: _TariffRule._asString(json['categoria']) ??
          _TariffRule._asString(json['tipo']),
    );
  }

  factory _ServicePlanCatalogItem.fromPlan(
    Map<String, dynamic> json, {
    required List<_TariffRule> tariffs,
  }) {
    final id = _asInt(json['id']) ?? 0;
    final filteredTariffs = tariffs
        .where((rule) => rule.planId == id)
        .toList()
      ..sort(_TariffRule.compareByPriority);
    return _ServicePlanCatalogItem(
      id: id,
      name: (json['nombre'] as String?)?.trim() ?? 'Plan $id',
      description: json['descripcion'] as String?,
      type: _CatalogItemType.plan,
      isActive: json['activo'] != false,
      identifierLabel: 'ID $id',
      tariffs: List.unmodifiable(filteredTariffs),
      category: _TariffRule._asString(json['categoria']) ??
          _TariffRule._asString(json['tipo']),
      associatedServices:
          List.unmodifiable(_extractServiceNames(json['servicios'])),
    );
  }

  static List<String> _extractServiceNames(Object? value) {
    if (value == null) {
      return const [];
    }
    if (value is List) {
      return value
          .map((item) {
            if (item is Map<String, dynamic>) {
              final name = item['nombre'] ?? item['name'];
              if (name is String && name.trim().isNotEmpty) {
                return name.trim();
              }
            }
            if (item is String && item.trim().isNotEmpty) {
              return item.trim();
            }
            return null;
          })
          .whereType<String>()
          .toList();
    }
    if (value is Map<String, dynamic>) {
      final names = <String>[];
      for (final entry in value.entries) {
        final val = entry.value;
        if (val is String && val.trim().isNotEmpty) {
          names.add(val.trim());
        }
      }
      return names;
    }
    if (value is String && value.trim().isNotEmpty) {
      return value.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
    }
    return const [];
  }
}

class _TariffRule {
  final int? id;
  final int? servicioId;
  final int? planId;
  final String? codigo;
  final String? descripcion;
  final String? rolAplica;
  final String? moneda;
  final String? metodoPago;
  final String? ambitoRegion;
  final String? tipoCalculo;
  final double? valor;
  final Map<String, dynamic>? parametros;
  final bool incluyeImpuesto;
  final bool isActive;
  final DateTime? vigenciaDesde;
  final DateTime? vigenciaHasta;
  final int? prioridad;

  const _TariffRule({
    this.id,
    this.servicioId,
    this.planId,
    this.codigo,
    this.descripcion,
    this.rolAplica,
    this.moneda,
    this.metodoPago,
    this.ambitoRegion,
    this.tipoCalculo,
    this.valor,
    this.parametros,
    this.incluyeImpuesto = false,
    this.isActive = true,
    this.vigenciaDesde,
    this.vigenciaHasta,
    this.prioridad,
  });

  factory _TariffRule.fromJson(Map<String, dynamic> json) {
    return _TariffRule(
      id: _asInt(json['id']),
      servicioId: _asInt(json['servicio_id']),
      planId: _asInt(json['plan_id']),
      codigo: _asString(json['codigo']),
      descripcion: _asString(json['descripcion']),
      rolAplica: _asString(json['rol_aplica']),
      moneda: _asString(json['moneda']),
      metodoPago: _asString(json['metodo_pago']),
      ambitoRegion: _asString(json['ambito_region']),
      tipoCalculo: _asString(json['tipo_calculo']),
      valor: _asDouble(json['valor']),
      parametros: _asMap(json['parametros']),
      incluyeImpuesto: json['incluye_impuesto'] == true,
      isActive: json['activo'] != false,
      vigenciaDesde: _parseDate(json['vigencia_desde']),
      vigenciaHasta: _parseDate(json['vigencia_hasta']),
      prioridad: _asInt(json['prioridad']),
    );
  }

  static int compareByPriority(_TariffRule a, _TariffRule b) {
    final priorityA = a.prioridad ?? -1;
    final priorityB = b.prioridad ?? -1;
    if (priorityA != priorityB) {
      return priorityB.compareTo(priorityA);
    }
    final codigoA = a.codigo ?? '';
    final codigoB = b.codigo ?? '';
    return codigoA.toLowerCase().compareTo(codigoB.toLowerCase());
  }

  static int? _asInt(Object? value) {
    if (value is int) return value;
    if (value is String) {
      return int.tryParse(value);
    }
    if (value is num) {
      return value.toInt();
    }
    return null;
  }

  static String? _asString(Object? value) {
    if (value == null) return null;
    if (value is String) {
      return value;
    }
    return value.toString();
  }

  static double? _asDouble(Object? value) {
    if (value == null) return null;
    if (value is num) {
      return value.toDouble();
    }
    if (value is String) {
      return double.tryParse(value);
    }
    return null;
  }

  static Map<String, dynamic>? _asMap(Object? value) {
    if (value is Map<String, dynamic>) {
      return value;
    }
    if (value is Map) {
      return value.map((key, dynamic val) => MapEntry('$key', val));
    }
    if (value is String && value.trim().isNotEmpty) {
      try {
        final decoded = jsonDecode(value);
        if (decoded is Map<String, dynamic>) {
          return decoded;
        }
        if (decoded is Map) {
          return decoded.map((key, dynamic val) => MapEntry('$key', val));
        }
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  static DateTime? _parseDate(Object? value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    if (value is String && value.trim().isNotEmpty) {
      return DateTime.tryParse(value.trim());
    }
    return null;
  }
}

class _CatalogCard extends StatefulWidget {
  final _ServicePlanCatalogItem item;
  final Color accentColor;
  final Gradient gradient;
  final IconData icon;
  final String actionLabel;
  final VoidCallback onPressed;

  const _CatalogCard({
    required this.item,
    required this.accentColor,
    required this.gradient,
    required this.icon,
    required this.actionLabel,
    required this.onPressed,
  });

  @override
  State<_CatalogCard> createState() => _CatalogCardState();
}

class _CatalogCardState extends State<_CatalogCard> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final description = item.description?.trim();
    final hasDescription = description != null && description.isNotEmpty;

    final badges = <Widget>[
      _buildBadge(item.type == _CatalogItemType.plan ? 'Plan' : 'Servicio'),
    ];

    final category = item.category?.trim();
    if (category != null && category.isNotEmpty) {
      badges.add(_buildBadge(category));
    }
    if (item.identifierLabel != null && item.identifierLabel!.trim().isNotEmpty) {
      badges.add(_buildBadge(item.identifierLabel!));
    }

    final tariffHighlights = _buildTariffHighlights(item.tariffs);
    final associatedServices = item.associatedServices;

    return AnimatedScale(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOutCubic,
      scale: _isPressed ? 0.97 : 1,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 360),
        curve: Curves.easeOutCubic,
        decoration: BoxDecoration(
          gradient: widget.gradient,
          borderRadius: BorderRadius.circular(26),
          boxShadow: [
            BoxShadow(
              color: widget.accentColor.withOpacity(0.35),
              blurRadius: 30,
              offset: const Offset(0, 18),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(26),
            onHighlightChanged: (value) => setState(() => _isPressed = value),
            onTap: widget.onPressed,
            child: Padding(
              padding: const EdgeInsets.all(22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Hero(
                        tag: 'catalog-icon-${item.type.name}-${item.id}',
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.16),
                            borderRadius: BorderRadius.circular(18),
                          ),
                          child: Icon(
                            widget.icon,
                            size: 28,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.name,
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                              ),
                            ),
                            if (badges.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: badges,
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (hasDescription) ...[
                    const SizedBox(height: 14),
                    Text(
                      description!,
                      style: TextStyle(
                        fontSize: 14,
                        height: 1.4,
                        color: Colors.white.withOpacity(0.9),
                      ),
                    ),
                  ],
                  if (tariffHighlights.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    Text(
                      'Tarifas destacadas',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Colors.white.withOpacity(0.95),
                        letterSpacing: 0.2,
                      ),
                    ),
                    const SizedBox(height: 10),
                    ...tariffHighlights,
                  ],
                  if (item.type == _CatalogItemType.plan && associatedServices.isNotEmpty) ...[
                    const SizedBox(height: 18),
                    Text(
                      'Servicios incluidos',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Colors.white.withOpacity(0.95),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _buildServiceChips(associatedServices),
                    ),
                  ],
                  const SizedBox(height: 24),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Hero(
                      tag: 'catalog-action-${item.type.name}-${item.id}',
                      child: ElevatedButton.icon(
                        onPressed: widget.onPressed,
                        icon: const Icon(Icons.chevron_right_rounded, size: 20),
                        label: Text(widget.actionLabel),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: widget.accentColor,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 24,
                            vertical: 12,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(32),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBadge(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.16),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withOpacity(0.22)),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  List<Widget> _buildTariffHighlights(List<_TariffRule> rules) {
    if (rules.isEmpty) {
      return [
        Text(
          'Sin tarifas definidas por el momento.',
          style: TextStyle(
            color: Colors.white.withOpacity(0.85),
            fontSize: 12,
            fontStyle: FontStyle.italic,
          ),
        ),
      ];
    }

    final widgets = <Widget>[];
    final topRules = rules.take(2).toList();
    for (int index = 0; index < topRules.length; index++) {
      final rule = topRules[index];
      widgets.add(_buildTariffCard(rule));
      if (index != topRules.length - 1) {
        widgets.add(const SizedBox(height: 10));
      }
    }

    if (rules.length > topRules.length) {
      widgets.add(
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(
            '+${rules.length - topRules.length} reglas adicionales',
            style: TextStyle(
              color: Colors.white.withOpacity(0.8),
              fontSize: 12,
            ),
          ),
        ),
      );
    }

    return widgets;
  }

  Widget _buildTariffCard(_TariffRule rule) {
    final chips = _buildMetadataChips(rule);
    final price = _formatTariffPrice(rule);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _formatTariffTitle(rule),
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
              fontSize: 14,
            ),
          ),
          if (price != null) ...[
            const SizedBox(height: 6),
            Text(
              price,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
          if (chips.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: chips,
            ),
          ],
        ],
      ),
    );
  }

  String _formatTariffTitle(_TariffRule rule) {
    final title = rule.descripcion?.trim();
    if (title != null && title.isNotEmpty) {
      return title;
    }
    final code = rule.codigo ?? rule.id?.toString() ?? '';
    if (code.isEmpty) {
      return 'Tarifa disponible';
    }
    return 'Tarifa $code';
  }

  String? _formatTariffPrice(_TariffRule rule) {
    final value = rule.valor;
    if (value == null) {
      return null;
    }
    final currency = rule.moneda?.trim();
    final symbol = (currency == null || currency.isEmpty) ? 'S/' : currency;
    final decimals = value == value.roundToDouble() ? 0 : 2;
    final formatter = NumberFormat.currency(
      locale: 'es_PE',
      symbol: symbol,
      decimalDigits: decimals,
    );
    return formatter.format(value);
  }

  List<Widget> _buildMetadataChips(_TariffRule rule) {
    final chips = <Widget>[];

    void addChip(String label, String? value) {
      final content = value?.trim();
      if (content == null || content.isEmpty) {
        return;
      }
      chips.add(_buildChip('$label: $content'));
    }

    addChip('Cálculo', rule.tipoCalculo);
    addChip('Método', rule.metodoPago);
    addChip('Rol', rule.rolAplica);
    addChip('Región', rule.ambitoRegion);
    if (rule.incluyeImpuesto) {
      chips.add(_buildChip('Incluye impuestos'));
    }

    final formatter = DateFormat('dd/MM/yyyy');
    if (rule.vigenciaHasta != null) {
      chips.add(_buildChip('Vigente hasta ${formatter.format(rule.vigenciaHasta!)}'));
    }

    return chips;
  }

  Widget _buildChip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.14),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  List<Widget> _buildServiceChips(List<String> services) {
    final chips = <Widget>[];
    final limit = services.length > 6 ? 6 : services.length;
    for (int index = 0; index < limit; index++) {
      chips.add(
        Chip(
          backgroundColor: Colors.white.withOpacity(0.14),
          label: Text(
            services[index],
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 4),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      );
    }
    if (services.length > limit) {
      chips.add(_buildChip('+${services.length - limit} adicionales'));
    }
    return chips;
  }
}


int? _asInt(Object? value) => _TariffRule._asInt(value);