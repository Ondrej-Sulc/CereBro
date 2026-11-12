"use client";

import { ArrowUpRight } from "lucide-react";
import styles from "./modifier-name.module.css";

export function ModifierName({ name, href }: { name: string; href?: string | null }) {
  if (!href) return name;
  return <a href={href} className={styles.link} aria-label={`View ${name} node modifier`} onClick={event => event.stopPropagation()}>
    <span>{name}</span><ArrowUpRight size={13} aria-hidden="true"/>
  </a>;
}
