import { DIRECTION_NAMES, type Direction } from "../core/level";

const positions = [4, 5, 6, 7, 0, 1, 2, 3] as const;
const arrows = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"];

export default function DirectionPad({
  direction,
  disabled,
  onChange,
  compact = false,
}: {
  direction: Direction;
  disabled?: boolean;
  onChange: (direction: Direction) => void;
  compact?: boolean;
}) {
  if (compact)
    return (
      <label className="ww-compact-heading">
        Heading
        <select
        aria-label="Heading direction"
          value={direction}
          disabled={disabled}
          onChange={(event) =>
            onChange(Number(event.target.value) as Direction)
          }
        >
          {DIRECTION_NAMES.map((name, index) => (
            <option key={name} value={index}>
              {arrows[index]} {name}
            </option>
          ))}
        </select>
      </label>
    );
  return (
    <div className="ww-direction-control">
      <div className="ww-compass" role="group" aria-label="Direction">
        {positions.map((heading, index) => (
          <button
            key={index}
            type="button"
            disabled={disabled}
            aria-label={`Point ${DIRECTION_NAMES[heading]}`}
            aria-pressed={direction === heading}
            onClick={() => onChange(heading)}
          >
            {arrows[heading]}
          </button>
        ))}
      </div>
      <span className="ww-caption">
        {DIRECTION_NAMES[direction]} · drag the arrow to turn
      </span>
    </div>
  );
}
