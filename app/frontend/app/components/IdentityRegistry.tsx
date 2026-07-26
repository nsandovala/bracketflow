"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  ApiError,
  createIdentityPlayer,
  createIdentityTeam,
  createPlayerGameIdentity,
  getIdentityPlayers,
  getIdentityTeams,
  getPlayerGameIdentities,
  updateIdentityPlayer,
  type PlayerGameIdentity,
  type PlayerProfile,
  type TeamProfile,
} from "../../lib/api";

function optional(value: string) {
  return value.trim() || null;
}

function errorMessage(error: unknown) {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : "No se pudo completar la operación.";
}

export default function IdentityRegistry() {
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [identities, setIdentities] = useState<PlayerGameIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"team" | "player" | "identity" | "broadcast" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [teamName, setTeamName] = useState("");
  const [teamShortName, setTeamShortName] = useState("");
  const [teamPrimaryColor, setTeamPrimaryColor] = useState("");
  const [teamSecondaryColor, setTeamSecondaryColor] = useState("");
  const [teamNotes, setTeamNotes] = useState("");

  const [playerName, setPlayerName] = useState("");
  const [playerShortName, setPlayerShortName] = useState("");
  const [playerCountry, setPlayerCountry] = useState("");
  const [playerNotes, setPlayerNotes] = useState("");

  const [broadcastPlayerId, setBroadcastPlayerId] = useState("");
  const [declaredKd, setDeclaredKd] = useState("");
  const [broadcastRole, setBroadcastRole] = useState("");
  const [declaredPlatform, setDeclaredPlatform] = useState("");
  const [preferredInput, setPreferredInput] = useState("");
  const [broadcastCountry, setBroadcastCountry] = useState("");
  const [shortBio, setShortBio] = useState("");
  const [broadcastNotes, setBroadcastNotes] = useState("");
  const [socialHandle, setSocialHandle] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [identityPlayerId, setIdentityPlayerId] = useState("");
  const [game, setGame] = useState("");
  const [gameHandle, setGameHandle] = useState("");
  const [gameId, setGameId] = useState("");
  const [platform, setPlatform] = useState("");
  const [region, setRegion] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
        getIdentityPlayers(),
        getIdentityTeams(),
        getPlayerGameIdentities(),
      ])
      .then(([nextPlayers, nextTeams, nextIdentities]) => {
        if (!active) return;
        setPlayers(nextPlayers);
        setTeams(nextTeams);
        setIdentities(nextIdentities);
        if (nextPlayers[0]) {
          setBroadcastPlayerId(String(nextPlayers[0].id));
          loadBroadcastDraft(nextPlayers[0]);
        }
      })
      .catch((loadError) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedIdentityPlayerId = identityPlayerId || (players[0] ? String(players[0].id) : "");
  const selectedBroadcastPlayerId =
    broadcastPlayerId || (players[0] ? String(players[0].id) : "");

  function loadBroadcastDraft(profile: PlayerProfile) {
    setDeclaredKd(
      profile.declared_kd === null ? "" : String(profile.declared_kd)
    );
    setBroadcastRole(profile.role ?? "");
    setDeclaredPlatform(profile.declared_platform ?? "");
    setPreferredInput(profile.preferred_input ?? "");
    setBroadcastCountry(profile.country ?? "");
    setShortBio(profile.short_bio ?? "");
    setBroadcastNotes(profile.broadcast_notes ?? "");
    setSocialHandle(profile.social_handle ?? "");
    setAvatarUrl(profile.avatar_url ?? "");
  }

  function selectBroadcastPlayer(playerId: string) {
    setBroadcastPlayerId(playerId);
    const profile = players.find((player) => player.id === Number(playerId));
    if (profile) loadBroadcastDraft(profile);
  }

  const playerNames = useMemo(
    () => new Map(players.map((player) => [player.id, player.display_name])),
    [players]
  );

  async function saveTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("team");
    setError("");
    setNotice("");
    try {
      const created = await createIdentityTeam({
        display_name: teamName,
        short_name: optional(teamShortName),
        logo_url: null,
        primary_color: optional(teamPrimaryColor),
        secondary_color: optional(teamSecondaryColor),
        notes: optional(teamNotes),
      });
      setTeams((current) => [...current, created].sort((a, b) => a.display_name.localeCompare(b.display_name)));
      setTeamName("");
      setTeamShortName("");
      setTeamPrimaryColor("");
      setTeamSecondaryColor("");
      setTeamNotes("");
      setNotice("Equipo agregado al registro de identidad.");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(null);
    }
  }

  async function savePlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("player");
    setError("");
    setNotice("");
    try {
      const created = await createIdentityPlayer({
        display_name: playerName,
        short_name: optional(playerShortName),
        country: optional(playerCountry),
        avatar_url: null,
        notes: optional(playerNotes),
      });
      setPlayers((current) => [...current, created].sort((a, b) => a.display_name.localeCompare(b.display_name)));
      setIdentityPlayerId(String(created.id));
      setBroadcastPlayerId(String(created.id));
      loadBroadcastDraft(created);
      setPlayerName("");
      setPlayerShortName("");
      setPlayerCountry("");
      setPlayerNotes("");
      setNotice("Jugador agregado al registro de identidad.");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(null);
    }
  }

  async function saveBroadcastProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBroadcastPlayerId) return;
    setSaving("broadcast");
    setError("");
    setNotice("");
    try {
      const updated = await updateIdentityPlayer(
        Number(selectedBroadcastPlayerId),
        {
          declared_kd: declaredKd.trim() ? Number(declaredKd) : null,
          role: optional(broadcastRole) as PlayerProfile["role"],
          declared_platform: optional(
            declaredPlatform
          ) as PlayerProfile["declared_platform"],
          preferred_input: optional(
            preferredInput
          ) as PlayerProfile["preferred_input"],
          country: optional(broadcastCountry),
          short_bio: optional(shortBio),
          broadcast_notes: optional(broadcastNotes),
          social_handle: optional(socialHandle),
          avatar_url: optional(avatarUrl),
        }
      );
      setPlayers((current) =>
        current
          .map((player) => (player.id === updated.id ? updated : player))
          .sort((left, right) =>
            left.display_name.localeCompare(right.display_name)
          )
      );
      setNotice("Perfil para broadcast actualizado.");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(null);
    }
  }

  async function saveIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("identity");
    setError("");
    setNotice("");
    try {
      const created = await createPlayerGameIdentity({
        player_profile_id: Number(selectedIdentityPlayerId),
        game,
        game_handle: gameHandle,
        game_id: optional(gameId),
        platform: optional(platform),
        region: optional(region),
        verified_status: "unverified",
      });
      setIdentities((current) => [...current, created]);
      setGame("");
      setGameHandle("");
      setGameId("");
      setPlatform("");
      setRegion("");
      setNotice("Identidad de juego agregada.");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="identity-registry" aria-labelledby="identity-registry-title">
      <div className="identity-hero opr-panel">
        <div>
          <div className="opr-eyebrow">Metadata operativa · workspace</div>
          <h2 id="identity-registry-title">Identity Registry</h2>
          <p className="sub">
            Normaliza nombres de equipos y jugadores para standings, caster notes y overlays futuros.
          </p>
        </div>
        <div className="identity-guardrail">
          <strong>Identity no cambia puntos.</strong>
          <span>Los reportes oficiales siguen siendo la fuente de scoring. Identity solo agrega metadata.</span>
          <span>No modifica reportes ni recalcula resultados.</span>
        </div>
      </div>

      {error ? <div className="identity-feedback is-error" role="alert">{error}</div> : null}
      {notice ? <div className="identity-feedback is-success" role="status">{notice}</div> : null}

      {loading ? (
        <div className="opr-panel identity-state" aria-live="polite">Cargando Identity Registry...</div>
      ) : (
        <div className="identity-columns">
          <section className="opr-panel identity-section">
            <div className="identity-section-head">
              <div><div className="opr-eyebrow">Organizaciones</div><h3>Equipos</h3></div>
              <span>{teams.length} registrados</span>
            </div>
            <form className="identity-form" onSubmit={saveTeam}>
              <label className="opr-field"><span>Nombre visible</span><input required minLength={2} value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Gedeon Esport" /></label>
              <div className="identity-form-row">
                <label className="opr-field"><span>Nombre corto</span><input maxLength={24} value={teamShortName} onChange={(e) => setTeamShortName(e.target.value)} placeholder="GED" /></label>
                <label className="opr-field"><span>Color primario</span><input maxLength={32} value={teamPrimaryColor} onChange={(e) => setTeamPrimaryColor(e.target.value)} placeholder="#61f2a3" /></label>
                <label className="opr-field"><span>Color secundario</span><input maxLength={32} value={teamSecondaryColor} onChange={(e) => setTeamSecondaryColor(e.target.value)} placeholder="#0b1220" /></label>
              </div>
              <label className="opr-field"><span>Notas para operación / caster</span><textarea value={teamNotes} onChange={(e) => setTeamNotes(e.target.value)} placeholder="Contexto opcional del equipo" /></label>
              <button className="bf-button bf-button-primary" disabled={saving !== null}>Agregar equipo</button>
            </form>
            <div className="identity-list">
              {teams.length === 0 ? <p className="identity-empty">Todavía no hay equipos de identidad.</p> : teams.map((team) => (
                <article className="identity-record" key={team.id}>
                  <div><strong>{team.display_name}</strong><span>{team.short_name || "Sin nombre corto"}</span></div>
                  <div className="identity-meta">
                    {team.primary_color ? <span><i style={{ background: team.primary_color }} />{team.primary_color}</span> : null}
                    {team.secondary_color ? <span><i style={{ background: team.secondary_color }} />{team.secondary_color}</span> : null}
                    {team.notes ? <span>{team.notes}</span> : null}
                  </div>
                </article>
              ))}
            </div>
            <details className="identity-broadcast">
              <summary>
                <span>Perfil para broadcast</span>
                <small>Opcional · contexto para caster</small>
              </summary>
              {players.length === 0 ? (
                <p className="identity-empty">
                  Crea un jugador antes de configurar su perfil para broadcast.
                </p>
              ) : (
                <form className="identity-broadcast-form" onSubmit={saveBroadcastProfile}>
                  <p className="identity-helper">
                    Información declarada para contexto de transmisión. No modifica scoring ni estadísticas oficiales.
                  </p>
                  <label className="opr-field identity-broadcast-player">
                    <span>Jugador</span>
                    <select
                      value={selectedBroadcastPlayerId}
                      onChange={(event) => selectBroadcastPlayer(event.target.value)}
                    >
                      {players.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.display_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="identity-form-row is-two">
                    <label className="opr-field">
                      <span>K/D declarado · opcional</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={declaredKd}
                        onChange={(event) => setDeclaredKd(event.target.value)}
                        placeholder="2.45"
                      />
                    </label>
                    <label className="opr-field">
                      <span>Rol · opcional</span>
                      <select value={broadcastRole} onChange={(event) => setBroadcastRole(event.target.value)}>
                        <option value="">Sin dato</option>
                        <option value="slayer">Slayer</option>
                        <option value="support">Support</option>
                        <option value="flex">Flex</option>
                        <option value="igl">IGL</option>
                        <option value="unknown">Desconocido</option>
                      </select>
                    </label>
                  </div>
                  <div className="identity-form-row">
                    <label className="opr-field">
                      <span>Plataforma · opcional</span>
                      <select value={declaredPlatform} onChange={(event) => setDeclaredPlatform(event.target.value)}>
                        <option value="">Sin dato</option>
                        <option value="pc">PC</option>
                        <option value="console">Consola</option>
                        <option value="unknown">Desconocida</option>
                      </select>
                    </label>
                    <label className="opr-field">
                      <span>Input preferido · opcional</span>
                      <select value={preferredInput} onChange={(event) => setPreferredInput(event.target.value)}>
                        <option value="">Sin dato</option>
                        <option value="controller">Controller</option>
                        <option value="keyboard_mouse">Teclado y mouse</option>
                        <option value="unknown">Desconocido</option>
                      </select>
                    </label>
                    <label className="opr-field">
                      <span>País · opcional</span>
                      <input maxLength={48} value={broadcastCountry} onChange={(event) => setBroadcastCountry(event.target.value)} placeholder="CL" />
                    </label>
                  </div>
                  <div className="identity-form-row is-two">
                    <label className="opr-field">
                      <span>Social · opcional</span>
                      <input maxLength={120} value={socialHandle} onChange={(event) => setSocialHandle(event.target.value)} placeholder="@jugador" />
                    </label>
                    <label className="opr-field">
                      <span>Avatar URL · opcional</span>
                      <input type="url" maxLength={500} value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://…" />
                    </label>
                  </div>
                  <label className="opr-field">
                    <span>Bio corta · opcional</span>
                    <textarea maxLength={280} value={shortBio} onChange={(event) => setShortBio(event.target.value)} placeholder="Contexto breve y declarado por el jugador." />
                  </label>
                  <label className="opr-field">
                    <span>Nota para caster · opcional</span>
                    <textarea maxLength={500} value={broadcastNotes} onChange={(event) => setBroadcastNotes(event.target.value)} placeholder="Pronunciación, historia o contexto útil para transmisión." />
                  </label>
                  <button className="bf-button bf-button-primary" disabled={saving !== null}>
                    {saving === "broadcast" ? "Guardando…" : "Guardar perfil broadcast"}
                  </button>
                </form>
              )}
            </details>
          </section>

          <section className="opr-panel identity-section">
            <div className="identity-section-head">
              <div><div className="opr-eyebrow">Personas</div><h3>Jugadores</h3></div>
              <span>{players.length} registrados</span>
            </div>
            <form className="identity-form" onSubmit={savePlayer}>
              <label className="opr-field"><span>Nombre visible</span><input required minLength={2} value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="NeonWolf" /></label>
              <div className="identity-form-row is-two">
                <label className="opr-field"><span>Nombre corto</span><input maxLength={24} value={playerShortName} onChange={(e) => setPlayerShortName(e.target.value)} placeholder="NEO" /></label>
                <label className="opr-field"><span>País</span><input maxLength={48} value={playerCountry} onChange={(e) => setPlayerCountry(e.target.value)} placeholder="CL" /></label>
              </div>
              <label className="opr-field"><span>Notas para operación / caster</span><textarea value={playerNotes} onChange={(e) => setPlayerNotes(e.target.value)} placeholder="Contexto opcional del jugador" /></label>
              <button className="bf-button bf-button-primary" disabled={saving !== null}>Agregar jugador</button>
            </form>
            <div className="identity-list">
              {players.length === 0 ? <p className="identity-empty">Todavía no hay jugadores de identidad.</p> : players.map((player) => (
                <article className="identity-record" key={player.id}>
                  <div><strong>{player.display_name}</strong><span>{player.short_name || "Sin nombre corto"}</span></div>
                  <div className="identity-meta">
                    {player.country ? <span>{player.country}</span> : null}
                    {player.notes ? <span>{player.notes}</span> : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {!loading ? (
        <section className="opr-panel identity-section identity-games">
          <div className="identity-section-head">
            <div><div className="opr-eyebrow">Aliases externos</div><h3>Identidades de juego</h3></div>
            <span>{identities.length} registradas</span>
          </div>
          <p className="identity-helper">Asocia un handle a un jugador del registro. El estado inicial queda como no verificado.</p>
          <form className="identity-game-form" onSubmit={saveIdentity}>
            <label className="opr-field"><span>Jugador</span><select required value={selectedIdentityPlayerId} onChange={(e) => setIdentityPlayerId(e.target.value)} disabled={players.length === 0}><option value="">Selecciona un jugador</option>{players.map((player) => <option key={player.id} value={player.id}>{player.display_name}</option>)}</select></label>
            <label className="opr-field"><span>Juego</span><input required minLength={2} value={game} onChange={(e) => setGame(e.target.value)} placeholder="Warzone" /></label>
            <label className="opr-field"><span>Game handle</span><input required minLength={2} value={gameHandle} onChange={(e) => setGameHandle(e.target.value)} placeholder="player#1234" /></label>
            <label className="opr-field"><span>Game ID</span><input maxLength={64} value={gameId} onChange={(e) => setGameId(e.target.value)} placeholder="Opcional" /></label>
            <label className="opr-field"><span>Plataforma</span><input maxLength={64} value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="PC" /></label>
            <label className="opr-field"><span>Región</span><input maxLength={64} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="LATAM" /></label>
            <button className="bf-button bf-button-primary" disabled={saving !== null || players.length === 0}>Agregar identidad</button>
          </form>
          {players.length === 0 ? <p className="identity-empty">Crea un jugador antes de asociar una identidad de juego.</p> : null}
          <div className="identity-game-list">
            {identities.length === 0 ? <p className="identity-empty">Todavía no hay identidades de juego.</p> : identities.map((identity) => (
              <article className="identity-game-record" key={identity.id}>
                <div><strong>{identity.game_handle}</strong><span>{playerNames.get(identity.player_profile_id) || `Jugador #${identity.player_profile_id}`}</span></div>
                <div><span>{identity.game}</span>{identity.game_id ? <span>ID {identity.game_id}</span> : null}{identity.platform ? <span>{identity.platform}</span> : null}{identity.region ? <span>{identity.region}</span> : null}<span className="identity-status">No verificado</span></div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
