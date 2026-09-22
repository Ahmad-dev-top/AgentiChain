import 'dart:js_interop';

class BrowserWalletAccount {
  const BrowserWalletAccount({required this.address, required this.chainId});

  final String address;
  final int chainId;
}

@JS('ethereum')
external JSAny? get _ethereum;

extension type _Provider(JSObject _) implements JSObject {
  external JSPromise<JSAny?> request(_Request args);
}

extension type _Request._(JSObject _) implements JSObject {
  external factory _Request({required String method, JSArray<JSAny?> params});
}

class BrowserWallet {
  static _Provider _provider() {
    final value = _ethereum;
    if (value == null || value.typeofEquals('undefined')) {
      throw StateError('No browser wallet extension was detected. Install one in Chrome, then reload this page.');
    }
    return _Provider(value as JSObject);
  }

  static Future<BrowserWalletAccount> connect() async {
    final provider = _provider();
    final accountsRaw = await provider.request(_Request(method: 'eth_requestAccounts', params: <JSAny?>[].toJS)).toDart;
    final accounts = (accountsRaw as JSArray<JSAny?>).toDart;
    if (accounts.isEmpty) {
      throw StateError('The browser wallet did not return an account.');
    }
    final address = (accounts.first as JSString).toDart;
    final chainRaw = await provider.request(_Request(method: 'eth_chainId', params: <JSAny?>[].toJS)).toDart;
    final chainHex = (chainRaw as JSString).toDart;
    return BrowserWalletAccount(address: address, chainId: int.parse(chainHex));
  }

  static Future<String> sign(String address, String message) async {
    final provider = _provider();
    final encoded = message.codeUnits.map((unit) => unit.toRadixString(16).padLeft(2, '0')).join();
    final signature = await provider
        .request(
          _Request(
            method: 'personal_sign',
            params: <JSAny?>['0x$encoded'.toJS, address.toJS].toJS,
          ),
        )
        .toDart;
    final value = (signature as JSString).toDart;
    if (!value.startsWith('0x')) {
      throw StateError('The browser wallet did not return a signature.');
    }
    return value;
  }
}
