import { useState } from 'react';
import { Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption } from '@headlessui/react';
import { MapPin, Search } from 'lucide-react';
import { type Location } from '../api/locations';

interface LocationComboboxProps {
  locations: Location[];
  value: string;
  onChange: (value: string) => void;
  onCustomClick: () => void;
  placeholder?: string;
  id?: string;
}

export function LocationCombobox({ 
  locations, 
  value, 
  onChange, 
  onCustomClick, 
  placeholder = "-- Select or Search Venue --",
  id 
}: LocationComboboxProps) {
  const [query, setQuery] = useState('');

  const filteredLocations =
    (!Array.isArray(locations))
      ? []
      : query === ''
        ? locations
        : locations.filter((loc) => {
            return loc.name.toLowerCase().includes(query.toLowerCase()) || 
                   (loc.address || "").toLowerCase().includes(query.toLowerCase());
          });

  return (
    <Combobox value={value || ''} onChange={(val: string | null) => {
      if (val === 'CUSTOM') {
        onCustomClick();
      } else if (val) {
        onChange(val);
      }
    }} onClose={() => setQuery('')}>
      <div className="relative group">
        <ComboboxInput
          id={id}
          className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/60 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner pr-10"
          placeholder={placeholder}
          displayValue={(val: string) => val}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-auto text-white/60 hover:text-ares-red transition-colors">
          {query ? <Search size={16} /> : <MapPin size={16} />}
        </ComboboxButton>
        
        <ComboboxOptions 
          transition
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto bg-obsidian border border-white/10 ares-cut-sm shadow-xl focus:outline-none data-[closed]:opacity-0 transition duration-200"
        >
          {Array.isArray(filteredLocations) && filteredLocations.map((loc) => (
            <ComboboxOption
              key={loc.id}
              value={loc.name}
              className="group flex cursor-pointer items-center gap-2 py-2 px-4 select-none data-[focus]:bg-ares-red/20 data-[focus]:text-white text-white/80 font-bold"
            >
              <div className="flex flex-col">
                <span className="font-bold">{loc.name}</span>
                <span className="text-[10px] text-white/50">{loc.address || ""}</span>
              </div>
            </ComboboxOption>
          ))}
          
          {filteredLocations.length === 0 && query !== '' && (
            <div className="py-2 px-4 text-xs text-white/50 italic">
              No matching venues found.
            </div>
          )}

          <ComboboxOption 
            value="CUSTOM"
            className="group flex cursor-pointer items-center gap-2 py-3 px-4 select-none data-[focus]:bg-ares-red data-[focus]:text-white text-ares-red font-bold uppercase tracking-wider text-xs border-t border-white/10 mt-1"
          >
            --- Manual Entry / New Venue ---
          </ComboboxOption>
        </ComboboxOptions>
      </div>
    </Combobox>
  );
}
