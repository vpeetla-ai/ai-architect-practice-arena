"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function QuestionNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link href={href} className={`nav-question-link${isActive ? " active" : ""}`}>
      {children}
    </Link>
  );
}
