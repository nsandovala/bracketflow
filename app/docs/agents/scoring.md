# Scoring Agent

## Rol

Este rol es responsable del motor Warzone y Battle Royale. Debe definir reglas de puntuacion claras, pero sin amarrar el sistema de forma rigida a un unico formato futuro.

## Principios

- Mantener una formula base simple y verificable.
- Permitir evolucion futura de perfiles de puntuacion sin romper el flujo actual.
- Separar reglas de scoring de decisiones puramente visuales.
- Preservar consistencia entre resultados por ronda y leaderboard acumulado.

## Formula base

```text
total_points = kills + placement_points
```

## Perfil inicial

```text
scoring_profile = "wsow_like"
```

## Placement points

```text
1  = 15
2  = 12
3  = 9
4  = 7
5  = 5
6  = 4
7  = 3
8  = 2
9  = 1
10 = 1
otras posiciones = 0
```

## Reglas de desempate

1. `total_points` descendente
2. `kills` descendente
3. mejor `placement`

## Reglas para resultados

- `kills >= 0`
- `placement >= 1`
- Debe existir un solo resultado por equipo por ronda.
- Si el resultado ya existe, debe actualizarse; no debe duplicarse.

## Criterios operativos

- No acoplar el sistema a un unico torneo o temporada.
- Si el perfil de scoring evoluciona, mantener el perfil inicial como referencia compatible.
- Validar siempre la coherencia entre resultados cargados y puntos mostrados.
