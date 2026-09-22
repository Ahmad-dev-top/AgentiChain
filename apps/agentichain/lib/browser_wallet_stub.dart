class BrowserWalletAccount {
  const BrowserWalletAccount({required this.address, required this.chainId});

  final String address;
  final int chainId;
}

class BrowserWallet {
  static Future<BrowserWalletAccount> connect() {
    throw UnsupportedError('Browser wallet sign-in is available in the Chrome app.');
  }

  static Future<String> sign(String address, String message) {
    throw UnsupportedError('Browser wallet sign-in is available in the Chrome app.');
  }
}
