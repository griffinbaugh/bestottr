import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Links a seller name/avatar to the public seller profile. */
export function SellerLink({ handle, children, className }: { handle: string; children: ReactNode; className?: string }) {
  return (
    <Link to="/user/$handle" params={{ handle }} className={className ?? "hover:text-foreground hover:underline"} data-testid="seller-link">
      {children}
    </Link>
  );
}

export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className ?? "inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"}>
      {children}
    </a>
  );
}
