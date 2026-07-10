import 'dart:convert';

import 'package:http/http.dart' as http;

import 'config.dart';
import 'models.dart';

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

/// Thin client over the Go API. Every response is the `{data, error}` envelope;
/// [_unwrap] returns `data` or throws [ApiException] with the server message.
class ApiClient {
  final http.Client _http = http.Client();

  Uri _u(String path) => Uri.parse('${Config.apiBase}$path');

  Future<dynamic> _post(String path, [Map<String, dynamic>? body]) async {
    final r = await _http.post(_u(path),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body ?? const {}));
    return _unwrap(r);
  }

  Future<dynamic> _get(String path) async => _unwrap(await _http.get(_u(path)));

  dynamic _unwrap(http.Response r) {
    if (r.statusCode == 204 || r.body.isEmpty) {
      if (r.statusCode >= 400) throw ApiException('Ошибка ${r.statusCode}');
      return null;
    }
    final j = jsonDecode(r.body);
    if (r.statusCode >= 400) {
      final msg = (j is Map && j['error'] is Map) ? j['error']['message'] : null;
      throw ApiException((msg as String?) ?? 'Ошибка ${r.statusCode}');
    }
    return j is Map ? j['data'] : j;
  }

  // ---- auth ----
  Future<({Restaurant restaurant, List<Employee> employees})> login(
      String code) async {
    final d = await _post('/restaurants/employees', {'code': code});
    final rest = Restaurant.fromJson(d['restaurant'] as Map<String, dynamic>);
    final emps = (d['employees'] as List)
        .map((e) => Employee.fromJson(e as Map<String, dynamic>))
        .toList();
    return (restaurant: rest, employees: emps);
  }

  // ---- shift (roster for today) ----
  Future<List<String>> onShiftIds(String restaurantId) async {
    final d = await _get('/restaurants/$restaurantId/shift');
    return (d as List).map((e) => e['id'] as String).toList();
  }

  Future<void> setShift(String restaurantId, List<String> employeeIds) =>
      _post('/restaurants/$restaurantId/shift', {'employeeIds': employeeIds});

  // ---- calls ----
  Future<List<Call>> activeCalls(String restaurantId) async {
    final d = await _post('/calls/list', {'restaurantId': restaurantId});
    return (d as List)
        .map((e) => Call.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> ackCall(String id) => _post('/calls/$id/ack');
  Future<void> doneCall(String id) => _post('/calls/$id/done');

  // ---- device push tokens ----
  Future<void> registerDevice({
    required String employeeId,
    required String restaurantId,
    required String platform,
    required String token,
  }) =>
      _post('/devices/register', {
        'employeeId': employeeId,
        'restaurantId': restaurantId,
        'platform': platform,
        'token': token,
      });

  Future<void> unregisterDevice(String token) =>
      _post('/devices/unregister', {'token': token});
}
