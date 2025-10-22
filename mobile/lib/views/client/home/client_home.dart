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
import '../../../widgets/custom_drawer.dart';
import '../../../widgets/custombtn.dart';
import '../../../widgets/gradient_container.dart';
import '../../../widgets/option_card.dart';
import '../../../widgets/section_header.dart';
import '../../../widgets/shadow_card.dart';
import '../../authentication/login_screen.dart';
import '../../lawyer/home/lawyer_home.dart';
import '../lawyers/client_lawyer_search_screen.dart';
import 'become_lawyer_screen.dart';
import 'client_settings_screen.dart';


class ClientHome extends StatefulWidget {
  const ClientHome({super.key});

  @override
  State<ClientHome> createState() => _ClientHomeState();
}
enum _ClientHomeView { dashboard, settings }

class _ClientHomeState extends State<ClientHome> {
  static const String _apiBaseUrl = 'http://localhost:3000/api';
  final TextEditingController _consultationController = TextEditingController();
  bool _isRecording = false;
  bool _isSwitchingAccount = false;
  _ClientHomeView _activeView = _ClientHomeView.dashboard;
  ClientSettingsSubsection _activeSettingsSubsection =
      ClientSettingsSubsection.overview;
  bool _isLoadingCatalog = false;
  String? _catalogError;
  List<_ServicePlanCatalogItem> _catalogItems = const [];

  final DateFormat _dateFormatter = DateFormat('dd/MM/yyyy');
  @override
  void initState() {
    super.initState();
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
    });

    try {
      final results = await Future.wait([
        _fetchServices(),
        _fetchPlans(),
        _fetchTariffRules(),
      ]);

      final services = results[0] as List<Map<String, dynamic>>;
      final plans = results[1] as List<Map<String, dynamic>>;
      final tariffs = results[2] as List<_TariffRule>;

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
      });
    } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _catalogError = error.message;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _catalogError = 'No se pudieron cargar los servicios y planes.';
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
      throw UnauthorizedException(resolvedMessage);    }
    if (response.statusCode >= 400) {
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
      return ShadowCard(
        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            SizedBox(
              height: 22,
              width: 22,
              child: CircularProgressIndicator(strokeWidth: 2.4),
            ),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'Cargando servicios y planes...',
                style: TextStyle(
                  fontSize: 13,
                  color: AppColors.text2Color,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      );
    }

    if (_catalogError != null) {
      return ShadowCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(
                  Icons.error_outline,
                  color: AppColors.text3Color,
                ),
                SizedBox(width: 8),
                Text(
                  'No se pudo cargar el catálogo',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: AppColors.buttonColor,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              _catalogError!,
              style: const TextStyle(
                fontSize: 13,
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

    if (_catalogItems.isEmpty) {
      return ShadowCard(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: const [
            Icon(
              Icons.info_outline,
              color: AppColors.button2Color,
            ),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'No hay servicios ni planes activos registrados por el momento.',
                style: TextStyle(
                  fontSize: 13,
                  color: AppColors.text2Color,
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        for (int i = 0; i < _catalogItems.length; i++)
          Padding(
            padding: EdgeInsets.only(bottom: i == _catalogItems.length - 1 ? 0 : 12),
            child: _buildCatalogCard(_catalogItems[i]),
          ),
      ],
    );
  }

  Widget _buildCatalogCard(_ServicePlanCatalogItem item) {
    final icon = item.type == _CatalogItemType.service
        ? Icons.miscellaneous_services
        : Icons.workspace_premium;
    final typeLabel = item.type == _CatalogItemType.service ? 'Servicio' : 'Plan';
    final accentColor =
        item.type == _CatalogItemType.service ? AppColors.button2Color : AppColors.tabColor;

    return ShadowCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                icon,
                color: accentColor,
                size: 28,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.name,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: AppColors.buttonColor,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        _buildInfoBadge(typeLabel, color: accentColor),
                        if (item.identifierLabel != null) ...[
                          const SizedBox(width: 8),
                          _buildInfoBadge(item.identifierLabel!),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          if ((item.description ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              item.description!.trim(),
              style: const TextStyle(
                fontSize: 13,
                height: 1.35,
                color: AppColors.text2Color,
              ),
            ),
          ],
          const SizedBox(height: 12),
          Text(
            'Reglas de tarifa',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: accentColor,
            ),
          ),
          const SizedBox(height: 8),
          _buildTariffRulesList(item.tariffs),
        ],
      ),
    );
  }

  Widget _buildTariffRulesList(List<_TariffRule> rules) {
    if (rules.isEmpty) {
      return const Text(
        'Sin reglas de tarifa registradas.',
        style: TextStyle(
          fontSize: 13,
          color: AppColors.text2Color,
        ),
      );
    }

    return Column(
      children: [
        for (int i = 0; i < rules.length; i++)
          Padding(
            padding: EdgeInsets.only(bottom: i == rules.length - 1 ? 0 : 10),
            child: _buildTariffRuleTile(rules[i]),
          ),
      ],
    );
  }

  Widget _buildTariffRuleTile(_TariffRule rule) {
    final chips = <Widget>[];

    void addChip(String field, String? value) {
      final text = value?.trim();
      if (text == null || text.isEmpty) return;
      chips.add(_buildInfoBadge('$field: $text'));
    }

    addChip('codigo', rule.codigo);
    addChip('tipo_calculo', rule.tipoCalculo);
    if (rule.valor != null) {
      addChip('valor', rule.valor!.toStringAsFixed(2));
    }
    addChip('moneda', rule.moneda);
    addChip('rol_aplica', rule.rolAplica);
    addChip('metodo_pago', rule.metodoPago);
    addChip('ambito_region', rule.ambitoRegion);
    addChip('incluye_impuesto', rule.incluyeImpuesto.toString());
    if (rule.prioridad != null) {
      addChip('prioridad', rule.prioridad.toString());
    }
    addChip('vigencia_desde', _formatDate(rule.vigenciaDesde));
    addChip('vigencia_hasta', _formatDate(rule.vigenciaHasta));

    final parametrosText = _formatParametros(rule.parametros);

    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.strokeColor),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            rule.descripcion?.trim().isNotEmpty == true
                ? rule.descripcion!.trim()
                : 'Regla ${rule.codigo ?? rule.id?.toString() ?? ''}'.trim(),
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.buttonColor,
            ),
          ),
          const SizedBox(height: 8),
          if (chips.isNotEmpty)
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: chips,
            ),
          if (parametrosText != null) ...[
            const SizedBox(height: 10),
            Text(
              'parametros: $parametrosText',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.text2Color,
                height: 1.35,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildInfoBadge(String text, {Color color = AppColors.button2Color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }

  String? _formatParametros(Map<String, dynamic>? parametros) {
    if (parametros == null || parametros.isEmpty) {
      return null;
    }
    try {
      return const JsonEncoder.withIndent('  ').convert(parametros);
    } catch (_) {
      return parametros.toString();
    }
  }

  String? _formatDate(DateTime? date) {
    if (date == null) return null;
    return _dateFormatter.format(date);
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
        const SectionHeader(title: 'Servicios'),
        const SizedBox(height: 15),
        _buildServicePlanSection(),
        const SizedBox(height: 20),
        const SectionHeader(title: 'Accesos rápidos'),
        const SizedBox(height: 15),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          crossAxisSpacing: 15,
          mainAxisSpacing: 15,
          childAspectRatio: 1.1,
          children: [
            OptionCard(
              icon: Icons.question_answer,
              title: 'Consultas\nLegales',
              color: AppColors.button2Color,
              onTap: () {
                // TODO
              },
            ),
            OptionCard(
              icon: Icons.directions_car,
              title: 'Búsqueda\nVehicular',
              color: AppColors.tabColor,
              onTap: () {
                // TODO
              },
            ),
            OptionCard(
              icon: Icons.search,
              title: 'Buscar\nAbogados',
              color: AppColors.buttonColor,
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const ClientLawyerSearchScreen(),
                  ),
                );
              },
            ),
            OptionCard(
              icon: Icons.history,
              title: 'Mi\nHistorial',
              color: AppColors.text3Color,
              onTap: () {
                // TODO
              },
            ),
          ],
        ),
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
        final bool hasLawyerAccount = session?.hasLawyerAccount ?? false;
        final String displayName =
            (session?.nombreCompleto?.trim().isNotEmpty ?? false)
                ? session!.nombreCompleto!.trim()
                : 'Cliente';
        final String drawerSubtitle =
            hasLawyerAccount
                ? 'Gestiona tus roles desde LegalBot'
                : 'Bienvenido a LegalBot';
