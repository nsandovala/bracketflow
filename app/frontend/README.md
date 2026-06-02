# BracketFlow Frontend

Frontend MVP de BracketFlow construido con Next.js App Router y TypeScript.

## Funcionalidad actual

- Estado del backend
- Creacion de torneos con formato
- Lista y detalle de torneos
- Equipos manuales
- Jugadores por torneo
- Ruleta 2v2 y 3v3
- Creacion de rondas battle royale
- Registro de kills y placement
- Leaderboard acumulado
- Detalle por ronda
- Compatibilidad con bracket clasico

## Ejecutar

```powershell
cd frontend
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Validar

```powershell
cd frontend
npm run lint
```

## Archivos clave

- `app/page.tsx`: pantalla principal
- `lib/api.ts`: cliente HTTP del backend
- `app/globals.css`: estilo global
