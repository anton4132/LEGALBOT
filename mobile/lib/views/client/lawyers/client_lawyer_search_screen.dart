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
  String? _errorMessage;
  int? _selectedSpecialtyId;
  String? _selectedCountry;
  String? _selectedCity;

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
        _specialties = results[0] as List<LawyerSpecialty>;
        _locations = results[1] as List<LawyerLocationOption>;
        _loadingFilters = false;
      });
    } on UnauthorizedException catch (error) {
      _handleUnauthorized(error.message);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingFilters = false;
        _errorMessage = 'No se pudieron cargar los filtros: ${error.toString()}';
      });
    }
  }

  Future<void> _searchLawyers() async {
    final token = SessionService.instance.session?.token;
    setState(() {
      _loadingResults = true;
      _errorMessage = null;
    });

    try {
      final results = await ApiClient.searchLawyers(
        token: token,
        specialtyId: _selectedSpecialtyId,
        country: _selectedCountry,
        city: _selectedCity,
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
        _errorMessage = 'Error realizando la búsqueda: ${error.toString()}';
      });
      _showSnackBar('No se pudo completar la búsqueda. Inténtalo nuevamente.');
    }
  }

  List<String?> get _uniqueCountries {
    final set = <String?>{null};
    for (final location in _locations) {
      final country = location.pais?.trim();
      if (country != null && country.isNotEmpty) {
        set.add(country);
      }
    }
    final sorted = set.toList();
    sorted.sort((a, b) {
      final textA = (a ?? '').toLowerCase();
      final textB = (b ?? '').toLowerCase();
      return textA.compareTo(textB);
    });
    return sorted;
  }

  List<String?> get _filteredCities {
    if (_selectedCountry == null || _selectedCountry!.isEmpty) {
      return const [null];
    }
    final cities = <String?>{null};
    for (final location in _locations) {
      if ((location.pais ?? '').toLowerCase() ==
          _selectedCountry!.toLowerCase()) {
        final city = location.ciudad?.trim();
        if (city != null && city.isNotEmpty) {
          cities.add(city);
        }
      }
    }
    final sorted = cities.toList();
    sorted.sort((a, b) {
      final textA = (a ?? '').toLowerCase();
      final textB = (b ?? '').toLowerCase();
      return textA.compareTo(textB);
    });
    return sorted;
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
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final countries = _uniqueCountries;
    final cities = _filteredCities;

    return Scaffold(
      appBar: const CustomAppBar(title: 'Buscar Abogados'),
      body: SafeArea(
        child: _loadingFilters
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
                          DropdownButtonFormField<int?>(
                            value: _selectedSpecialtyId,
                            decoration: const InputDecoration(
                              labelText: 'Especialidad',
                              border: OutlineInputBorder(),
                            ),
                            items: [
                              const DropdownMenuItem<int?>(
                                value: null,
                                child: Text('Todas las especialidades'),
                              ),
                              ..._specialties.map(
                                (specialty) => DropdownMenuItem<int?>(
                                  value: specialty.id,
                                  child: Text(specialty.nombre),
                                ),
                              ),
                            ],
                            onChanged: (value) {
                              setState(() {
                                _selectedSpecialtyId = value;
                              });
                            },
                          ),
                          const SizedBox(height: 12),
                          DropdownButtonFormField<String?>(
                            value: _selectedCountry,
                            decoration: const InputDecoration(
                              labelText: 'País',
                              border: OutlineInputBorder(),
                            ),
                            items: countries
                                .map(
                                  (country) => DropdownMenuItem<String?>(
                                    value: country,
                                    child: Text(
                                      country?.isNotEmpty == true
                                          ? country!
                                          : 'Todos los países',
                                    ),
                                  ),
                                )
                                .toList(),
                            onChanged: (value) {
                              setState(() {
                                _selectedCountry = value;
                                _selectedCity = null;
                              });
                            },
                          ),
                          const SizedBox(height: 12),
                          DropdownButtonFormField<String?>(
                            value: _selectedCity,
                            decoration: const InputDecoration(
                              labelText: 'Ciudad',
                              border: OutlineInputBorder(),
                            ),
                            items: cities
                                .map(
                                  (city) => DropdownMenuItem<String?>(
                                    value: city,
                                    child: Text(
                                      city?.isNotEmpty == true
                                          ? city!
                                          : 'Todas las ciudades',
                                    ),
                                  ),
                                )
                                .toList(),
                            onChanged: (_selectedCountry == null ||
                                    _selectedCountry!.isEmpty)
                                ? null
                                : (value) {
                                    setState(() {
                                      _selectedCity = value;
                                    });
                                  },
                          ),
                          const SizedBox(height: 16),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: _loadingResults ? null : _searchLawyers,
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
                    Expanded(
                      child: _buildResults(),
                    ),
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

    if (_results.isEmpty) {
      return const Center(
        child: Text(
          'Utiliza los filtros para encontrar abogados disponibles.',
          textAlign: TextAlign.center,
        ),
      );
    }

    return ListView.separated(
      itemCount: _results.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final result = _results[index];
        final avatarProvider = result.avatarImageProvider;
        final locationLabel = result.estudioPrincipal != null
            ? result.estudioPrincipal!.ciudad != null &&
                    result.estudioPrincipal!.ciudad!.isNotEmpty
                ? '${result.estudioPrincipal!.ciudad!}${result.estudioPrincipal!.pais != null && result.estudioPrincipal!.pais!.isNotEmpty ? ', ' + result.estudioPrincipal!.pais! : ''}'
                : (result.estudioPrincipal!.pais ?? 'Ubicación no disponible')
            : 'Ubicación no disponible';

        return Card(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(12.0),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundImage: avatarProvider,
                  child: avatarProvider == null
                      ? Text(result.initials)
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
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        result.ratingLabel,
                        style: const TextStyle(fontSize: 13, color: Colors.black54),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        locationLabel,
                        style: const TextStyle(fontSize: 12, color: Colors.black45),
                      ),
                    ],
                  ),
                ),
                ElevatedButton(
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