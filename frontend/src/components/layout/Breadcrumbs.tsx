"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { buildCrumbs } from "@/lib/path";

export default function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname || "/");

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm" role="navigation">
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-neutral-600">
        <li className="flex items-center gap-1">
          <Link
            href="/"
            className="rounded px-1.5 py-0.5 font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-medical-500 focus:ring-offset-1"
          >
            Inicio
          </Link>
        </li>
        {crumbs.map((c, i) => (
          <li key={c.href} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 shrink-0 text-neutral-400" aria-hidden />
            {i < crumbs.length - 1 ? (
              <Link
                href={c.href}
                className="truncate rounded px-1.5 py-0.5 font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-medical-500 focus:ring-offset-1"
              >
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-semibold text-neutral-900">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
