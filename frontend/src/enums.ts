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



export enum TurbidityType {
  Crystalline = 'crystalline',
  Hazy = 'hazy',
  Cloudy = 'cloudy',
}

export const TurbidityTypeOptions = [
  { value: TurbidityType.Crystalline, label: 'Crystalline' },
  { value: TurbidityType.Hazy, label: 'Hazy' },
  { value: TurbidityType.Cloudy, label: 'Cloudy' },
];

export enum EffervescenceType {
  Flat = 'flat',
  Perlant = 'perlant',
  Sparkling = 'sparkling',
}

export const EffervescenceTypeOptions = [
  { value: EffervescenceType.Flat, label: 'Flat' },
  { value: EffervescenceType.Perlant, label: 'Perlant' },
  { value: EffervescenceType.Sparkling, label: 'Sparkling' },
];

export enum AcidityType {
  Mild = 'mild',
  Moderate = 'moderate',
  Strong = 'strong',
}

export const AcidityTypeOptions = [
  { value: AcidityType.Mild, label: 'Mild' },
  { value: AcidityType.Moderate, label: 'Moderate' },
  { value: AcidityType.Strong, label: 'Strong' },
];

export enum TaninsType {
  Mild = 'mild',
  Moderate = 'moderate',
}

export const TaninsTypeOptions = [
  { value: TaninsType.Mild, label: 'Mild' },
  { value: TaninsType.Moderate, label: 'Moderate' },
];

export enum BodyType {
  Light = 'light',
  Medium = 'medium',
  Full = 'full',
}

export const BodyTypeOptions = [
  { value: BodyType.Light, label: 'Light' },
  { value: BodyType.Medium, label: 'Medium' },
  { value: BodyType.Full, label: 'Full' },
];



export function getTurbidityTypeLabel(value: string): string {
  const option = TurbidityTypeOptions.find(opt => opt.value === value);
  return option ? option.label : value;
}

export function getEffervescenceTypeLabel(value: string): string {
  const option = EffervescenceTypeOptions.find(opt => opt.value === value);
  return option ? option.label : value;
}

export function getAcidityTypeLabel(value: string): string {
  const option = AcidityTypeOptions.find(opt => opt.value === value);
  return option ? option.label : value;
}

export function getTaninsTypeLabel(value: string): string {
  const option = TaninsTypeOptions.find(opt => opt.value === value);
  return option ? option.label : value;
}

export function getBodyTypeLabel(value: string): string {
  const option = BodyTypeOptions.find(opt => opt.value === value);
  return option ? option.label : value;
}