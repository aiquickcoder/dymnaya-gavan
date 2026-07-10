import 'package:flutter/material.dart';

import '../api.dart';
import '../fcm.dart';
import '../models.dart';
import '../session.dart';
import '../theme.dart';
import 'calls_screen.dart';

class LoginScreen extends StatefulWidget {
  final ApiClient api;
  final Session session;
  const LoginScreen({super.key, required this.api, required this.session});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _code = TextEditingController();
  bool _busy = false;
  String? _error;
  Restaurant? _restaurant;
  List<Employee> _employees = const [];

  Future<void> _lookup() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final r = await widget.api.login(_code.text.trim());
      setState(() {
        _restaurant = r.restaurant;
        _employees = r.employees;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _pick(Employee e) async {
    setState(() => _busy = true);
    final s = widget.session
      ..restaurantId = _restaurant!.id
      ..restaurantName = _restaurant!.name
      ..employeeId = e.id
      ..employeeName = e.display;
    await s.save();
    try {
      await Fcm.register(widget.api,
          employeeId: e.id, restaurantId: _restaurant!.id);
    } catch (_) {
      // push registration is best-effort; the app still works via polling.
    }
    if (!mounted) return;
    Navigator.of(context).pushReplacement(MaterialPageRoute(
      builder: (_) => CallsScreen(api: widget.api, session: s),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 28),
              const Text('HookahCRM',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
              const Text('Приложение персонала',
                  style: TextStyle(color: Brand.muted)),
              const SizedBox(height: 28),
              if (_restaurant == null) ...[
                TextField(
                  controller: _code,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(
                    labelText: 'Код заведения',
                    hintText: 'например DEMO0000',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 14),
                FilledButton(
                  onPressed: _busy ? null : _lookup,
                  child: Text(_busy ? 'Проверяем…' : 'Войти'),
                ),
              ] else ...[
                Text('${_restaurant!.name} · выберите себя',
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                Expanded(
                  child: ListView.separated(
                    itemCount: _employees.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      final e = _employees[i];
                      return Card(
                        child: ListTile(
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(18)),
                          title: Text(e.display,
                              style:
                                  const TextStyle(fontWeight: FontWeight.w700)),
                          subtitle: e.position.isEmpty ? null : Text(e.position),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: _busy ? null : () => _pick(e),
                        ),
                      );
                    },
                  ),
                ),
                TextButton(
                  onPressed: () => setState(() => _restaurant = null),
                  child: const Text('Другой код'),
                ),
              ],
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(_error!,
                      style: const TextStyle(color: Colors.red)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
