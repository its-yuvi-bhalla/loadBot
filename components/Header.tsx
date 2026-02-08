import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--card-border)] bg-[var(--background)]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold text-[var(--foreground)]">
          LoadBot
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            Home
          </Link>
          <Link
            href="/history"
            className="text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            History
          </Link>
          <Link
            href="/docs"
            className="text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            Docs
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
