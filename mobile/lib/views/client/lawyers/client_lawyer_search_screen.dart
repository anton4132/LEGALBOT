import 'package:flutter/material.dart';

import '../../../models/lawyer_profile_models.dart';
import '../../../models/lawyer_search_result.dart';
import '../../../services/api_client.dart';
import '../../../services/session_service.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../authentication/login_screen.dart';
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
        backgroundColor: Colors.red,
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
    final departamentos = _departamentosOrdenados;
    final provincias = _provinciasDisponibles;
    final distritos = _distritosDisponibles;
    final canSearch =
        !_loadingResults &&
        _selectedSpecialtyId != null &&
        _selectedDepartamento != null &&
        _selectedProvincia != null &&
        _selectedDistrito != null;

    return Scaffold(
      appBar: const CustomAppBar(title: 'Buscar Abogados'),
      body: SafeArea(
        child:
            _loadingFilters
                ? const Center(child: CircularProgressIndicator())
                : Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (_errorMessage != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Text(
                            _errorMessage!,
                            style: const TextStyle(
                              color: Colors.red,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      Form(
                        key: _formKey,
                        child: Column(
                          children: [
                            DropdownButtonFormField<int>(
                              value: _selectedSpecialtyId,
                              decoration: const InputDecoration(
                                labelText: 'Especialidad',
                                border: OutlineInputBorder(),
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
                                border: OutlineInputBorder(),
                              ),
                              hint: const Text('Selecciona un departamento'),
                              menuMaxHeight: 260,
                              items: departamentos
                                  .map(
                                    (option) => DropdownMenuItem<
                                      LawyerLocationOption
                                    >(
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
                                border: OutlineInputBorder(),
                              ),
                              hint: const Text('Selecciona una provincia'),
                              menuMaxHeight: 260,
                               items: provincias
                                  .map(
                                    (province) => DropdownMenuItem<
                                      LawyerLocationProvince
                                    >(
                                      value: province,
                                      child: Text(province.provincia),
                                    ),
                                  )
                                  .toList(),
                                  onChanged:
                                  _selectedDepartamento == null
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
                                border: OutlineInputBorder(),
                              ),
                              hint: const Text('Selecciona un distrito'),
                              menuMaxHeight: 260,
                               items: distritos
                                  .map(
                                    (district) => DropdownMenuItem<
                                      LawyerLocationDistrict
                                    >(
                                      value: district,
                                      child: Text(district.distrito),
                                    ),
                                  )
                                  .toList(),

                              onChanged:
                                  _selectedProvincia == null
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
                                label: Text(
                                  _loadingResults ? 'Buscando...' : 'Buscar',
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      Expanded(child: _buildResults()),
                    ],
                  ),
                ),
      ),
    );
  }

  Widget _buildResults() {
    if (_loadingResults) {
      return const Center(child: CircularProgressIndicator());
    }
    if (!_hasAttemptedSearch) {
      return const Center(
        child: Text(
          'Selecciona una especialidad y completa la ubicación para iniciar la búsqueda.',
          textAlign: TextAlign.center,
        ),
      );
    }

    if (_results.isEmpty) {
      return const Center(
        child: Text('uppssss no se encontró nada', textAlign: TextAlign.center),
      );
    }

    return ListView.separated(
      itemCount: _results.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final result = _results[index];
        final avatarProvider = result.avatarImageProvider;
        final estudio = result.estudioPrincipal;
        final locationParts =
            <String?>[
                  estudio?.distrito,
                  estudio?.provincia,
                  estudio?.departamento,
                ]
                .whereType<String>()
                .map((value) => value.trim())
                .where((value) => value.isNotEmpty)
                .toList();
        final locationLabel =
            locationParts.isNotEmpty
                ? locationParts.join(', ')
                : 'Ubicación no disponible';

        return Card(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12.0),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundImage: avatarProvider,
                  child: avatarProvider == null ? Text(result.initials) : null,
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
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        result.ratingLabel,
                        style: const TextStyle(
                          fontSize: 13,
                          color: Colors.black54,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        locationLabel,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.black45,
                        ),
                      ),
                    ],
                  ),
                ),
                ElevatedButton(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder:
                            (_) => ClientLawyerDetailScreen(
                              lawyerId: result.usuarioId,
                              initialResult: result,
                            ),
                      ),
                    );
                  },
                  child: const Text('Ver perfil'),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