final UserAccount? lawyerAccount = _lawyerAccountForSession(session);
        final bool settingsActive = _activeView == _ClientHomeView.settings;
        return Scaffold(
          appBar: const CustomAppBar(title: 'LegalBot - Cliente'),
          drawer: CustomDrawer(
            userType: 'Cliente',
            userIcon: Icons.person,
            userName: displayName,
            subtitle: drawerSubtitle,
            items: [
DrawerItem(
                icon: Icons.home,
                title: 'Inicio',
                selected: _activeView == _ClientHomeView.dashboard,
                onTap: _showHomeView,
              ),              DrawerItem(
                icon: Icons.search,
                title: 'Buscar Abogados',
                onTap: () {
                  Navigator.of(context).pop();
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const ClientLawyerSearchScreen(),
                    ),
                  );
                },
              ),
              DrawerItem(
                icon: Icons.question_answer,
                title: 'Consultas Legales',
                onTap: () {
                  // TODO
                },
              ),
              DrawerItem(
                icon: Icons.directions_car,
                title: 'Búsqueda Vehicular',
                onTap: () {
                  // TODO
                },
              ),
              DrawerItem(
                icon: Icons.history,
                title: 'Historial',
                onTap: () {
                  // TODO
                },
              ),
              DrawerItem(
                icon: Icons.workspace_premium_rounded,
                title: 'Panel Abogado',
                onTap:
                    _isSwitchingAccount
                        ? null
                        : () => _navigateToLawyerPanel(session),
              ),
              DrawerItem(
                icon: Icons.settings,
                title: 'Configuración',
                         selected: settingsActive,
                initiallyExpanded: settingsActive,
                children: [
                  DrawerItem(
                    title: 'Resumen general',
                    selected: settingsActive &&
                        _activeSettingsSubsection ==
                            ClientSettingsSubsection.overview,
                    onTap: () =>
                        _openSettingsSubsection(ClientSettingsSubsection.overview),
                  ),
                  DrawerItem(
                    title: 'Edición de datos de contacto',
                    selected: settingsActive &&
                        _activeSettingsSubsection ==
                            ClientSettingsSubsection.contact,
                    onTap: () =>
                        _openSettingsSubsection(ClientSettingsSubsection.contact),
                  ),
                  DrawerItem(
                    title: 'Seguridad',
                    selected: settingsActive &&
                        _activeSettingsSubsection ==
                            ClientSettingsSubsection.security,
                    onTap: () =>
                        _openSettingsSubsection(ClientSettingsSubsection.security),
                  ),
                ],
              ),
            ],
            onLogout: _handleLogout,
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

  const _ServicePlanCatalogItem({
    required this.id,
    required this.name,
    required this.type,
    required this.tariffs,
    this.description,
    this.isActive = true,
    this.identifierLabel,
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
    );
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

int? _asInt(Object? value) => _TariffRule._asInt(value);