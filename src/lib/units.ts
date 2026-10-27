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
