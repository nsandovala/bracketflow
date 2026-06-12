"""Recalculo idempotente de team_results tras el fix de scoring WSOW (BF-003).

Recorre TODOS los team_results de la BD, recalcula kill_points / placement_points
/ total_points con las funciones reales de app.crud (unica fuente de verdad, sin
duplicar formulas) y, con --apply, persiste los cambios. Sin flag es dry-run.

Uso:
    python -m scripts.recalc_points            # dry-run
    python -m scripts.recalc_points --apply    # escribe los cambios
"""

import argparse
import sys
from pathlib import Path

# Permite ejecutar el script directamente (python scripts/recalc_points.py)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import models  # noqa: E402
from app.crud import calculate_points  # noqa: E402
from app.database import SessionLocal  # noqa: E402


def recalc(apply: bool) -> int:
    db = SessionLocal()
    try:
        rows = (
            db.query(
                models.TeamResult,
                models.Team.name,
                models.Tournament.format,
            )
            .join(models.Team, models.Team.id == models.TeamResult.team_id)
            .join(
                models.Tournament,
                models.Tournament.id == models.TeamResult.tournament_id,
            )
            .order_by(
                models.TeamResult.tournament_id.asc(),
                models.TeamResult.placement.asc(),
            )
            .all()
        )

        header = (
            f"{'tourn':>5} {'team':<18} {'kills':>5} {'place':>5} "
            f"{'old_total':>10} -> {'new_total':>9}  {'change':>6}"
        )
        print(header)
        print("-" * len(header))

        changed = 0
        for result, team_name, fmt in rows:
            kill_points, placement_points, total_points = calculate_points(
                fmt, result.kills, result.placement
            )
            old_total = result.total_points
            is_change = (
                kill_points != result.kill_points
                or placement_points != result.placement_points
                or total_points != old_total
            )
            if is_change:
                changed += 1

            flag = "*" if is_change else ""
            print(
                f"{result.tournament_id:>5} {team_name[:18]:<18} "
                f"{result.kills:>5} {result.placement:>5} "
                f"{old_total:>10.1f} -> {total_points:>9.1f}  {flag:>6}"
            )

            if apply and is_change:
                result.kill_points = kill_points
                result.placement_points = placement_points
                result.total_points = total_points

        print("-" * len(header))
        print(f"Filas totales: {len(rows)} | Filas con cambios: {changed}")

        if apply:
            db.commit()
            print(f"APLICADO: {changed} fila(s) actualizada(s).")
        else:
            print("DRY-RUN: sin escribir. Usa --apply para persistir.")

        return changed
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Recalcula team_results (scoring WSOW).")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persiste los cambios. Sin este flag corre en dry-run.",
    )
    args = parser.parse_args()
    recalc(apply=args.apply)


if __name__ == "__main__":
    main()
