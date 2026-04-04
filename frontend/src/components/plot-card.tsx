import type { PropsWithChildren } from "react";

import styles from "./plot-card.module.css";

type Props = PropsWithChildren<{
  title: string;
  meta?: string;
}>;

export function PlotCard({ title, meta, children }: Props) {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>{title}</h3>
      {meta ? <p className={styles.meta}>{meta}</p> : null}
      {children}
    </div>
  );
}
