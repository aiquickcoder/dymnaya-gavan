import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api.dart';
import '../config.dart';
import '../fcm.dart';
import '../models.dart';
import '../session.dart';
import '../theme.dart';
import 'login_screen.dart';

class CallsScreen extends StatefulWidget {
  final ApiClient api;
  final Session session;
  const CallsScreen({super.key, required this.api, required this.session});

  @override
  State<CallsScreen> createState() => _CallsScreenState();
}

class _CallsScreenState extends State<CallsScreen> with WidgetsBindingObserver {
  Timer? _timer;
  List<Call> _calls = const [];
  bool _onShift = false;
  bool _loading = true;
  String? _error;

  String get _rid => widget.session.restaurantId!;
  String get _eid => widget.session.employeeId!;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    callsBump.addListener(_onBump);
    // Refresh the push token against the current employee on every app open.
    unawaited(Fcm.register(widget.api, employeeId: _eid, restaurantId: _rid)
        .catchError((_) {}));
    _refreshShift();
    _load();
    _timer = Timer.periodic(Config.pollInterval, (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    callsBump.removeListener(_onBump);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _onBump() => _load();

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _load();
  }

  Future<void> _load() async {
    try {
      final calls = await widget.api.activeCalls(_rid);
      if (!mounted) return;
      setState(() {
        _calls = calls;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _refreshShift() async {
    try {
      final ids = await widget.api.onShiftIds(_rid);
      if (mounted) setState(() => _onShift = ids.contains(_eid));
    } catch (_) {}
  }

  Future<void> _toggleShift(bool on) async {
    setState(() => _onShift = on); // optimistic
    try {
      final ids = (await widget.api.onShiftIds(_rid)).toSet();
      if (on) {
        ids.add(_eid);
      } else {
        ids.remove(_eid);
      }
      await widget.api.setShift(_rid, ids.toList());
    } catch (e) {
      if (mounted) {
        setState(() => _onShift = !on);
        _snack('Не удалось изменить смену: $e');
      }
    }
  }

  Future<void> _ack(Call c) async {
    try {
      await widget.api.ackCall(c.id);
      _snack('Принято — стол ${c.tableId}');
      await _load();
    } catch (e) {
      _snack('Ошибка: $e');
    }
  }

  Future<void> _done(Call c) async {
    try {
      await widget.api.doneCall(c.id);
      await _load();
    } catch (e) {
      _snack('Ошибка: $e');
    }
  }

  Future<void> _logout() async {
    try {
      await Fcm.unregister(widget.api);
    } catch (_) {}
    await widget.session.clear();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(MaterialPageRoute(
      builder: (_) =>
          LoginScreen(api: widget.api, session: widget.session),
    ));
  }

  void _snack(String m) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(m)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.session.restaurantName ?? 'HookahCRM',
                style: const TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w800)),
            Text(widget.session.employeeName ?? '',
                style: const TextStyle(fontSize: 12, color: Brand.muted)),
          ],
        ),
        actions: [
          IconButton(
              onPressed: _logout,
              icon: const Icon(Icons.logout),
              tooltip: 'Выйти'),
        ],
      ),
      body: Column(
        children: [
          _shiftBar(),
          Expanded(child: _body()),
        ],
      ),
    );
  }

  Widget _shiftBar() {
    return Container(
      color: Brand.surface,
      padding: const EdgeInsets.fromLTRB(16, 4, 8, 8),
      child: Row(
        children: [
          Icon(_onShift ? Icons.notifications_active : Icons.notifications_off,
              color: _onShift ? Brand.success : Brand.muted),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              _onShift
                  ? 'Вы на смене — получаете вызовы'
                  : 'Вы не на смене — вызовы не приходят',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Switch(value: _onShift, onChanged: _toggleShift),
        ],
      ),
    );
  }

  Widget _body() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: _load,
      child: _calls.isEmpty
          ? ListView(
              children: [
                const SizedBox(height: 120),
                Center(
                  child: Column(
                    children: [
                      const Text('🎉', style: TextStyle(fontSize: 40)),
                      const SizedBox(height: 8),
                      Text(_error ?? 'Активных вызовов нет',
                          style: const TextStyle(color: Brand.muted)),
                    ],
                  ),
                ),
              ],
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: _calls.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (_, i) => _callCard(_calls[i]),
            ),
    );
  }

  Widget _callCard(Call c) {
    final time = DateFormat('HH:mm').format(c.createdAt);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(c.icon, style: const TextStyle(fontSize: 22)),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Стол ${c.tableId}',
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.w800)),
                      Text(c.label, style: const TextStyle(color: Brand.muted)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(time, style: const TextStyle(color: Brand.muted)),
                    if (!c.isNew)
                      const Text('принят',
                          style: TextStyle(
                              color: Brand.success,
                              fontWeight: FontWeight.w700,
                              fontSize: 12)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                if (c.isNew)
                  Expanded(
                    child: FilledButton(
                      onPressed: () => _ack(c),
                      child: const Text('Принял'),
                    ),
                  )
                else
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _done(c),
                      style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(52)),
                      child: const Text('Выполнено'),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
