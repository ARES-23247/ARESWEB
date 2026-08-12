import type { KeyboardEvent } from "react";

export interface AccessibleTabOption<T extends string> {
  value: T;
  label: string;
}

interface AccessibleTabsProps<T extends string> {
  id: string;
  label: string;
  tabs: readonly AccessibleTabOption<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
  className?: string;
  tabClassName?: (tab: T, active: boolean) => string;
}

export function tabElementId(groupId: string, value: string) {
  return `${groupId}-tab-${value}`;
}

export function tabPanelId(groupId: string, value: string) {
  return `${groupId}-panel-${value}`;
}

export default function AccessibleTabs<T extends string>({
  id,
  label,
  tabs,
  activeTab,
  onChange,
  className,
  tabClassName,
}: AccessibleTabsProps<T>) {
  const selectAndFocus = (value: T) => {
    onChange(value);
    document.getElementById(tabElementId(id, value))?.focus();
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    selectAndFocus(tabs[nextIndex].value);
  };

  return (
    <div id={id} role="tablist" aria-label={label} className={className}>
      {tabs.map((tab, index) => {
        const active = tab.value === activeTab;
        return (
          <button
            key={tab.value}
            id={tabElementId(id, tab.value)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={tabPanelId(id, tab.value)}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={tabClassName?.(tab.value, active)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
