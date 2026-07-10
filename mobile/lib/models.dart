/// Domain models mirroring the Go API (camelCase JSON inside the `{data}` envelope).

class Restaurant {
  final String id;
  final String name;
  const Restaurant(this.id, this.name);
  factory Restaurant.fromJson(Map<String, dynamic> j) =>
      Restaurant(j['id'] as String, (j['name'] ?? '') as String);
}

class Employee {
  final String id;
  final String firstName;
  final String shortName;
  final String position;
  const Employee({
    required this.id,
    required this.firstName,
    required this.shortName,
    required this.position,
  });

  String get display => shortName.isNotEmpty ? shortName : firstName;

  factory Employee.fromJson(Map<String, dynamic> j) => Employee(
        id: j['id'] as String,
        firstName: (j['firstName'] ?? '') as String,
        shortName: (j['shortName'] ?? '') as String,
        position: (j['position'] ?? '') as String,
      );
}

/// A guest call ("Обращение"): master | coals | waiter | bill.
class Call {
  final String id;
  final String tableId;
  final String type;
  final String status; // new | ack | done
  final DateTime createdAt;

  const Call({
    required this.id,
    required this.tableId,
    required this.type,
    required this.status,
    required this.createdAt,
  });

  factory Call.fromJson(Map<String, dynamic> j) => Call(
        id: j['id'] as String,
        tableId: (j['tableId'] ?? '') as String,
        type: (j['type'] ?? '') as String,
        status: (j['status'] ?? '') as String,
        createdAt:
            DateTime.tryParse((j['createdAt'] ?? '') as String)?.toLocal() ??
                DateTime.now(),
      );

  static const _labels = {
    'master': 'Позвать мастера',
    'coals': 'Сменить угли',
    'waiter': 'Позвать официанта',
    'bill': 'Попросить счёт',
  };

  static const _icons = {
    'master': '👤',
    'coals': '🔥',
    'waiter': '🍽',
    'bill': '🧾',
  };

  String get label => _labels[type] ?? 'Вызов от гостя';
  String get icon => _icons[type] ?? '🔔';
  bool get isNew => status == 'new';
}
