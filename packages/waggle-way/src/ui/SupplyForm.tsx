import { useState } from "react";
import { Button } from "@ares/ui/button";
import {
  DANCE_TYPES,
  DIRECTION_NAMES,
  TOOL_KINDS,
  type DanceType,
  type Direction,
  type LevelDefinition,
  type ToolKind,
  type ToolStock,
} from "../core/level";
import { OBJECT_LABELS } from "./GardenScene";

export default function SupplyForm({
  level,
  stock,
  onApply,
  onRemove,
}: {
  level: LevelDefinition;
  stock: ToolStock;
  onApply: (next: ToolStock) => void;
  onRemove: () => void;
}) {
  // Keep unapplied values when changing type, including temporarily absent fields.
  const [draft, setDraft] = useState({
    kind: stock.kind,
    dance: stock.dance ?? "point",
    count: String(stock.count),
    width: String(stock.width),
    height: String(stock.height),
    range: String(stock.range),
    direction: String(stock.direction),
    strength: String(stock.strength),
  });
  const dancer = draft.kind === "dancer";
  const shelter = draft.kind === "shelter";
  const followsBee =
    level.rulesVersion >= 7 && dancer && draft.dance !== "point";
  const fields = [
    { name: "count", label: "Supply count", max: 20 },
    ...(!dancer
      ? [
          { name: "width", label: "Tool width", max: level.width },
          { name: "height", label: "Tool height", max: level.height },
        ]
      : []),
    ...(!shelter
      ? [{ name: "range", label: "Tool influence range", max: 16 }]
      : []),
  ];
  return (
    <form
      className="ww-supply-edit"
      aria-label={`Edit ${stock.id}`}
      onSubmit={(event) => {
        event.preventDefault();
        const next: ToolStock = {
          ...stock,
          kind: draft.kind,
          count: Number(draft.count),
          width: dancer ? 1 : Number(draft.width),
          height: dancer ? 1 : Number(draft.height),
          range: shelter ? stock.range : Number(draft.range),
          direction: (shelter || followsBee
            ? stock.direction
            : Number(draft.direction)) as Direction,
          strength:
            draft.kind === "fan" ? Number(draft.strength) : stock.strength,
        };
        if (dancer) next.dance = draft.dance;
        else delete next.dance;
        onApply(next);
      }}
    >
      <h3>
        {OBJECT_LABELS[draft.kind]} · {stock.id}
      </h3>
      <div className="ww-form-grid">
        <label>
          Tool type
          <select
            name="kind"
            value={draft.kind}
            onChange={(event) =>
              setDraft({ ...draft, kind: event.target.value as ToolKind })
            }
          >
            {TOOL_KINDS.filter(
              (kind) => kind !== "dancer" || level.schemaVersion >= 6,
            ).map((kind) => (
              <option key={kind} value={kind}>
                {OBJECT_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>
        {dancer && (
          <label>
            Dance type
            <select
              name="dance"
              value={draft.dance}
              onChange={(event) =>
                setDraft({ ...draft, dance: event.target.value as DanceType })
              }
            >
              {DANCE_TYPES.filter(
                (dance) => dance !== "lift" || level.rulesVersion >= 8,
              ).map((dance) => (
                <option key={dance} value={dance}>
                  {dance === "point"
                    ? "Point a direction"
                    : dance === "lift"
                      ? "Lift · six cells"
                      : dance === "reverse"
                        ? "Reverse 180°"
                        : `Turn ${dance} 90°`}
                </option>
              ))}
            </select>
          </label>
        )}
        {fields.map((field) => (
          <label key={field.name}>
            {field.label}
            <input
              name={field.name}
              type="number"
              min={1}
              max={field.max}
              required
              value={
                draft[field.name as "count" | "width" | "height" | "range"]
              }
              onChange={(event) =>
                setDraft({ ...draft, [field.name]: event.target.value })
              }
            />
          </label>
        ))}
        {!shelter && !followsBee && (
          <label>
            Starting direction
            <select
              name="direction"
              value={draft.direction}
              onChange={(event) =>
                setDraft({ ...draft, direction: event.target.value })
              }
            >
              {DIRECTION_NAMES.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        {draft.kind === "fan" && (
          <label>
            Starting fan strength
            <select
              name="strength"
              value={draft.strength}
              onChange={(event) =>
                setDraft({ ...draft, strength: event.target.value })
              }
            >
              <option value={1}>Gentle</option>
              <option value={2}>Medium</option>
              <option value={3}>Strong</option>
            </select>
          </label>
        )}
      </div>
      <p className="ww-caption">
        {dancer
          ? followsBee
            ? "One cell per dancer. This helper follows the last bee it guided; no release heading is needed."
            : "One cell per dancer. Direction and influence define its guidance."
          : shelter
            ? "Leaf shelter uses its width and height."
            : draft.kind === "fan"
              ? "Direction, range and strength define the airflow."
              : "Direction and influence define the guide's signal."}
      </p>
      <div className="ww-toolbar">
        <Button type="submit">Apply supply</Button>
        <Button variant="secondary" onClick={onRemove}>
          Remove supply {stock.id}
        </Button>
      </div>
    </form>
  );
}
