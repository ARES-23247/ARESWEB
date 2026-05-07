import { Territory, Continent as _Continent, PlayerColor } from '../types';
import { CONTINENTS } from '../constants';

export function createWorldMap(): Territory[] {
  const territories: Territory[] = [
    // North America
    { id: 'alaska', name: 'Alaska', owner: null, armies: 0, neighbors: [], continent: 'North America', x: 70, y: 80 },
    { id: 'nwt', name: 'NW Territory', owner: null, armies: 0, neighbors: [], continent: 'North America', x: 130, y: 90 },
    { id: 'alberta', name: 'Alberta', owner: null, armies: 0, neighbors: [], continent: 'North America', x: 150, y: 130 },
    { id: 'ontario', name: 'Ontario', owner: null, armies: 0, neighbors: [], continent: 'North America', x: 190, y: 110 },
    { id: 'quebec', name: 'Quebec', owner: null, armies: 0, neighbors: [], continent: 'North America', x: 230, y: 120 },
    { id: 'westernus', name: 'Western US', owner: null, armies: 0, neighbors: [], continent: 'North America', x: 140, y: 180 },
    { id: 'easternus', name: 'Eastern US', owner: null, armies: 0, neighbors: [], continent: 'North America', x: 200, y: 170 },
    { id: 'centralamerica', name: 'Central America', owner: null, armies: 0, neighbors: [], continent: 'North America', x: 160, y: 230 },

    // South America
    { id: 'venezuela', name: 'Venezuela', owner: null, armies: 0, neighbors: [], continent: 'South America', x: 190, y: 270 },
    { id: 'peru', name: 'Peru', owner: null, armies: 0, neighbors: [], continent: 'South America', x: 200, y: 320 },
    { id: 'brazil', name: 'Brazil', owner: null, armies: 0, neighbors: [], continent: 'South America', x: 250, y: 300 },
    { id: 'argentina', name: 'Argentina', owner: null, armies: 0, neighbors: [], continent: 'South America', x: 220, y: 380 },

    // Europe
    { id: 'iceland', name: 'Iceland', owner: null, armies: 0, neighbors: [], continent: 'Europe', x: 330, y: 70 },
    { id: 'scandinavia', name: 'Scandinavia', owner: null, armies: 0, neighbors: [], continent: 'Europe', x: 380, y: 60 },
    { id: 'uk', name: 'UK', owner: null, armies: 0, neighbors: [], continent: 'Europe', x: 340, y: 100 },
    { id: 'northerneurope', name: 'Northern Europe', owner: null, armies: 0, neighbors: [], continent: 'Europe', x: 400, y: 110 },
    { id: 'westerneurope', name: 'Western Europe', owner: null, armies: 0, neighbors: [], continent: 'Europe', x: 370, y: 150 },
    { id: 'southerneurope', name: 'Southern Europe', owner: null, armies: 0, neighbors: [], continent: 'Europe', x: 430, y: 160 },

    // Africa
    { id: 'northwestafrica', name: 'NW Africa', owner: null, armies: 0, neighbors: [], continent: 'Africa', x: 350, y: 210 },
    { id: 'egypt', name: 'Egypt', owner: null, armies: 0, neighbors: [], continent: 'Africa', x: 460, y: 200 },
    { id: 'eastafrica', name: 'East Africa', owner: null, armies: 0, neighbors: [], continent: 'Africa', x: 500, y: 250 },
    { id: 'centralsafrica', name: 'Central Africa', owner: null, armies: 0, neighbors: [], continent: 'Africa', x: 440, y: 280 },
    { id: 'southafrica', name: 'South Africa', owner: null, armies: 0, neighbors: [], continent: 'Africa', x: 460, y: 360 },
    { id: 'madagascar', name: 'Madagascar', owner: null, armies: 0, neighbors: [], continent: 'Africa', x: 540, y: 330 },

    // Asia
    { id: 'ural', name: 'Ural', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 480, y: 90 },
    { id: 'siberia', name: 'Siberia', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 560, y: 60 },
    { id: 'yakutsk', name: 'Yakutsk', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 640, y: 50 },
    { id: 'kamchatka', name: 'Kamchatka', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 710, y: 70 },
    { id: 'afghanistan', name: 'Afghanistan', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 520, y: 140 },
    { id: 'china', name: 'China', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 600, y: 150 },
    { id: 'mongolia', name: 'Mongolia', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 630, y: 110 },
    { id: 'japan', name: 'Japan', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 730, y: 130 },
    { id: 'middleeast', name: 'Middle East', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 480, y: 180 },
    { id: 'india', name: 'India', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 560, y: 200 },
    { id: 'siam', name: 'Siam', owner: null, armies: 0, neighbors: [], continent: 'Asia', x: 620, y: 230 },

    // Australia
    { id: 'indonesia', name: 'Indonesia', owner: null, armies: 0, neighbors: [], continent: 'Australia', x: 640, y: 300 },
    { id: 'newguinea', name: 'New Guinea', owner: null, armies: 0, neighbors: [], continent: 'Australia', x: 700, y: 280 },
    { id: 'westernaustralia', name: 'Western Australia', owner: null, armies: 0, neighbors: [], continent: 'Australia', x: 650, y: 360 },
    { id: 'easternaustralia', name: 'Eastern Australia', owner: null, armies: 0, neighbors: [], continent: 'Australia', x: 720, y: 350 },
  ];

  // Define neighbors (simplified for gameplay)
  const neighbors: Record<string, string[]> = {
    alaska: ['nwt', 'alberta', 'kamchatka'],
    nwt: ['alaska', 'alberta', 'ontario', 'alaska'],
    alberta: ['alaska', 'nwt', 'ontario', 'westernus'],
    ontario: ['nwt', 'alberta', 'westernus', 'easternus', 'quebec'],
    quebec: ['ontario', 'easternus'],
    westernus: ['alberta', 'ontario', 'easternus', 'centralamerica'],
    easternus: ['ontario', 'quebec', 'westernus', 'centralamerica'],
    centralamerica: ['westernus', 'easternus', 'venezuela'],

    venezuela: ['centralamerica', 'peru', 'brazil'],
    peru: ['venezuela', 'brazil', 'argentina'],
    brazil: ['venezuela', 'peru', 'argentina', 'northwestafrica'],
    argentina: ['peru', 'brazil'],

    iceland: ['uk', 'scandinavia', 'greenland'],
    scandinavia: ['iceland', 'uk', 'northerneurope', 'ural'],
    uk: ['iceland', 'scandinavia', 'northerneurope', 'westerneurope'],
    northerneurope: ['scandinavia', 'uk', 'westerneurope', 'southerneurope', 'ural'],
    westerneurope: ['uk', 'northerneurope', 'southerneurope', 'northwestafrica'],
    southerneurope: ['northerneurope', 'westerneurope', 'egypt', 'middleeast'],

    northwestafrica: ['westerneurope', 'brazil', 'egypt', 'centralsafrica'],
    egypt: ['southerneurope', 'northwestafrica', 'eastafrica', 'middleeast'],
    eastafrica: ['egypt', 'centralsafrica', 'southafrica', 'madagascar', 'middleeast'],
    centralafrica: ['northwestafrica', 'egypt', 'eastafrica', 'southafrica'],
    southafrica: ['centralsafrica', 'eastafrica', 'madagascar'],
    madagascar: ['eastafrica', 'southafrica'],

    ural: ['scandinavia', 'northerneurope', 'afghanistan', 'siberia', 'china'],
    siberia: ['ural', 'yakutsk', 'mongolia', 'china'],
    yakutsk: ['siberia', 'kamchatka'],
    kamchatka: ['yakutsk', 'siberia', 'mongolia', 'japan', 'alaska'],
    afghanistan: ['ural', 'china', 'india', 'middleeast'],
    china: ['ural', 'afghanistan', 'india', 'siam', 'mongolia', 'siberia'],
    mongolia: ['siberia', 'china', 'kamchatka'],
    japan: ['kamchatka', 'mongolia'],
    middleeast: ['southerneurope', 'egypt', 'eastafrica', 'india', 'afghanistan'],
    india: ['afghanistan', 'china', 'siam', 'middleeast'],
    siam: ['china', 'india', 'indonesia'],

    indonesia: ['siam', 'newguinea', 'westernaustralia', 'easternaustralia'],
    newguinea: ['indonesia', 'easternaustralia', 'westernaustralia'],
    westernaustralia: ['indonesia', 'newguinea', 'easternaustralia'],
    easternaustralia: ['indonesia', 'newguinea', 'westernaustralia'],
  };

  territories.forEach(t => {
    t.neighbors = neighbors[t.id] || [];
  });

  // Update continent territories
  territories.forEach(t => {
    const continent = CONTINENTS.find(c => c.name === t.continent);
    if (continent) {
      continent.territories.push(t.id);
    }
  });

  return territories;
}

export function getContinentBonus(territories: Territory[], playerColor: PlayerColor): number {
  let bonus = 0;
  CONTINENTS.forEach(continent => {
    const ownsAll = continent.territories.every(tId => {
      const t = territories.find(x => x.id === tId);
      return t?.owner === playerColor;
    });
    if (ownsAll) bonus += continent.bonus;
  });
  return bonus;
}

export function getTerritory(territories: Territory[], id: string): Territory | undefined {
  return territories.find(t => t.id === id);
}

export function updateTerritoryArmies(territories: Territory[], id: string, delta: number): Territory[] {
  return territories.map(t =>
    t.id === id ? { ...t, armies: Math.max(0, t.armies + delta) } : t
  );
}

export function updateTerritoryOwner(territories: Territory[], id: string, owner: PlayerColor | null, armies: number): Territory[] {
  return territories.map(t =>
    t.id === id ? { ...t, owner, armies } : t
  );
}
