"use client";

import { useState, useEffect, FormEvent } from "react";

const PASSWORD = "odyssey";
const STORAGE_KEY = "bfi-imax-auth";

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === "1") {
      setAuthenticated(true);
    }
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (input === PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setAuthenticated(true);
    } else {
      setError(true);
      setInput("");
    }
  }

  if (authenticated) return <>{children}</>;

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg-deep)" }}
    >
      <form
        onSubmit={handleSubmit}
        className="rounded-lg p-8 border w-full max-w-sm"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          BFI IMAX Monitor
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          Enter the password to continue.
        </p>
        <input
          type="password"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(false);
          }}
          placeholder="Password"
          autoFocus
          className="w-full rounded px-3 py-2 text-sm border outline-none mb-3"
          style={{
            background: "var(--bg-deep)",
            borderColor: error ? "var(--accent-red)" : "var(--border)",
            color: "var(--text-primary)",
          }}
        />
        {error && (
          <p className="text-xs mb-3" style={{ color: "var(--accent-red)" }}>
            Incorrect password.
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded px-3 py-2 text-sm font-medium border-0 cursor-pointer"
          style={{
            background: "linear-gradient(135deg, var(--accent-gold), var(--accent-gold-dim))",
            color: "var(--bg-deep)",
          }}
        >
          Enter
        </button>
      </form>
    </div>
  );
}
