import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';

class ApiException implements Exception {
  ApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

class AgentiApi {
  AgentiApi({String? baseUrl}) : baseUrl = baseUrl ?? const String.fromEnvironment('API_BASE', defaultValue: 'http://127.0.0.1:8000');

  final String baseUrl;
  String? token;

  Uri _uri(String path, [Map<String, String>? query]) => Uri.parse('$baseUrl/api$path').replace(queryParameters: query);

  Map<String, String> _headers({bool json = true}) => {
        if (json) 'Content-Type': 'application/json',
        if (token != null && token!.isNotEmpty) 'Authorization': 'Bearer $token',
      };

  Future<Map<String, dynamic>> _decode(http.Response response) async {
    final body = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400 || body['success'] == false) {
      throw ApiException('${body['error'] ?? 'Request failed'} (${response.statusCode})');
    }
    return body;
  }

  Future<bool> health() async {
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        final response = await http.get(_uri('/health')).timeout(const Duration(seconds: 15));
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        if (body['ok'] == true) return true;
      } catch (_) {}
      await Future<void>.delayed(const Duration(milliseconds: 400));
    }
    return false;
  }

  Future<List<ProjectDetail>> listProjects() async {
    final body = await _decode(await http.get(_uri('/projects'), headers: _headers(json: false)).timeout(const Duration(seconds: 12)));
    return (body['projects'] as List<dynamic>? ?? []).map((item) => ProjectDetail.fromJson(Map<String, dynamic>.from(item as Map))).toList();
  }

  Future<ProjectDetail> runPipeline({
    required String prompt,
    required String targetChain,
    String? contractName,
    String? projectId,
  }) async {
    final body = await _decode(await http
        .post(
          _uri('/agent-pipeline'),
          headers: _headers(),
          body: jsonEncode({
            'prompt': prompt,
            'targetChain': targetChain,
            'contractName': contractName,
            'projectId': projectId ?? 'proj-${DateTime.now().millisecondsSinceEpoch}',
          }),
        )
        .timeout(const Duration(seconds: 180)));
    return ProjectDetail.fromJson(Map<String, dynamic>.from(body['project'] as Map));
  }

  Future<Map<String, dynamic>> audit({
    required String code,
    required String filePath,
    bool autoPatch = false,
    String? projectId,
  }) async {
    return _decode(await http
        .post(
          _uri('/audit'),
          headers: _headers(),
          body: jsonEncode({
            'code': code,
            'filePath': filePath,
            'autoPatch': autoPatch,
            'projectId': projectId,
          }),
        )
        .timeout(const Duration(seconds: 180)));
  }

  Future<SimulationResult> simulate({
    required String contractName,
    required String networkFork,
    required String projectId,
  }) async {
    final body = await _decode(await http
        .post(
          _uri('/simulate'),
          headers: _headers(),
          body: jsonEncode({'contractName': contractName, 'networkFork': networkFork, 'projectId': projectId}),
        )
        .timeout(const Duration(seconds: 180)));
    return SimulationResult.fromJson(Map<String, dynamic>.from(body['simulation'] as Map));
  }

  Future<DeploymentRecord> deploy({
    required String projectId,
    required String contractName,
    required String network,
    String? code,
    bool broadcastPublic = false,
  }) async {
    final body = await _decode(await http
        .post(
          _uri('/deploy'),
          headers: _headers(),
          body: jsonEncode({
            'projectId': projectId,
            'contractName': contractName,
            'network': network,
            'code': code,
            'constructorArgs': {},
            'broadcastPublic': broadcastPublic,
          }),
        )
        .timeout(const Duration(seconds: 360)));
    return DeploymentRecord.fromJson(Map<String, dynamic>.from(body['deployment'] as Map));
  }

  Future<Map<String, dynamic>> integrations() async {
    return _decode(await http.get(_uri('/integrations'), headers: _headers(json: false)).timeout(const Duration(seconds: 8)));
  }

  Future<DeploymentRecord> verify({required String projectId, String? contractName}) async {
    final body = await _decode(await http
        .post(
          _uri('/verify'),
          headers: _headers(),
          body: jsonEncode({
            'projectId': projectId,
            'contractName': contractName,
          }),
        )
        .timeout(const Duration(seconds: 300)));
    return DeploymentRecord.fromJson(Map<String, dynamic>.from(body['deployment'] as Map));
  }

  Future<MonitoringBotRecord> createBot({
    required String projectId,
    required String contractAddress,
    required String network,
    required String botType,
    required String name,
    String? deploymentId,
  }) async {
    final body = await _decode(await http
        .post(
          _uri('/bots'),
          headers: _headers(),
          body: jsonEncode({
            'projectId': projectId,
            'deploymentId': deploymentId ?? 'dep-01',
            'contractAddress': contractAddress,
            'network': network,
            'botType': botType,
            'name': name,
          }),
        )
        .timeout(const Duration(seconds: 12)));
    return MonitoringBotRecord.fromJson(Map<String, dynamic>.from(body['bot'] as Map));
  }

  Future<List<MonitoringBotRecord>> listBots({String? projectId}) async {
    final body = await _decode(await http.get(_uri('/bots', projectId == null ? null : {'projectId': projectId}), headers: _headers(json: false)).timeout(const Duration(seconds: 12)));
    return (body['bots'] as List<dynamic>? ?? []).map((item) => MonitoringBotRecord.fromJson(Map<String, dynamic>.from(item as Map))).toList();
  }

  Future<List<MonitoringBotRecord>> probeBots({required String projectId}) async {
    final body = await _decode(await http
        .post(
          _uri('/bots/probe'),
          headers: _headers(),
          body: jsonEncode({'projectId': projectId}),
        )
        .timeout(const Duration(seconds: 30)));
    return (body['bots'] as List<dynamic>? ?? []).map((item) => MonitoringBotRecord.fromJson(Map<String, dynamic>.from(item as Map))).toList();
  }

  Future<Map<String, dynamic>> walletChallenge({required String address, required int chainId}) async {
    return _decode(await http
        .post(
          _uri('/auth/challenge'),
          headers: _headers(),
          body: jsonEncode({'address': address, 'chainId': chainId, 'browser': true}),
        )
        .timeout(const Duration(seconds: 20)));
  }

  Future<WalletSession> walletVerify({
    required String address,
    required String nonce,
    required String signature,
  }) async {
    final body = await _decode(await http
        .post(
          _uri('/auth/verify'),
          headers: _headers(),
          body: jsonEncode({'address': address, 'nonce': nonce, 'signature': signature}),
        )
        .timeout(const Duration(seconds: 20)));
    final session = WalletSession.fromJson(Map<String, dynamic>.from(body['session'] as Map));
    token = session.token;
    return session;
  }

  Future<WalletSession> signInAnvil() async {
    final body = await _decode(await http.post(_uri('/auth/anvil'), headers: _headers()).timeout(const Duration(seconds: 30)));
    final session = WalletSession.fromJson(Map<String, dynamic>.from(body['session'] as Map));
    token = session.token;
    return session;
  }

  Future<void> logout() async {
    try {
      await _decode(await http.post(_uri('/auth/logout'), headers: _headers()).timeout(const Duration(seconds: 8)));
    } catch (_) {}
    token = null;
  }

  Future<TelemetrySnapshot> telemetry() async {
    final body = await _decode(await http.get(_uri('/telemetry'), headers: _headers(json: false)).timeout(const Duration(seconds: 12)));
    return TelemetrySnapshot.fromJson(body);
  }
}
