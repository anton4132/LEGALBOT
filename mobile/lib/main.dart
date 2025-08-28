import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';


import 'constants/colors.dart';
import 'views/splash/splashscreen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

/// Habilita drag/scroll con mouse, trackpad, stylus, etc. (desktop/web)
class MyScrollBehavior extends MaterialScrollBehavior {
  @override
  Set<PointerDeviceKind> get dragDevices => {
    PointerDeviceKind.touch,
    PointerDeviceKind.mouse,
    PointerDeviceKind.trackpad,
    PointerDeviceKind.stylus,
    PointerDeviceKind.unknown,
  };
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Legal Services App',
      debugShowCheckedModeBanner: false,
      scrollBehavior: MyScrollBehavior(), // 👈 importante para desktop/web
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: AppColors.bgColor,
      ),
      home: const SplashScreen(), // si tu SplashScreen es const-safe
    );
  }
}

