import 'package:flutter/material.dart';

import '../../../constants/colors.dart';
import '../../../models/lawyer_profile_models.dart';
import '../../../models/lawyer_search_result.dart';
import '../../../services/api_client.dart';
import '../../../services/session_service.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../authentication/login_screen.dart';
import '../home/client_home.dart';
import '../home/client_settings_screen.dart';
import '../widgets/client_navigation_drawer.dart';
import 'client_lawyer_detail_screen.dart';

class ClientLawyerSearchScreen extends StatefulWidget {
  const ClientLawyerSearchScreen({super.key});

  @override
  State<ClientLawyerSearchScreen> createState() =>
      _ClientLawyerSearchScreenState();
}

class _ClientLawyerSearchScreenState extends State<ClientLawyerSearchScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  List<LawyerSpecialty> _specialties = const [];
  List<LawyerLocationOption> _locations = const [];
  List<LawyerSearchResult> _results = const [];
  bool _loadingFilters = true;
  bool _loadingResults = false;
  bool _hasAttemptedSearch = false;
  String? _errorMessage;
  int? _selectedSpecialtyId;
  LawyerLocationOption? _selectedDepartamento;
  LawyerLocationProvince? _selectedProvincia;
  LawyerLocationDistrict? _selectedDistrito;

  @override
  void initState() {
    super.initState();
    _loadFilters();
  }

  Future<void> _loadFilters() async {
    setState(() {
      _loadingFilters = true;
      _errorMessage = null;
    });

    final token = SessionService.instance.session?.token;

    try {
      final results = await Future.wait([
        ApiClient.fetchSpecialtyCatalog(),
        ApiClient.listLawyerLocations(token: token),
      ]);
      if (!mounted) return;
      setState(() {
        final specialties = results[0] as List<LawyerSpecialty>;
        final locationsResult = List<LawyerLocationOption>.from(
          results[1] as List<LawyerLocationOption>,
        )..sort((a, b) => a.key.compareTo(b.key));
        _specialties = specialties;
        _locations = List.unmodifiable(locationsResult);
        _selectedDepartamento = null;
        _selectedProvincia = null;
        _selectedDistrito = null;
        _selectedSpecialtyId = null;
        _results = const [];
        _hasAttemptedSearch = false;
        _loadingFilters = false;
      });
    } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingFilters = false;
        _errorMessage =
            'No se pudieron cargar los filtros: ${error.toString()}';
      });
    }
  }

  Future<void> _searchLawyers() async {
    final specialtyId = _selectedSpecialtyId;
    final departamento = _selectedDepartamento?.departamento;
    final provincia = _selectedProvincia?.provincia;
    final distrito = _selectedDistrito?.distrito;

    if (specialtyId == null ||
        departamento == null ||
        provincia == null ||
        distrito == null) {
      return;
    }
    final token = SessionService.instance.session?.token;
    setState(() {
      _loadingResults = true;
      _errorMessage = null;
      _hasAttemptedSearch = true;
    });

    try {
      final results = await ApiClient.searchLawyers(
        token: token,
        specialtyId: specialtyId,
        departamento: departamento,
        provincia: provincia,
        distrito: distrito,
      );
      if (!mounted) return;
      setState(() {
        _results = results;
        _loadingResults = false;
      });
    } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingResults = false;
        _hasAttemptedSearch = true;
        _errorMessage = 'Error realizando la búsqueda: ${error.toString()}';
      });
      _showSnackBar('No se pudo completar la búsqueda. Inténtalo nuevamente.');
    }
  }

  List<LawyerLocationOption> get _departamentosOrdenados {
    final list = _locations
        .where((option) => option.hasNombre && option.provincias.isNotEmpty)
        .toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    return list;
  }

  List<LawyerLocationProvince> get _provinciasDisponibles {
    final seleccionado = _selectedDepartamento;
    if (seleccionado == null) {
      return const [];
    }
    return seleccionado.sortedProvinces
        .where((province) => province.hasNombre && province.distritos.isNotEmpty)
        .toList();
  }

  List<LawyerLocationDistrict> get _distritosDisponibles {
    final provincia = _selectedProvincia;
    if (provincia == null) {
      return const [];
    }
    return provincia.sortedDistricts
        .where((district) => district.hasNombre)
        .toList();
  }

  bool get _filtersAreComplete {
    return _selectedSpecialtyId != null &&
        _selectedDepartamento != null &&
        _selectedProvincia != null &&
        _selectedDistrito != null;
  }

  void _handleUnauthorized(String? message) {
    SessionService.instance.clear();
    if (!mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          (message ?? 'Tu sesión ha expirado. Inicia sesión nuevamente.')
              .trim(),
        ),
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
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: CustomAppBar(
        title: 'Buscar Abogados',
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
        child: _loadingFilters
            ? const Center(
                child: CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(
                    AppColors.button2Color,
                  ),
                ),
              )
            : Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_errorMessage != null && !_hasAttemptedSearch)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppColors.text3Color.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppColors.text3Color),
                          ),
                          child: Text(
                            _errorMessage!,
                            style: const TextStyle(
                              color: AppColors.text3Color,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final bool horizontal = constraints.maxWidth >= 720;
                        final form = _buildFiltersForm();
                        final indicator = _buildFilterStateIndicator();

                        if (horizontal) {
                          return Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(child: form),
                              const SizedBox(width: 24),
                              ConstrainedBox(
                                constraints:
                                    const BoxConstraints(maxWidth: 280),
                                child: indicator,
                              ),
                            ],
                          );
                        }

                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Align(
                              alignment: Alignment.centerRight,
                              child: ConstrainedBox(
                                constraints:
                                    const BoxConstraints(maxWidth: 260),
                                child: indicator,
                              ),
                            ),
                            const SizedBox(height: 16),
                            form,
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 20),
                    Expanded(child: _buildResults()),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildFiltersForm() {
    final departamentos = _departamentosOrdenados;
    final provincias = _provinciasDisponibles;
    final distritos = _distritosDisponibles;
    final bool canSearch = !_loadingResults && _filtersAreComplete;

    return Form(
      key: _formKey,
      child: Column(
        children: [
          DropdownButtonFormField<int>(
            value: _selectedSpecialtyId,
            decoration: const InputDecoration(
              labelText: 'Especialidad',
            ),
            hint: const Text('Selecciona una especialidad'),
            menuMaxHeight: 260,
            items: _specialties
                .map(
                  (specialty) => DropdownMenuItem<int>(
                    value: specialty.id,
                    child: Text(specialty.nombre),
                  ),
                )
                .toList(),
            onChanged: (value) {
              setState(() {
                _selectedSpecialtyId = value;
                _hasAttemptedSearch = false;
                _results = const [];
              });
            },
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<LawyerLocationOption>(
            value: _selectedDepartamento,
            decoration: const InputDecoration(
              labelText: 'Departamento',
            ),
            hint: const Text('Selecciona un departamento'),
            menuMaxHeight: 260,
            items: departamentos
                .map(
                  (option) => DropdownMenuItem<LawyerLocationOption>(
                    value: option,
                    child: Text(option.departamento),
                  ),
                )
                .toList(),
            onChanged: (value) {
              setState(() {
                _selectedDepartamento = value;
                _selectedProvincia = null;
                _selectedDistrito = null;
                _results = const [];
                _hasAttemptedSearch = false;
              });
            },
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<LawyerLocationProvince>(
            value: _selectedProvincia,
            decoration: const InputDecoration(
              labelText: 'Provincia',
            ),
            hint: const Text('Selecciona una provincia'),
            menuMaxHeight: 260,
            items: provincias
                .map(
                  (province) => DropdownMenuItem<LawyerLocationProvince>(
                    value: province,
                    child: Text(province.provincia),
                  ),
                )
                .toList(),
            onChanged: _selectedDepartamento == null
                ? null
                : (value) {
                    setState(() {
                      _selectedProvincia = value;
                      _selectedDistrito = null;
                      _results = const [];
                      _hasAttemptedSearch = false;
                    });
                  },
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<LawyerLocationDistrict>(
            value: _selectedDistrito,
            decoration: const InputDecoration(
              labelText: 'Distrito',
            ),
            hint: const Text('Selecciona un distrito'),
            menuMaxHeight: 260,
            items: distritos
                .map(
                  (district) => DropdownMenuItem<LawyerLocationDistrict>(
                    value: district,
                    child: Text(district.distrito),
                  ),
                )
                .toList(),
            onChanged: _selectedProvincia == null
                ? null
                : (value) {
                    setState(() {
                      _selectedDistrito = value;
                      _results = const [];
                      _hasAttemptedSearch = false;
                    });
                  },
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: canSearch ? _searchLawyers : null,
              icon: const Icon(Icons.search),
              label: Text(_loadingResults ? 'Buscando...' : 'Buscar'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterStateIndicator() {
    final bool filtersReady = _filtersAreComplete;
    final bool searching = _loadingResults;
    final bool attempted = _hasAttemptedSearch;
    final bool hasResults = _results.isNotEmpty;
    final bool hasError = _errorMessage != null && attempted;

    IconData icon;
    Color iconColor;
    String title;
    String description;

    if (searching) {
      icon = Icons.autorenew;
      iconColor = AppColors.button2Color;
      title = 'Buscando abogados';
      description = 'Estamos analizando disponibilidad según tus filtros.';
    } else if (!filtersReady) {
      icon = Icons.hourglass_empty;
      iconColor = AppColors.text2Color;
      title = 'Filtros incompletos';
      description = 'Completa todos los campos para iniciar la búsqueda.';
    } else if (hasError) {
      icon = Icons.error_outline;
      iconColor = AppColors.text3Color;
      title = 'No se pudo buscar';
      description = 'Revisa tu conexión e inténtalo nuevamente.';
    } else if (attempted) {
      if (hasResults) {
        icon = Icons.check_circle_outline;
        iconColor = AppColors.buttonColor;
        title = 'Resultados listos';
        description = 'Revisa la lista para elegir al abogado ideal.';
      } else {
        icon = Icons.search_off;
        iconColor = AppColors.tabColor;
        title = 'Sin coincidencias';
        description = 'Ajusta los filtros e inténtalo otra vez.';
      }
    } else {
      icon = Icons.manage_search;
      iconColor = AppColors.buttonColor;
      title = 'Listo para buscar';
      description = 'Presiona “Buscar” cuando completes los filtros.';
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.strokeColor),
        boxShadow: [
          BoxShadow(
            color: AppColors.buttonColor.withOpacity(0.08),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 36, color: iconColor),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.text1Color,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            description,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.text2Color,
            ),
          ),
          if (searching) ...[
            const SizedBox(height: 16),
            const SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                valueColor: AlwaysStoppedAnimation<Color>(
                  AppColors.button2Color,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildResults() {
    if (_loadingResults) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(AppColors.button2Color),
        ),
      );
    }

    if (!_hasAttemptedSearch) {
      return _buildStatusMessage(
        icon: Icons.travel_explore,
        title: 'Completa los filtros para iniciar la búsqueda',
        description:
            'Selecciona especialidad, departamento, provincia y distrito.',
        color: AppColors.buttonColor,
      );
    }

    if (_errorMessage != null) {
      return _buildStatusMessage(
        icon: Icons.error_outline,
        title: 'No se pudo completar la búsqueda',
        description: _errorMessage,
        color: AppColors.text3Color,
      );
    }

    if (_results.isEmpty) {
      return _buildStatusMessage(
        icon: Icons.search_off,
        title: 'No encontramos abogados para los filtros seleccionados',
        description: 'Prueba ajustando la especialidad o la ubicación.',
        color: AppColors.tabColor,
      );
    }

    return ListView.separated(
      itemCount: _results.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final result = _results[index];
        final avatarProvider = result.avatarImageProvider;
        final estudio = result.estudioPrincipal;
        final locationParts = <String?>[
          estudio?.distrito,
          estudio?.provincia,
          estudio?.departamento,
        ]
            .whereType<String>()
            .map((value) => value.trim())
            .where((value) => value.isNotEmpty)
            .toList();
        final locationLabel = locationParts.isNotEmpty
            ? locationParts.join(', ')
            : 'Ubicación no disponible';

        return Card(
          elevation: 2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundImage: avatarProvider,
                  backgroundColor: AppColors.buttonColor.withOpacity(0.1),
                  child: avatarProvider == null
                      ? Text(
                          result.initials,
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
                        result.nombreCompleto ?? 'Abogado sin nombre',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: AppColors.text1Color,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        result.ratingLabel,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.text2Color,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        locationLabel,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.text2Color,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => ClientLawyerDetailScreen(
                          lawyerId: result.usuarioId,
                          initialResult: result,
                        ),
                      ),
                    );
                  },
                  icon: const Icon(Icons.visibility),
                  label: const Text('Ver perfil'),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStatusMessage({
    required IconData icon,
    required String title,
    String? description,
    required Color color,
  }) {
    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 420),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.strokeColor),
          boxShadow: [
            BoxShadow(
              color: AppColors.buttonColor.withOpacity(0.06),
              blurRadius: 18,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: color),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.text1Color,
              ),
            ),
            if (description != null) ...[
              const SizedBox(height: 8),
              Text(
                description,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.text2Color,
                ),
              ),
            ],
          ],
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
}
