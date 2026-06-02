# Backend Agent

## Rol

Este rol es responsable de FastAPI, SQLite, SQLAlchemy, Pydantic y los endpoints del sistema. Debe preservar compatibilidad con los endpoints existentes y evitar cambios destructivos que rompan el flujo real del torneo.

## Comandos de ejecucion

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

## Comandos de validacion

```powershell
cd backend
python -m compileall app
```

## Reglas generales

- Mantener FastAPI como entry point actual.
- Mantener SQLite como persistencia local actual.
- Mantener compatibilidad con endpoints y payloads existentes salvo requerimiento explicito.
- Preferir extensiones pequenas sobre refactors amplios.
- No introducir Alembic todavia.
- No hacer cambios destructivos silenciosos en modelos o tablas.

## Reglas para modelos

- Extender modelos existentes antes de crear entidades nuevas.
- Evitar renombrar campos existentes si eso rompe compatibilidad.
- Mantener relaciones consistentes con `Tournament`, `Team`, `Player`, `TeamMember`, `Match` y `TeamResult`.
- Si un cambio altera schema, documentar el impacto local en `backend/bracketflow.db`.
- Si no hay migraciones y el schema cambia, avisar explicitamente que puede requerirse detener backend y borrar la DB local para regenerarla.

## Reglas para schemas

- Mantener claridad entre entrada, salida y representacion interna.
- No romper payloads ya consumidos por frontend si no es estrictamente necesario.
- Validar restricciones de dominio en Pydantic cuando corresponda.
- Agregar campos nuevos de forma compatible siempre que sea posible.

## Reglas para `crud.py`

- Centralizar operaciones de lectura y escritura en la capa CRUD existente.
- Evitar duplicar logica de acceso a datos en endpoints.
- Preferir updates idempotentes cuando el flujo funcional lo requiera.
- Mantener el comportamiento actual salvo necesidad funcional concreta y documentada.

## Politica de errores HTTP

- Usar codigos HTTP coherentes con el tipo de error.
- Devolver mensajes claros y accionables.
- Reservar `500` para errores no controlados.
- Usar `404` cuando el recurso no exista.
- Usar `400` o `422` para entradas invalidas segun corresponda.
- No ocultar errores reales con respuestas ambiguas.

## Politica sobre migraciones

- No incorporar Alembic todavia.
- Si hay cambios de schema en desarrollo local, dejar nota explicita sobre regeneracion potencial de `backend/bracketflow.db`.
- Nunca asumir que la DB local sobrevivira a cambios estructurales sin ajuste manual.
- Si regenerar la base es necesario, avisarlo de forma visible en el cambio o la documentacion.
