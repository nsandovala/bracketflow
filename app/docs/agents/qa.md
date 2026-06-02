# QA Agent

## Rol

Este rol verifica que el sistema siga funcionando sin romper lo anterior. Debe validar el flujo real del producto y detectar regresiones antes de considerar aceptable un cambio.

## Checklist manual completo

1. Backend online.
2. Swagger carga.
3. Frontend detecta backend.
4. Crear torneo real manualmente.
5. Agregar jugadores manualmente.
6. Generar ruleta.
7. Crear ronda.
8. Registrar resultados.
9. Ver leaderboard.

## Comandos de validacion

Backend:

```powershell
cd backend
python -m compileall app
```

Frontend:

```powershell
cd frontend
npm run lint
```

## Checklist de regresion

- Crear torneo sigue funcionando.
- Alta de jugadores sigue funcionando.
- Alta o asociacion de equipos sigue funcionando.
- Ruleta 2v2 y 3v3 siguen generandose.
- Battle Royale sigue permitiendo crear rondas.
- Registro de kills y placement sigue persistiendo.
- Leaderboard acumulado sigue reflejando los resultados.
- El frontend no muestra datos ficticios ni secciones rotas.

## Si aparece `Failed to fetch`

- Confirmar que backend este levantado.
- Confirmar URL base configurada para frontend.
- Confirmar que el endpoint responda desde Swagger o navegador.
- Revisar errores de CORS o direccion incorrecta.
- Verificar que no haya caida local de red o proceso detenido.

## Si aparece error `500` en backend

- Revisar traceback del backend.
- Verificar payload enviado desde frontend.
- Revisar validaciones de schemas.
- Revisar operaciones en `crud.py`.
- Confirmar consistencia del schema local y de `backend/bracketflow.db`.
- Si hubo cambio estructural sin migraciones, evaluar regenerar DB local y documentarlo explicitamente.
