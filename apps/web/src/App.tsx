import { useCallback, useEffect, useState } from "react";
import { DEFAULT_APPEARANCE, type AppearanceUpdate, type CharacterAppearance } from "@naijaverse/shared";
import { LandingPage } from "./pages/LandingPage";
import { CreateCharacterPage } from "./pages/CreateCharacterPage";
import { GamePage } from "./pages/GamePage";
import { restoreSession, saveCharacter, setSession, type Account } from "./profile";

type Screen = "landing" | "create" | "game";

export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [account, setAccount] = useState<Account | null>(null);
  const [appearance, setAppearance] = useState<CharacterAppearance>(DEFAULT_APPEARANCE);

  // Bring back whoever was signed in on this device.
  useEffect(() => {
    const existing = restoreSession();
    if (!existing) return;
    setAccount(existing);
    setAppearance(existing.character);
  }, []);

  const handleAuthenticated = useCallback((next: Account) => {
    setAccount(next);
    setAppearance(next.character);
  }, []);

  const handleSignOut = useCallback(() => {
    setSession(null);
    setAccount(null);
    setAppearance(DEFAULT_APPEARANCE);
    setScreen("landing");
  }, []);

  const handleCharacterConfirmed = useCallback(
    (next: CharacterAppearance) => {
      const updated = account ? saveCharacter(account.username, next) : null;
      if (updated) setAccount(updated);
      setAppearance(next);
      setScreen("game");
    },
    [account],
  );

  const handleAppearanceChange = useCallback(
    (update: AppearanceUpdate) => {
      setAppearance((current) => {
        const next = { ...current, ...update };
        if (account) saveCharacter(account.username, next);
        return next;
      });
    },
    [account],
  );

  if (screen === "game" && account) {
    return (
      <GamePage
        account={account}
        appearance={appearance}
        onExit={() => setScreen("landing")}
        onAppearanceChange={handleAppearanceChange}
      />
    );
  }

  if (screen === "create" && account) {
    return (
      <CreateCharacterPage
        initial={appearance}
        onConfirm={handleCharacterConfirmed}
        onBack={() => setScreen("landing")}
      />
    );
  }

  return (
    <LandingPage
      account={account}
      onAuthenticated={handleAuthenticated}
      onSignOut={handleSignOut}
      onPlay={() => setScreen("create")}
    />
  );
}
