const DANGER_STYLES = {
  faible: "border-green-500/50 text-green-400",
  modéré: "border-yellow-500/50 text-yellow-400",
  élevé: "border-orange-500/50 text-orange-400",
  expert: "border-red-500/50 text-red-400",
  extrême: "border-red-600 text-red-300",
};

export default function DangerBadge({ label, danger }) {
  const cls = DANGER_STYLES[label] || DANGER_STYLES.modéré;
  return (
    <span className={`text-[10px] px-2 py-0.5 border font-display tracking-wider uppercase ${cls}`}>
      Danger {label || "modéré"}{danger ? ` · ${danger}/5` : ""}
    </span>
  );
}
