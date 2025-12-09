export enum MeadType {
  Hidromel = 'hidromel',
  Melomel = 'melomel',
  Metheglin = 'metheglin',
  Bochet = 'bochet',
  Braggot = 'braggot',
  Pyment = 'pyment',
  Cyser = 'cyser',
  Rhodomel = 'rhodomel',
  Capsicumel = 'capsicumel',
  Acerglyn = 'acerglyn',
}

export const MeadTypeOptions = [
  { value: MeadType.Hidromel, label: 'Hidromel' },
  { value: MeadType.Melomel, label: 'Melomel' },
  { value: MeadType.Metheglin, label: 'Metheglin' },
  { value: MeadType.Bochet, label: 'Bochet' },
  { value: MeadType.Braggot, label: 'Braggot' },
  { value: MeadType.Pyment, label: 'Pyment' },
  { value: MeadType.Cyser, label: 'Cyser' },
  { value: MeadType.Rhodomel, label: 'Rhodomel' },
  { value: MeadType.Capsicumel, label: 'Capsicumel' },
  { value: MeadType.Acerglyn, label: 'Acerglyn' },
];

export enum SweetnessType {
  BoneDry = 'bone-dry',
  Dry = 'dry',
  SemiDry = 'semi-dry',
  SemiSweet = 'semi-sweet',
  Sweet = 'sweet',
  Dessert = 'dessert',
}

export const SweetnessTypeOptions = [
  { value: SweetnessType.BoneDry, label: 'Bone Dry' },
  { value: SweetnessType.Dry, label: 'Dry' },
  { value: SweetnessType.SemiDry, label: 'Semi Dry' },
  { value: SweetnessType.SemiSweet, label: 'Semi Sweet' },
  { value: SweetnessType.Sweet, label: 'Sweet' },
  { value: SweetnessType.Dessert, label: 'Dessert' },
];

export function getMeadTypeLabel(value: string): string {
  const option = MeadTypeOptions.find(opt => opt.value === value);
  return option ? option.label : value;
}

export function getSweetnessTypeLabel(value: string): string {
  const option = SweetnessTypeOptions.find(opt => opt.value === value);
  return option ? option.label : value;
}