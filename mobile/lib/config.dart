/// App configuration. Override the API base at build time:
///   flutter run --dart-define=API_BASE=https://api.hookahcrm.ru
class Config {
  static const apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'http://localhost:8080',
  );

  /// Active-calls poll interval (push covers background; polling keeps the open
  /// list fresh and is the fallback if a push is missed).
  static const pollInterval = Duration(seconds: 8);
}
