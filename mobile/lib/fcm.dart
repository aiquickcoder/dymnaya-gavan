import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api.dart';

/// Bumped whenever a call push arrives — the calls screen listens and reloads.
final ValueNotifier<int> callsBump = ValueNotifier<int>(0);

final FlutterLocalNotificationsPlugin _local = FlutterLocalNotificationsPlugin();

const AndroidNotificationChannel _channel = AndroidNotificationChannel(
  'calls',
  'Вызовы',
  description: 'Пуши о вызовах гостей',
  importance: Importance.high,
  playSound: true,
);

/// Background isolate handler — must be a top-level function. The system shows
/// the notification block automatically; we only nudge state for warm starts.
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  callsBump.value++;
}

class Fcm {
  static Future<void> init() async {
    await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    await _local.initialize(const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(),
    ));
    await _local
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_channel);

    await FirebaseMessaging.instance
        .setForegroundNotificationPresentationOptions(
            alert: true, badge: true, sound: true);

    // Foreground: show a local notification + refresh the list.
    FirebaseMessaging.onMessage.listen((m) {
      _showForeground(m);
      callsBump.value++;
    });
    // App opened from a push while backgrounded.
    FirebaseMessaging.onMessageOpenedApp.listen((_) => callsBump.value++);
  }

  static void _showForeground(RemoteMessage m) {
    final n = m.notification;
    if (n == null) return;
    _local.show(
      n.hashCode,
      n.title,
      n.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: const DarwinNotificationDetails(),
      ),
    );
  }

  static Future<String?> token() => FirebaseMessaging.instance.getToken();

  static String get platform => Platform.isIOS ? 'ios' : 'android';

  /// Upsert this device's token against the logged-in employee.
  static Future<void> register(
    ApiClient api, {
    required String employeeId,
    required String restaurantId,
  }) async {
    final t = await token();
    if (t == null) return;
    await api.registerDevice(
      employeeId: employeeId,
      restaurantId: restaurantId,
      platform: platform,
      token: t,
    );
    // Re-register if FCM rotates the token while the app is alive.
    FirebaseMessaging.instance.onTokenRefresh.listen((nt) {
      api.registerDevice(
        employeeId: employeeId,
        restaurantId: restaurantId,
        platform: platform,
        token: nt,
      );
    });
  }

  static Future<void> unregister(ApiClient api) async {
    final t = await token();
    if (t != null) await api.unregisterDevice(t);
  }
}
