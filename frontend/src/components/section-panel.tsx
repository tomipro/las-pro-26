import type { PropsWithChildren, ReactNode } from "react";

import styles from "./section-panel.module.css";

type Props = PropsWithChildren<{
  title?: string;
  right?: ReactNode;
  className?: string;
}>;

export function SectionPanel({ title, right, className = "", children }: Props) {
  return (
    <section className={`${styles.panel} ${className}`}>
      {(title || right) && (
        <div className={styles.header}>
          {title ? <h2 className={styles.title}>{title}</h2> : <span />}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
