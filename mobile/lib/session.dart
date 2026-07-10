import 'package:shared_preferences/shared_preferences.dart';

/// Persisted staff session (restaurant + who I am). No password in MVP —
/// identity is the picked employee under the venue code (add a PIN later).
class Session {
  String? restaurantId;
  String? restaurantName;
  String? employeeId;
  String? employeeName;

  bool get isLoggedIn => restaurantId != null && employeeId != null;

  static Future<Session> load() async {
    final p = await SharedPreferences.getInstance();
    final s = Session()
      ..restaurantId = _nz(p.getString('restaurantId'))
      ..restaurantName = _nz(p.getString('restaurantName'))
      ..employeeId = _nz(p.getString('employeeId'))
      ..employeeName = _nz(p.getString('employeeName'));
    return s;
  }

  Future<void> save() async {
    final p = await SharedPreferences.getInstance();
    await p.setString('restaurantId', restaurantId ?? '');
    await p.setString('restaurantName', restaurantName ?? '');
    await p.setString('employeeId', employeeId ?? '');
    await p.setString('employeeName', employeeName ?? '');
  }

  Future<void> clear() async {
    final p = await SharedPreferences.getInstance();
    for (final k in ['restaurantId', 'restaurantName', 'employeeId', 'employeeName']) {
      await p.remove(k);
    }
    restaurantId = restaurantName = employeeId = employeeName = null;
  }

  static String? _nz(String? v) => (v == null || v.isEmpty) ? null : v;
}
