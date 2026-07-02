[PENDIENTE VERIFICAR] E4.b `frontend/app/components/WorldSeriesOperator.tsx:927`

Import TXT/CSV en Operator sigue tokenizando por linea y luego por coma en `line.split(/,\s*|,/)`. Queda fuera de scope de E4 por directiva del sprint.

[PENDIENTE VERIFICAR] E4.b `frontend/app/lib/useWorldSeriesPractice.ts:117`

`parseRosterAliases()` usa `.split(/,|\n/)` para roster manual. Si entra una coma interna, puede fragmentar aliases. Queda fuera de scope de E4 por directiva del sprint.

[PENDIENTE VERIFICAR] E2.b-front `frontend/app/lib/useWorldSeriesPractice.ts:926`

Kill Race corta la cadena equipos -> bracket en frontend: `generateBracketForSelected()` llama `POST /tournaments/{id}/generate-bracket` y luego `POST /tournaments/{id}/bracket-respin/lock`, pero nunca abre antes `POST /tournaments/{id}/bracket-respin/open`. El contrato backend esperado es: abrir roster respin -> generar ruleta -> lock roster -> abrir bracket respin -> generar bracket -> lock bracket.
