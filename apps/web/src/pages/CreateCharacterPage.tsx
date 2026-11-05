import { useState } from "react";
import {
  GENDERS,
  HAIRSTYLES,
  NAME_MAX,
  NAME_MIN,
  OUTFITS,
  SKIN_TONES,
  TRAITS,
  cleanName,
  type CharacterAppearance,
} from "@naijaverse/shared";
import { AvatarPreview } from "../components/AvatarPreview";

interface CreateCharacterPageProps {
  initial: CharacterAppearance;
  onConfirm: (appearance: CharacterAppearance) => void;
  onBack: () => void;
}

export function CreateCharacterPage({ initial, onConfirm, onBack }: CreateCharacterPageProps) {
  const [draft, setDraft] = useState<CharacterAppearance>(initial);

  const name = cleanName(draft.name);
  const nameError = name.length < NAME_MIN ? `Name must be at least ${NAME_MIN} characters.` : "";
  const trait = TRAITS.find((item) => item.id === draft.trait);

  const patch = (changes: Partial<CharacterAppearance>) => setDraft((current) => ({ ...current, ...changes }));

  return (
    <div className="screen">
      <div className="shell stack">
        <header className="brand">
          <h1 style={{ fontSize: "clamp(24px, 4vw, 34px)" }}>Create your character</h1>
          <span className="tag">Spawning in Yaba</span>
        </header>
        <p className="lede" style={{ margin: "10px 0 18px" }}>
          This is the person other players will meet. Everything you choose here is visible to everyone in the
          district — the barber and the boutique can change your hair and outfit later.
        </p>

        <div className="create-layout">
          <div className="preview">
            <AvatarPreview
              look={{ skinTone: draft.skinTone, hairstyle: draft.hairstyle, outfit: draft.outfit }}
            />
          </div>

          <div className="card">
            <div className="field" style={{ marginBottom: 18 }}>
              <label htmlFor="character-name">Character name</label>
              <input
                id="character-name"
                type="text"
                value={draft.name}
                maxLength={NAME_MAX}
                onChange={(event) => patch({ name: event.target.value })}
                placeholder="e.g. Chioma, Tunde, Blessing"
              />
              {nameError ? <span style={{ color: "var(--red)", fontSize: 12.5 }}>{nameError}</span> : null}
            </div>

            <div className="option-group">
              <h4>Gender</h4>
              <div className="options">
                {GENDERS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="option"
                    aria-pressed={draft.gender === option.id}
                    onClick={() => patch({ gender: option.id as CharacterAppearance["gender"] })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="option-group">
              <h4>Skin tone</h4>
              <div className="options">
                {SKIN_TONES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="option tone-option"
                    title={option.label}
                    aria-label={option.label}
                    aria-pressed={draft.skinTone === option.id}
                    style={{ background: option.hex }}
                    onClick={() => patch({ skinTone: option.id })}
                  />
                ))}
              </div>
            </div>

            <div className="option-group">
              <h4>Hairstyle</h4>
              <div className="options">
                {HAIRSTYLES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="option"
                    aria-pressed={draft.hairstyle === option.id}
                    onClick={() => patch({ hairstyle: option.id })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="option-group">
              <h4>Outfit</h4>
              <div className="options">
                {OUTFITS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="option"
                    aria-pressed={draft.outfit === option.id}
                    onClick={() => patch({ outfit: option.id })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="option-group" style={{ marginBottom: 8 }}>
              <h4>Trait</h4>
              <div className="options">
                {TRAITS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="option"
                    title={option.description}
                    aria-pressed={draft.trait === option.id}
                    onClick={() => patch({ trait: option.id })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {trait ? (
                <p className="sub" style={{ margin: "10px 0 0" }}>
                  {trait.description} Traits are recorded on your character now and will drive the life-simulation
                  systems in later milestones.
                </p>
              ) : null}
            </div>

            <div className="row" style={{ marginTop: 18 }}>
              <button
                className="btn btn-primary"
                type="button"
                disabled={Boolean(nameError)}
                onClick={() => onConfirm({ ...draft, name })}
              >
                Enter Yaba
              </button>
              <button className="btn btn-ghost" type="button" onClick={onBack}>
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
