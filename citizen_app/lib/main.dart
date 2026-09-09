import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'dart:async';

void main() {
  runApp(const HydraMindApp());
}

class HydraMindApp extends StatelessWidget {
  const HydraMindApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'HydraMind Citizen',
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF38BDF8),
          secondary: Color(0xFFF43F5E),
          surface: Color(0xFF1E293B),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF0F172A),
          elevation: 0,
        ),
      ),
      home: const CitizenDashboard(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class CitizenDashboard extends StatefulWidget {
  const CitizenDashboard({super.key});

  @override
  State<CitizenDashboard> createState() => _CitizenDashboardState();
}

class _CitizenDashboardState extends State<CitizenDashboard> {
  final MapController _mapController = MapController();
  LatLng? _currentPosition;
  String _riskLevel = "MONITORING";
  bool _offlineMode = true;

  @override
  void initState() {
    super.initState();
    _checkLocationPermission();
  }

  Future<void> _checkLocationPermission() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return;

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return;
    }

    if (permission == LocationPermission.deniedForever) return;

    // Simulate finding user location (Chennai by default)
    setState(() {
      _currentPosition = const LatLng(13.0827, 80.2707);
    });

    // Simulate background risk check
    Timer(const Duration(seconds: 4), () {
      if (mounted) {
        setState(() {
          _riskLevel = "CRITICAL_RISK";
        });
        _showEvacuationAlert();
      }
    });
  }

  void _showEvacuationAlert() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF7F1D1D),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.yellow, size: 28),
            SizedBox(width: 10),
            Text('FLASH FLOOD WARNING', style: TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        content: const Text(
          "AI Risk Engine detects extreme inundation risk in your grid cell.\n\nEvacuate immediately to the nearest highlighted shelter on your map.",
          style: TextStyle(fontSize: 16),
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: const Color(0xFF7F1D1D),
            ),
            onPressed: () => Navigator.pop(context),
            child: const Text("ROUTE TO SHELTER"),
          )
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("HydraMind", style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1.2)),
        actions: [
          Container(
            margin: const EdgeInsets.all(10),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: _offlineMode ? Colors.orange.withOpacity(0.2) : Colors.green.withOpacity(0.2),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: _offlineMode ? Colors.orange : Colors.green),
            ),
            child: Row(
              children: [
                Icon(
                  _offlineMode ? Icons.signal_wifi_off : Icons.wifi,
                  size: 16,
                  color: _offlineMode ? Colors.orange : Colors.green,
                ),
                const SizedBox(width: 8),
                Text(
                  _offlineMode ? "OFFLINE (MBTILES)" : "ONLINE",
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: _offlineMode ? Colors.orange : Colors.green,
                  ),
                ),
              ],
            ),
          )
        ],
      ),
      body: Stack(
        children: [
          // FlutterMap
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: const LatLng(13.0827, 80.2707),
              initialZoom: 12.0,
            ),
            children: [
              TileLayer(
                // In a real offline app, this would use an MBTiles package or local asset tiles
                urlTemplate: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                userAgentPackageName: 'com.hydramind.citizen',
              ),
              if (_currentPosition != null)
                MarkerLayer(
                  markers: [
                    Marker(
                      point: _currentPosition!,
                      width: 80,
                      height: 80,
                      child: const Icon(Icons.my_location, color: Colors.blueAccent, size: 30),
                    ),
                    // Dummy Nearest Shelter
                    const Marker(
                      point: LatLng(13.0235, 80.2415),
                      width: 50,
                      height: 50,
                      child: Icon(Icons.health_and_safety, color: Colors.greenAccent, size: 36),
                    )
                  ],
                ),
              // Dummy Route to shelter
              if (_riskLevel == "CRITICAL_RISK")
                PolylineLayer(
                  polylines: [
                    Polyline<Object>(
                      points: const [
                        LatLng(13.0827, 80.2707), // User
                        LatLng(13.0604, 80.2520), // Road A
                        LatLng(13.0235, 80.2415), // Shelter
                      ],
                      strokeWidth: 4.0,
                      color: Colors.blue,
                    )
                  ],
                )
            ],
          ),

          // Bottom Info Panel
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.5), blurRadius: 20, offset: const Offset(0, -5))
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 40,
                    height: 5,
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(5),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text("AREA STATUS", style: TextStyle(color: Colors.grey, fontSize: 12, letterSpacing: 1.5)),
                          const SizedBox(height: 5),
                          Text(
                            _riskLevel,
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: _riskLevel == "CRITICAL_RISK" ? Colors.redAccent : Colors.greenAccent,
                            ),
                          ),
                        ],
                      ),
                      FloatingActionButton(
                        onPressed: () {
                          if (_currentPosition != null) {
                            _mapController.move(_currentPosition!, 14.0);
                          }
                        },
                        backgroundColor: Theme.of(context).colorScheme.primary,
                        child: const Icon(Icons.navigation, color: Colors.white),
                      )
                    ],
                  ),
                ],
              ),
            ),
          )
        ],
      ),
    );
  }
}
