import 'package:flutter/material.dart';
import 'package:legalserviceapp/Constants/colors.dart';
import 'package:legalserviceapp/views/Authentication/login_screen.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  OnboardingScreenState createState() => OnboardingScreenState();
}

class OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentIndex = 0;
  final List<Map<String, String>> onboardingData = [
    {
      'image': 'images/o1.png',
      'title': 'Ayuda Legal al Instante',
      'description': 'Busca apoyo legal en cualquier momento.'
    },
    {
      "image": "images/o3.jpg",
      "title": "Documentos Legales Inteligentes",
      "description": "Accede a formatos adaptativos e información siempre disponible."
    },

    {
      'image': 'images/o2.jpg',
      'title': 'Ofrece tus Servicios',
      'description': 'Si eres abogado, conecta con clientes y gestiona tus citas fácilmente.'
    },

  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        children: [
          Expanded(
            child: PageView.builder(
              controller: _pageController,
              itemCount: onboardingData.length,
              onPageChanged: (index) {
                setState(() {
                  _currentIndex = index;
                });
              },
              itemBuilder: (context, index) {
                return Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 350,
                      height: 350,
                      padding: EdgeInsets.all(1),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,

                      ),

                      child: ClipOval(
                        child: Image.asset(
                          onboardingData[index]['image']!,
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                    SizedBox(height: 20),
                    Text(
                      onboardingData[index]['title']!,
                      style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: Colors.black87),
                      textAlign: TextAlign.center,
                    ),
                    SizedBox(height: 10),
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: 30),
                      child: Text(
                        onboardingData[index]['description']!,
                        style: TextStyle(fontSize: 16, color: Colors.grey[700]),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(onboardingData.length, (index) {
              return Container(
                margin: EdgeInsets.symmetric(horizontal: 5.0),
                width: _currentIndex == index ? 12.0 : 8.0,
                height: _currentIndex == index ? 12.0 : 8.0,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _currentIndex == index ? AppColors.buttonColor : Colors.grey,
                ),
              );
            }),
          ),
          SizedBox(height: 20),
          Padding(
            padding: const EdgeInsets.all(20.0),
            child: _currentIndex == onboardingData.length - 1
                ? ElevatedButton(
              onPressed: () {
                // Navigate to the next screen
                Navigator.push(context, MaterialPageRoute(builder:(_)=>LoginScreen()));
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.buttonColor,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                padding: EdgeInsets.symmetric(vertical: 15, horizontal: 30),
              ),
              child: Text("Empezar", style: TextStyle(fontSize: 18,color: Colors.white)),
            )
                : SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}
