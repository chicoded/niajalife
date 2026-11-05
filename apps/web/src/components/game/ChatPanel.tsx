import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { CHAT } from "@naijaverse/shared";

export interface ChatLine {
  key: number;
  name: string;
  text: string;
  system: boolean;
}

interface ChatPanelProps {
  lines: ChatLine[];
  onSend: (text: string) => void;
  onClose: () => void;
}

export function ChatPanel({ lines, onSend, onClose }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the newest message in view as the log grows.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(event: FormEvent): void {
    event.preventDefault();
    const text = draft.trim().slice(0, CHAT.maxLength);
    if (text) onSend(text);
    setDraft("");
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <div className="panel chat">
      <div className="chat-log" ref={logRef}>
        {lines.length === 0 ? (
          <div className="chat-line system">Say hello — everyone in the district can see this.</div>
        ) : (
          lines.map((line) => (
            <div key={line.key} className={`chat-line${line.system ? " system" : ""}`}>
              {line.system ? null : <span className="who">{line.name}</span>}
              {line.text}
            </div>
          ))
        )}
      </div>

      <form className="chat-form" onSubmit={submit}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          maxLength={CHAT.maxLength}
          placeholder="Type a message and press Enter"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="btn btn-primary btn-sm" type="submit">
          Send
        </button>
        <button className="btn btn-sm" type="button" onClick={onClose}>
          Close
        </button>
      </form>
    </div>
  );
}
