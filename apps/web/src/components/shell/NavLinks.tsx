"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./TopBar.module.css";

export type NavItem = { href: string; text: string };

/**
 * The main navigation: a `nav` of links. The link of the current route, or of a route above it, carries
 * `aria-current="page"`. A client component because it reads the path; its strings come from the server
 * component that renders it.
 */
export function NavLinks({ items, name }: { items: NavItem[]; name: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={name} className={styles.nav}>
      <ul className={styles.list}>
        {items.map((item) => {
          const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                aria-current={current ? "page" : undefined}
                className={styles.link}
                href={item.href}
              >
                {item.text}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
