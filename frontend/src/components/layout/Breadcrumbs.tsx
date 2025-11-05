"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildCrumbs } from "@/lib/path";

export default function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname || "/");

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs" role="navigation">
      <ol className="breadcrumbs-list">
        <li className="breadcrumb-item">
          <Link href="/" className="breadcrumb-link">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9,22 9,12 15,12 15,22" />
            </svg>
            Inicio
          </Link>
        </li>
        {crumbs.map((c, i) => (
          <li key={c.href} className="breadcrumb-item">
            <span className="breadcrumb-separator" aria-hidden="true">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9,18 15,12 9,6" />
              </svg>
            </span>
            {i < crumbs.length - 1 ? (
              <Link href={c.href} className="breadcrumb-link">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="breadcrumb-current">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
