import json
import os
import sqlite3
import sys

import requests

BASE = "http://localhost:8000"

def api(method, path, **kwargs):
    url = f"{BASE}{path}"
    r = getattr(requests, method)(url, **kwargs)
    print(f"{method.upper()} {path} -> {r.status_code}")
    if r.status_code >= 400:
        print("  error:", r.text[:300])
    return r

def main():
    # 1. Health check
    r = api("get", "/health")
    if r.status_code != 200:
        print("Backend no responde. Abortando.")
        sys.exit(1)

    # 2. Crear torneo Kill Race 2v2
    r = api("post", "/tournaments", json={
        "name": "QA Kill Race 2v2",
        "game": "Warzone",
        "format": "roulette_2v2",
        "team_size": 2,
        "scoring_profile": "kill_race",
        "config": {
            "engine_key": "kill_race_bracket",
            "game_mode": "kill_race",
            "roster_policy": "roulette",
            "tournament_structure": "single_elim",
            "teamSize": 2,
            "bestOf": 3
        }
    })
    if r.status_code not in (200, 201):
        print("No se pudo crear torneo")
        sys.exit(1)
    tournament = r.json()
    tid = tournament["id"]
    print(f"  Torneo creado: id={tid}")

    # 3. Importar participantes (incluyendo uno con comas para validar rechazo)
    r = api("post", f"/tournaments/{tid}/players/bulk", json={
        "nicknames": [
            "ShadowNox",
            "Valkyro",
            "HexDrift",
            "LoboPrime",
            "manteca, demain, carlos, lalo, clara"  # debe ser rechazado
        ]
    })
    print(f"  Respuesta import: {r.status_code}")
    if r.status_code in (422, 400):
        print("  OK: Backend rechazó nickname con comas internas.")
        # Reintentar sin el nombre inválido
        r = api("post", f"/tournaments/{tid}/players/bulk", json={
            "nicknames": ["ShadowNox", "Valkyro", "HexDrift", "LoboPrime"]
        })
        if r.status_code not in (200, 201):
            print("  ERROR: No se pudieron cargar participantes válidos")
            sys.exit(1)
        players = r.json()
        print(f"  OK: {len(players)} participantes cargados.")
    elif r.status_code in (200, 201):
        players = r.json()
        print(f"  Advertencia: backend aceptó nickname con comas. Revisar validación. {len(players)} cargados.")
        # Limpiar y recargar solo los válidos
        api("delete", f"/tournaments/{tid}/players")
        r = api("post", f"/tournaments/{tid}/players/bulk", json={
            "nicknames": ["ShadowNox", "Valkyro", "HexDrift", "LoboPrime"]
        })
        players = r.json()
    else:
        print(f"  ERROR inesperado: {r.status_code}")
        sys.exit(1)

    # 4. Abrir respin de roster y generar ruleta
    r = api("post", f"/tournaments/{tid}/roster-respin/open", json={"duration_minutes": 3})
    if r.status_code != 200:
        print("  ERROR: No se pudo abrir respin de roster")
        sys.exit(1)

    r = api("post", f"/tournaments/{tid}/generate-roulette-teams", json={
        "shuffle_seed": "qa-seed-01",
        "reset": True,
        "confirm": True
    })
    if r.status_code != 200:
        print("  ERROR: No se pudo generar ruleta")
        sys.exit(1)
    result = r.json()
    teams_created = result.get("teams_created", [])
    bench = result.get("bench", [])
    print(f"  Ruleta generada: {len(teams_created)} equipos, {len(bench)} banca.")

    r = api("post", f"/tournaments/{tid}/roster-respin/lock")
    if r.status_code != 200:
        print("  ERROR: No se pudo lockear roster")
        sys.exit(1)

    # Verificar que equipos tienen exactamente 2 jugadores
    for team in teams_created:
        members = team.get("members", [])
        if len(members) != 2:
            print(f"  ERROR: Equipo {team['name']} tiene {len(members)} jugadores, esperado 2")
            sys.exit(1)
    print("  OK: Todos los equipos tienen exactamente 2 jugadores.")

    # 5. Verificar equipos confirmados
    r = api("get", f"/tournaments/{tid}/teams")
    teams = r.json()
    print(f"  Teams confirmados: {len(teams)}")

    # 6. Verificar config de bracket
    config = result.get("config", {})
    roulette_bench = config.get("rouletteBench", [])
    print(f"  Bench en config: {roulette_bench}")

    # 7. Con roster locked, la regeneracion debe ser rechazada
    r = api("post", f"/tournaments/{tid}/generate-roulette-teams", json={
        "shuffle_seed": "qa-seed-02",
        "reset": True,
        "confirm": True
    })
    if r.status_code not in (400, 409, 422):
        print("  ERROR: La regeneracion debio ser rechazada despues de locked.")
        sys.exit(1)
    print("  OK: Backend rechaza regenerar roster despues de locked.")

    # 8. Abrir respin de bracket, generar llave y lockear running
    r = api("post", f"/tournaments/{tid}/bracket-respin/open", json={"duration_minutes": 3})
    if r.status_code != 200:
        print("  ERROR: No se pudo abrir respin de bracket")
        sys.exit(1)

    r = api("post", f"/tournaments/{tid}/generate-bracket")
    if r.status_code != 200:
        print("  ERROR: No se pudo generar bracket")
        sys.exit(1)
    bracket = r.json()
    matches_created = bracket.get("matches_created", 0)
    print(f"  Bracket generado: {matches_created} matches.")

    r = api("post", f"/tournaments/{tid}/bracket-respin/lock")
    if r.status_code != 200:
        print("  ERROR: No se pudo lockear bracket")
        sys.exit(1)

    r = api("post", f"/tournaments/{tid}/generate-bracket")
    if r.status_code not in (400, 409, 422):
        print("  ERROR: El bracket locked debio rechazar regeneracion.")
        sys.exit(1)
    print("  OK: Backend rechaza regenerar bracket despues de locked/running.")

    db_path = os.path.join(os.path.dirname(__file__), "bracketflow.db")
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT roster_status, roster_respin_deadline_at, roster_locked_at,
                       bracket_status, bracket_respin_deadline_at, bracket_locked_at
                FROM tournaments
                WHERE id = ?
                """,
                (tid,),
            )
            row = cursor.fetchone()
            print(f"  DB torneo: {row}")
        finally:
            conn.close()

    print("\n[OK] QA manual backend: PASO")
    print(f"   Torneo id={tid}")
    print(f"   Participantes: 4")
    print(f"   Equipos: {len(teams_created)}")
    print(f"   Bench: {len(bench)}")

if __name__ == "__main__":
    main()
