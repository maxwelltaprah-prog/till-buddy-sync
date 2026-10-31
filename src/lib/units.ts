export const UNIT_OPTIONS = [
  { value: 'pcs', label: 'Pieces' }, { value: 'piece', label: 'Piece' }, { value: 'pair', label: 'Pair' },
  { value: 'set', label: 'Set' }, { value: 'dozen', label: 'Dozen' },
  { value: 'kg', label: 'Kilograms' }, { value: 'g', label: 'Grams' },
  { value: 'l', label: 'Liters' }, { value: 'ml', label: 'Milliliters' }, { value: 'gallon', label: 'Gallon' },
  { value: 'm', label: 'Meter' }, { value: 'cm', label: 'Centimeter' }, { value: 'yard', label: 'Yard' },
  { value: 'box', label: 'Box' }, { value: 'carton', label: 'Carton' }, { value: 'case', label: 'Case' },
  { value: 'crate', label: 'Crate' }, { value: 'pack', label: 'Pack' }, { value: 'packet', label: 'Packet' },
  { value: 'bag', label: 'Bag' }, { value: 'sack', label: 'Sack' }, { value: 'bottle', label: 'Bottle' },
  { value: 'can', label: 'Can' }, { value: 'tin', label: 'Tin' }, { value: 'jar', label: 'Jar' },
  { value: 'tube', label: 'Tube' }, { value: 'sachet', label: 'Sachet' }, { value: 'roll', label: 'Roll' },
  { value: 'bundle', label: 'Bundle' }, { value: 'tray', label: 'Tray' }, { value: 'ream', label: 'Ream' },
  { value: 'pallet', label: 'Pallet' },
] as const;

export type UnitValue = (typeof UNIT_OPTIONS)[number]['value'];
export const UNIT_VALUES: string[] = UNIT_OPTIONS.map((u) => u.value);

const ALIASES: Record<string, string> = {
  pc: 'pcs', pce: 'piece', pieces: 'pcs', pairs: 'pair', sets: 'set', dozens: 'dozen', dz: 'dozen',
  kgs: 'kg', kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg', gram: 'g', grams: 'g', gm: 'g', gms: 'g',
  liter: 'l', liters: 'l', litre: 'l', litres: 'l', ltr: 'l', ltrs: 'l', lt: 'l',
  milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml', gallons: 'gallon', gal: 'gallon',
  meter: 'm', meters: 'm', metre: 'm', metres: 'm', centimeter: 'cm', centimeters: 'cm', centimetre: 'cm', centimetres: 'cm',
  yards: 'yard', yd: 'yard', yds: 'yard', boxes: 'box', ctn: 'carton', ctns: 'carton', cases: 'case', packs: 'pack', pkt: 'packet',
  bunches: 'bundle', trays: 'tray', reams: 'ream',
};

/** Map a unit typed by a person (label, plural, abbreviation, any case) to a stored unit value, or null. */
export function normalizeUnit(input: unknown): string | null {
  const s = String(input ?? '').trim().toLowerCase().replace(/\.$/, '');
  if (!s) return null;
  if (UNIT_VALUES.includes(s)) return s;
  const label = UNIT_OPTIONS.find((u) => u.label.toLowerCase() === s);
  if (label) return label.value;
  if (ALIASES[s]) return ALIASES[s];
  if (s.endsWith('s') && UNIT_VALUES.includes(s.slice(0, -1))) return s.slice(0, -1);
  if (s.endsWith('es') && UNIT_VALUES.includes(s.slice(0, -2))) return s.slice(0, -2);
  return null;
}
