import styles from "./empty-plot.module.css";

type Props = {
  message: string;
};

export function EmptyPlot({ message }: Props) {
  return <div className={styles.empty}>{message}</div>;
}
