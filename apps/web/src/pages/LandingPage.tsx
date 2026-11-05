import { useState, type FormEvent } from "react";
import { DISTRICTS, skinHex } from "@naijaverse/shared";
import { GAME_SERVER_URL } from "../config";
import { PASSWORD_MIN, USERNAME_MIN, listAccounts, login, register, type Account } from "../profile";

interface LandingPageProps {
  account: Account | null;
  onAuthenticated: (account: Account) => void;
  onSignOut: () => void;
  onPlay: () => void;
}

export function LandingPage({ account, onAuthenticated, onSignOut, onPlay }: LandingPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const known = listAccounts();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const next = mode === "login" ? await login(username, password) : await register(username, password);
      setPassword("");
      onAuthenticated(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="shell stack">
        <header className="brand">
          <h1>NaijaVerse</h1>
          <span className="tag">Milestone 01 · Multiplayer Vertical Slice</span>
        </header>

        <p className="lede">
          A persistent, browser-first multiplayer Nigerian life simulation. Sign in, create a character and walk into a
          shared Yaba where other real players move, talk and change their look alongside you. No fake characters, no
          mocked networking — every position you see was validated by the game server.
        </p>

        <div className="grid grid-2">
          <section className="card">
            <h2>Your account</h2>
            {account ? (
              <>
                <p className="sub">
                  Signed in on this device. Your character is saved and will be waiting when you come back.
                </p>
                <div className="account-line" style={{ marginBottom: 16 }}>
                  <div className="avatar-chip">
                    <span className="swatch" style={{ background: skinHex(account.character.skinTone) }} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{account.character.name}</div>
                      <div style={{ color: "var(--muted)", fontSize: 12.5 }}>@{account.username}</div>
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={onSignOut} type="button">
                    Sign out
                  </button>
                </div>
                <button className="btn btn-primary" onClick={onPlay} type="button" style={{ width: "100%" }}>
                  Enter Lagos
                </button>
              </>
            ) : (
              <form className="stack" onSubmit={submit}>
                <p className="sub">
                  {mode === "login"
                    ? "Welcome back. Sign in to continue your life in the city."
                    : "Create an account to begin. Two accounts can play together from two browser tabs."}
                </p>

                <div className="field">
                  <label htmlFor="username">Username</label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    autoComplete="username"
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder={`At least ${USERNAME_MIN} characters`}
                  />
                </div>

                <div className="field">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={`At least ${PASSWORD_MIN} characters`}
                  />
                </div>

                {error ? <div className="notice notice-error">{error}</div> : null}

                <div className="row">
                  <button className="btn btn-primary" type="submit" disabled={busy}>
                    {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => {
                      setMode(mode === "login" ? "register" : "login");
                      setError("");
                    }}
                  >
                    {mode === "login" ? "I need an account" : "I already have an account"}
                  </button>
                </div>

                {known.length > 0 ? (
                  <div className="notice">
                    On this device:{" "}
                    {known.map((item) => (
                      <button
                        key={item.username}
                        type="button"
                        className="option"
                        style={{ margin: "2px 4px 2px 0", padding: "4px 9px", fontSize: 12.5 }}
                        onClick={() => {
                          setMode("login");
                          setUsername(item.username);
                        }}
                      >
                        @{item.username}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="notice notice-info">
                  Accounts are stored in this browser for Milestone 01, so you can play immediately with no backend
                  setup. Supabase Auth with Row Level Security replaces this in the persistence phase — the account
                  shape already matches those tables.
                </div>
              </form>
            )}
          </section>

          <section className="card">
            <h2>Districts</h2>
            <p className="sub">Lagos is opened one neighbourhood at a time. Only Yaba is built so far.</p>
            <div className="districts">
              {DISTRICTS.map((district) => (
                <div className="district" key={district.id}>
                  <h3>
                    {district.name}
                    <span className={`pill ${district.playable ? "pill-live" : ""}`}>
                      {district.playable ? "Playable" : "Locked"}
                    </span>
                  </h3>
                  <p>{district.playable ? district.blurb : (district.note ?? district.blurb)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid grid-2">
          <section className="card">
            <h2>What is actually in this build</h2>
            <ul className="sub" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.85 }}>
              <li>A real 3D Yaba rendered with Babylon.js — 16 buildings, danfo buses, markets, street props.</li>
              <li>Third-person movement with a follow camera, WASD on desktop and a thumbstick on mobile.</li>
              <li>Server-authoritative multiplayer over Colyseus: positions, rotation and appearance all validated.</li>
              <li>Real players visible with name tags, plus distance-based interpolation.</li>
              <li>Text chat, building interactions (barber, boutique, and descriptions for every venue).</li>
              <li>Reconnection: a dropped connection holds your character for 15 seconds before releasing it.</li>
            </ul>
          </section>

          <section className="card">
            <h2>Not built yet — honestly</h2>
            <ul className="sub" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.85 }}>
              <li>No jobs, money, businesses, elections or vehicles. The architecture doc defers these on purpose.</li>
              <li>Other districts (Ikeja, Lekki, Surulere) are listed but not playable.</li>
              <li>Server-side persistence is next: today the Colyseus server holds no database.</li>
              <li>Voice chat, crews and relationships are later milestones.</li>
            </ul>
            <div className="notice" style={{ marginTop: 14 }}>
              Game server: <code>{GAME_SERVER_URL}</code> — start it with <code>npm run dev</code>.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
