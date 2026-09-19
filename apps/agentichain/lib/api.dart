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

  Uri _uri(String path, [Map<String, String>? query]) => Uri.parse('$baseUrl/api$path').replace(queryParameters: query);

  Future<Map<String, dynamic>> _decode(http.Response response) async {
    final body = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400 || body['success'] == false) {
      throw ApiException('${body['error'] ?? 'Request failed'} (${response.statusCode})');
    }
    return body;
  }

  Future<bool> health() async {
    try {
      final response = await http.get(_uri('/health')).timeout(const Duration(seconds: 4));
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      return body['ok'] == true;
    } catch (_) {
      return false;
    }
  }

  Future<List<ProjectDetail>> listProjects() async {
    final body = await _decode(await http.get(_uri('/projects')).timeout(const Duration(seconds: 12)));
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
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'prompt': prompt,
            'targetChain': targetChain,
            'contractName': contractName,
            'projectId': projectId ?? 'proj-${DateTime.now().millisecondsSinceEpoch}',
          }),
        )
        .timeout(const Duration(seconds: 20)));
    return ProjectDetail.fromJson(Map<String, dynamic>.from(body['project'] as Map));
  }

  Future<Map<String, dynamic>> audit({
    required String code,
    required String filePath,
    bool autoPatch = false,
  }) async {
    return _decode(await http
        .post(
          _uri('/audit'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'code': code, 'filePath': filePath, 'autoPatch': autoPatch}),
        )
        .timeout(const Duration(seconds: 12)));
  }

  Future<SimulationResult> simulate({
    required String contractName,
    required String networkFork,
    required String projectId,
  }) async {
    final body = await _decode(await http
        .post(
          _uri('/simulate'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'contractName': contractName, 'networkFork': networkFork, 'projectId': projectId}),
        )
        .timeout(const Duration(seconds: 12)));
    return SimulationResult.fromJson(Map<String, dynamic>.from(body['simulation'] as Map));
  }

  Future<DeploymentRecord> deploy({
    required String projectId,
    required String contractName,
    required String network,
    String? code,
  }) async {
    final body = await _decode(await http
        .post(
          _uri('/deploy'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'projectId': projectId,
            'contractName': contractName,
            'network': network,
            'code': code,
            'constructorArgs': {},
          }),
        )
        .timeout(const Duration(seconds: 12)));
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
          headers: {'Content-Type': 'application/json'},
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
}
