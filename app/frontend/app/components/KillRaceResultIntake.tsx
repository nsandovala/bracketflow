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

type Props = {
  match: Match;
  leftTeam: Team;
  rightTeam: Team;
  onChanged: () => Promise<unknown>;
};

export function calculatedSideTotal(side: KillRaceImportPreview["left"]) {
  return side?.players.reduce((total, player) => total + player.kills, 0) ?? 0;
}

export default function KillRaceResultIntake({ match, leftTeam, rightTeam, onChanged }: Props) {
  const nextMap = Math.min(
    match.maps.find((item) => item.result_status !== "confirmed")?.map_number ??
      match.maps.filter((item) => item.result_status === "confirmed").length + 1,
    match.best_of
  );
  const [mapNumber, setMapNumber] = useState(nextMap);
  const [content, setContent] = useState("");
  const [format, setFormat] = useState<"txt" | "csv">("txt");
  const [preview, setPreview] = useState<KillRaceImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const currentMap = match.maps.find((item) => item.map_number === mapNumber);
  const issues = useMemo(
    () => [...(preview?.errors ?? []), ...(preview?.conflicts ?? [])],
    [preview]
  );

  async function runPreview(nextContent = content, nextFormat = format) {
    if (!nextContent.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      setPreview(
        await previewKillRaceImport(match.id, {
          format: nextFormat,
          content: nextContent,
          map_number: mapNumber,
        })
      );
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
    setFormat("csv");
    setContent(nextContent);
    await runPreview(nextContent, "csv");
    event.target.value = "";
  }

  async function saveProvisional() {
    if (!preview?.valid || !preview.left || !preview.right || preview.map_number !== mapNumber) return;
    setBusy(true);
    try {
      await saveKillRaceProvisional(match.id, {
        map_number: mapNumber,
        status: "provisional",
        left: preview.left,
        right: preview.right,
      });
      setMessage("Resultado provisional actualizado.");
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
      setMessage("Resultado confirmado. El marcador de serie fue actualizado.");
      setPreview(null);
      setContent("");
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo confirmar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kr-intake">
      <div className="opr-inputs">
        <div className="opr-field">
          <label>Partida</label>
          <input type="number" min="1" max={match.best_of} value={mapNumber}
            onChange={(event) => { setMapNumber(Number(event.target.value)); setPreview(null); }} />
        </div>
        <div className="opr-field kr-intake-text">
          <label>Importar TXT</label>
          <textarea value={content} onChange={(event) => { setFormat("txt"); setContent(event.target.value); }}
            placeholder={`MATCH: ${mapNumber}\nLEFT: ${leftTeam.name}\nJugador: 0\n\nRIGHT: ${rightTeam.name}\nJugador: 0`} />
        </div>
        <div className="opr-field">
          <label>Archivo CSV</label>
          <input type="file" accept=".csv,text/csv" onChange={handleCsv} />
        </div>
      </div>
      <div className="bf-hub-form-actions">
        <button type="button" className="bf-button bf-button-ghost" disabled={busy || !content.trim()}
          onClick={() => void runPreview()}>Previsualizar</button>
      </div>
      {preview?.left && preview.right ? (
        <div className="kr-preview">
          {[preview.left, preview.right].map((side) => (
            <div className="opr-teamcard" key={side.side}>
              <div className="h"><span className="n">{side.team_name}</span>
                <strong>{calculatedSideTotal(side)} kills</strong></div>
              <span className="r">{side.players.map((player) => `${player.player_name} ${player.kills}`).join(" · ")}</span>
            </div>
          ))}
        </div>
      ) : null}
      {issues.length ? <ul className="kr-errors">{issues.map((issue, index) =>
        <li key={`${issue.code}-${index}`}>{issue.row ? `Fila ${issue.row}: ` : ""}{issue.message}</li>)}</ul> : null}
      {message ? <p className="sub">{message}</p> : null}
      <div className="bf-hub-form-actions">
        <button type="button" className="opr-save" disabled={busy || !preview?.valid}
          onClick={() => void saveProvisional()}>Crear / actualizar provisional</button>
        <button type="button" className="bf-button bf-button-primary"
          disabled={busy || currentMap?.result_status !== "provisional"}
          onClick={() => void confirm()}>Confirmar resultado</button>
      </div>
    </div>
  );
}
