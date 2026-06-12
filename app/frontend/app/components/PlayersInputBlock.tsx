import { FormEventHandler, RefObject } from "react";

import { Player } from "../../lib/api";

type PlayersInputBlockProps = {
  players: Player[];
  playerNickname: string;
  playerFormError: string | null;
  submitting: boolean;
  playerInputRef: RefObject<HTMLInputElement | null>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onPlayerNicknameChange: (value: string) => void;
};

export default function PlayersInputBlock({
  players,
  playerNickname,
  playerFormError,
  submitting,
  playerInputRef,
  onSubmit,
  onPlayerNicknameChange,
}: PlayersInputBlockProps) {
  return (
    <>
      <form className="bf-form bf-form-inline" onSubmit={onSubmit}>
        <label className="bf-grow">
          Alias del jugador
          <input
            ref={playerInputRef}
            value={playerNickname}
            onChange={(event) => onPlayerNicknameChange(event.target.value)}
            placeholder="Ej: Vito"
          />
        </label>
        <button type="submit" disabled={submitting}>
          Anadir jugador
        </button>
      </form>
      {playerFormError ? <p className="bf-inline-error">{playerFormError}</p> : null}
      {players.length === 0 ? (
        <p className="bf-empty">Todavia no hay jugadores.</p>
      ) : (
        <div className="bf-tag-grid">
          {players.map((player) => (
            <span key={player.id} className="bf-tag">
              {player.nickname}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
