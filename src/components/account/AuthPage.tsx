import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ShieldCheck, ArrowLeft } from "lucide-react";
export function AuthPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid min-h-[75vh] max-w-5xl items-center gap-12 px-5 py-12 md:grid-cols-2 md:py-20">
      <div className="hidden self-stretch flex-col justify-center rounded-lg border border-border bg-secondary/30 p-10 md:flex">
        <p className="eyebrow mb-6">Built for creators</p>
        <h2 className="max-w-sm text-4xl font-semibold leading-tight tracking-tight">
          Your next chapter starts here.
        </h2>
        <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          One account for your listings, conversations and acquisitions. Keep your details up to
          date and your identity protected.
        </p>
        <div className="mt-10 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          Secure sign-in. Your password stays private.
        </div>
      </div>
      <div className="mx-auto w-full max-w-sm">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to bestottr
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mb-7 mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        {children}
      </div>
    </div>
  );
}
