import { Button } from "@ares/ui/button";
import {
  TOOL_KINDS,
  makeObject,
  type LevelDefinition,
  type ToolStock,
} from "../core/level";
import { OBJECT_LABELS } from "./GardenScene";
import GamePanel from "./GamePanel";
import SupplyForm from "./SupplyForm";

export default function InventoryEditor({
  level,
  onChange,
}: {
  level: LevelDefinition;
  onChange: (inventory: ToolStock[]) => void;
}) {
  const inventory = level.inventory ?? [];
  return (
    <GamePanel
      compact={level.schemaVersion >= 6}
      title="Player tool supply"
      legacyClassName="ww-panel"
    >
      <p>
        Supply movable tools for the player to place. Returning an unoccupied
        tool restores its supply. These tools are separate from pieces already
        in the garden.
        {level.schemaVersion >= 6 &&
          " Dancers each use a real hive member. Setup removal refunds a dance use; release after launch keeps it spent."}
      </p>
      <div className="ww-toolbar">
        {TOOL_KINDS.filter(
          (kind) => kind !== "dancer" || level.schemaVersion >= 6,
        ).map((kind) => (
          <Button
            key={kind}
            variant="secondary"
            onClick={() => {
              let index = 1;
              while (inventory.some((entry) => entry.id === `supply-${index}`))
                index++;
              const object = makeObject("template", kind, 0, 0);
              onChange([
                ...inventory,
                {
                  id: `supply-${index}`,
                  kind,
                  count: 1,
                  width: object.width,
                  height: object.height,
                  direction: object.direction,
                  range: object.range,
                  strength: object.strength,
                  ...(kind === "dancer" ? { dance: object.dance } : {}),
                },
              ]);
            }}
          >
            Supply {OBJECT_LABELS[kind].toLowerCase()}
          </Button>
        ))}
      </div>
      {!inventory.length && (
        <p>
          No extra tools supplied. Players can use the pieces already in the
          garden.
        </p>
      )}
      {inventory.map((stock) => (
        <SupplyForm
          key={JSON.stringify(stock)}
          level={level}
          stock={stock}
          onApply={(next) =>
            onChange(
              inventory.map((entry) => (entry.id === stock.id ? next : entry)),
            )
          }
          onRemove={() =>
            onChange(inventory.filter((entry) => entry.id !== stock.id))
          }
        />
      ))}
    </GamePanel>
  );
}
