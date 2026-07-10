import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'api.dart';
import 'fcm.dart';
import 'session.dart';
import 'theme.dart';
import 'screens/calls_screen.dart';
import 'screens/login_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
  await Fcm.init();
  final session = await Session.load();
  runApp(StaffApp(session: session));
}

class StaffApp extends StatelessWidget {
  StaffApp({super.key, required this.session});

  final Session session;
  final ApiClient api = ApiClient();

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'HookahCRM Staff',
      debugShowCheckedModeBanner: false,
      theme: Brand.theme(),
      home: session.isLoggedIn
          ? CallsScreen(api: api, session: session)
          : LoginScreen(api: api, session: session),
    );
  }
}
