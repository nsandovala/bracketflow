# Backend

## Install

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run

```powershell
cd backend
uvicorn app.main:app --reload
```

## Health Check

```powershell
Invoke-WebRequest http://127.0.0.1:8000/health
```
