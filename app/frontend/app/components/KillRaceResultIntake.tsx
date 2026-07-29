"use client";

import { ChangeEvent, useMemo, useState } from "react";

import {
  KillRaceImportPreview,
  Match,
  Team,
  confirmKillRaceResult,
  previewKillRaceImport,
  saveKillRaceProvisional,
} from "../../lib/api";
import {
  buildManualKillRacePreview,
  getProjectedSeriesScore,
} from "../../lib/killRaceIntake.mjs";
import {
  clearKillRaceDraft,
  getManualKillsFromMap,
} from "../../lib/killRaceDraftState.mjs";

type Source = "txt" | "csv" | "manual";
type Props = { match: Match; leftTeam: Team; rightTeam: Team; onChanged: () => Promise<unknown> };

export function calculatedSideTotal(side: KillRaceImportPreview["left"]) {
  return side?.players.reduce((total, player) => total + player.kills, 0) ?? 0;
}

export default function KillRaceResultIntake({ match, leftTeam, rightTeam, onChanged }: Props) {
  const nextMap = Math.min(
    match.maps.find((item) => item.result_status !== "confirmed")?.map_number ??
      match.maps.filter((item) => item.result_status === "confirmed").length + 1,
    match.best_of
  );
  const mapNumber = nextMap;
  const [content, setContent] = useState("");
  const [source, setSource] = useState<Source>("manual");
  const [manualKills, setManualKills] = useState<Record<number, string>>(() =>
    getManualKillsFromMap(match.maps.find((item) => item.map_number === nextMap))
  );
  const [preview, setPreview] = useState<KillRaceImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const currentMap = match.maps.find((item) => item.map_number === mapNumber);
  const issues = useMemo(() => [...(preview?.errors ?? []), ...(preview?.conflicts ?? [])], [preview]);
  const projected = getProjectedSeriesScore(match, preview);
  const hasTie =
    preview?.valid && preview.left && preview.right
      ? preview.left.total_kills === preview.right.total_kills
      : false;

  function selectSource(next: Source) {
    setSource(next);
    setPreview(null);
    setMessage(null);
  }

  async function runPreview(nextContent = content, nextSource = source) {
    setMessage(null);
    if (nextSource === "manual") {
      setPreview(buildManualKillRacePreview({ match, leftTeam, rightTeam, values: manualKills, mapNumber }));
      return;
    }
    if (!nextContent.trim()) {
      setMessage(nextSource === "csv" ? "Selecciona un CSV antes de previsualizar." : "Pega el TXT antes de previsualizar.");
      return;
    }
    setBusy(true);
    try {
      setPreview(await previewKillRaceImport(match.id, {
        format: nextSource,
        content: nextContent,
        map_number: mapNumber,
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo generar el preview.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const nextContent = await file.text();
    setContent(nextContent);
    await runPreview(nextContent, "csv");
    event.target.value = "";
  }

  async function saveProvisional() {
    if (!preview?.valid || !preview.left || !preview.right || preview.map_number !== mapNumber || hasTie) return;
    setBusy(true);
    try {
      await saveKillRaceProvisional(match.id, {
        map_number: mapNumber,
        status: "provisional",
        left: preview.left,
        right: preview.right,
      });
      setMessage(currentMap?.result_status === "provisional" ? "Resultado provisional actualizado." : "Resultado provisional creado.");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      await confirmKillRaceResult(match.id, mapNumber);
      const emptyDraft = clearKillRaceDraft();
      setMessage("Resultado confirmado. El mapa quedó cerrado y la serie fue actualizada.");
      setManualKills(emptyDraft.manualKills);
      setContent(emptyDraft.content);
      setPreview(emptyDraft.preview);
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo confirmar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kr-intake">
      <section className="kr-intake-section">
        <div className="kr-intake-section-head"><span>1</span><div><strong>Fuente de entrada</strong><small>Elige un único origen para esta partida.</small></div></div>
        <div className="kr-source-tabs" role="tablist" aria-label="Fuente del resultado">
          {(["txt", "csv", "manual"] as Source[]).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={source === item}
              className={source === item ? "is-active" : ""} onClick={() => selectSource(item)}>
              {item.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      <section className="kr-intake-section">
        <div className="kr-intake-section-head"><span>2</span><div><strong>Partida {mapNumber}</strong><small>BO{match.best_of} · Serie {match.maps_won_a}–{match.maps_won_b}</small></div></div>
        {source === "txt" ? (
          <label className="opr-field kr-intake-text">
            <span>Contenido TXT</span>
            <textarea value={content} onChange={(event) => { setContent(event.target.value); setPreview(null); }}
              placeholder={`MATCH: ${mapNumber}\nLEFT: ${leftTeam.name}\n${leftTeam.members[0]?.player.nickname ?? "Jugador 1"}: 0\n${leftTeam.members[1]?.player.nickname ?? "Jugador 2"}: 0\n\nRIGHT: ${rightTeam.name}\n${rightTeam.members[0]?.player.nickname ?? "Jugador 3"}: 0\n${rightTeam.members[1]?.player.nickname ?? "Jugador 4"}: 0`} />
          </label>
        ) : source === "csv" ? (
          <label className="opr-field kr-file-field">
            <span>Archivo CSV</span>
            <input type="file" accept=".csv,text/csv" onChange={handleCsv} />
            <small>Columnas: match,side,team,player,kills</small>
          </label>
        ) : (
          <div className="kr-manual-grid">
            {[{ side: "LEFT", team: leftTeam }, { side: "RIGHT", team: rightTeam }].map(({ side, team }) => (
              <fieldset key={side} disabled={team.members.length !== 2}>
                <legend><span>{side}</span><strong>{team.name}</strong></legend>
                {team.members.length !== 2 ? <p className="kr-field-error">El roster oficial debe contener exactamente dos jugadores.</p> : null}
                {team.members.map((member) => (
                  <label className="kr-player-input" key={member.player.id}>
                    <span>{member.player.nickname}</span>
                    <input type="number" inputMode="numeric" min="0" step="1"
                      value={manualKills[member.player.id] ?? ""}
                      onChange={(event) => {
                        setManualKills((current) => ({ ...current, [member.player.id]: event.target.value }));
                        setPreview(null);
                      }} />
                    <small>K</small>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        )}
        <button type="button" className="bf-button bf-button-ghost kr-preview-action" disabled={busy}
          onClick={() => void runPreview()}>Previsualizar</button>
      </section>

      <section className="kr-intake-section">
        <div className="kr-intake-section-head"><span>3</span><div><strong>Preview oficial</strong><small>Fuente: {source.toUpperCase()} · aún no persiste datos.</small></div></div>
        {preview?.left && preview.right ? (
          <div className="kr-preview">
            {[preview.left, preview.right].map((side) => (
              <div className={`kr-preview-side is-${side.side}`} key={side.side}>
                <span>{side.side.toUpperCase()}</span><strong>{side.team_name}</strong>
                {side.players.map((player) => <p key={player.player_id}>{player.player_name}<b>{player.kills} K</b></p>)}
                <footer>TOTAL <b>{calculatedSideTotal(side)} K</b></footer>
              </div>
            ))}
            <div className="kr-preview-meta">
              <span>Partida {preview.map_number}</span>
              <strong>{hasTie ? "EMPATE · REQUIERE DESEMPATE" : projected.leader === "left" ? `Lidera ${preview.left.team_name}` : `Lidera ${preview.right.team_name}`}</strong>
              <small>Serie actual {match.maps_won_a}–{match.maps_won_b}</small>
              <small>Al confirmar {projected.left}–{projected.right}</small>
            </div>
          </div>
        ) : <p className="kr-preview-empty">Completa la fuente y previsualiza para revisar el resultado.</p>}
        {issues.length ? <ul className="kr-errors">{issues.map((issue, index) =>
          <li key={`${issue.code}-${index}`}>{issue.row ? `Fila ${issue.row}: ` : ""}{issue.message}</li>)}</ul> : null}
      </section>

      <section className="kr-intake-section kr-official-actions">
        <div className="kr-intake-section-head"><span>4</span><div><strong>Acciones oficiales</strong><small>Confirmar cierra el mapa y puede avanzar la serie.</small></div></div>
        {message ? <p className="kr-intake-message" role="status">{message}</p> : null}
        <div className="bf-hub-form-actions">
          <button type="button" className="opr-save" disabled={busy || !preview?.valid || hasTie}
            onClick={() => void saveProvisional()}>
            {currentMap?.result_status === "provisional" ? "Actualizar provisional" : "Crear provisional"}
          </button>
          <button type="button" className="kr-confirm-button"
            disabled={busy || currentMap?.result_status !== "provisional"}
            onClick={() => void confirm()}>Confirmar y cerrar mapa</button>
        </div>
      </section>
    </div>
  );
}
