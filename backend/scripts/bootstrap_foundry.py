from app.services.toolchain import ensure_foundry_binaries, ensure_solidity_libs, forge_version

if __name__ == "__main__":
    forge = ensure_foundry_binaries()
    libs = ensure_solidity_libs()
    print("forge", forge)
    print("version", forge_version())
    print("libs", libs)
