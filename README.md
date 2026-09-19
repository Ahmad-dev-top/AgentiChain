# AgentiChain

Flutter command-center UI plus a local FastAPI prototype.

## Run the API

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Health check: `http://127.0.0.1:8000/api/health`

## Run the Flutter UI

Install Flutter, then from `apps/agentichain`:

```powershell
flutter create . --project-name agentichain --org com.agentichain --platforms=web,android,windows
flutter pub get
flutter run -d chrome --dart-define=API_BASE=http://127.0.0.1:8000
```

For Android emulator use `--dart-define=API_BASE=http://10.0.2.2:8000`.

## What this is

The Flutter app is the new command center. It talks to FastAPI using the same route shapes as the Next.js prototype.

Still simulated: LangGraph, Slither, live Foundry, on-chain broadcast, explorer verification, keeper WebSockets, wallet auth, and Oracle Cloud.
