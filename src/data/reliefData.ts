export interface Shelter {
  id: string;
  name: string;
  district: 'Harbor' | 'Midtown' | 'Eastside' | 'Northgate';
  total_beds: number;
  available_beds: number;
  wheelchair_accessible: boolean;
  backup_power: boolean;
  pet_friendly: boolean;
  status: 'OPEN' | 'NEAR_CAPACITY';
}

export interface SupplyItem {
  key: 'water_packs' | 'medical_kits' | 'blankets' | 'baby_formula' | 'solar_chargers';
  label: string;
  quantity: number;
  hub: string;
}

export interface ActivityTicket {
  id: string;
  kind: 'RESERVATION' | 'DISPATCH';
  shelterId: string;
  shelterName: string;
  summary: string;
  priority?: string;
  timestamp: string;
  approvedByHuman: boolean;
}

export const INITIAL_SHELTERS: Shelter[] = [
  {
    id: 'SH-201',
    name: 'Midtown Civic Center',
    district: 'Midtown',
    total_beds: 120,
    available_beds: 28,
    wheelchair_accessible: true,
    backup_power: true,
    pet_friendly: false,
    status: 'OPEN'
  },
  {
    id: 'SH-305',
    name: 'Northgate High School Gym',
    district: 'Northgate',
    total_beds: 160,
    available_beds: 46,
    wheelchair_accessible: true,
    backup_power: true,
    pet_friendly: true,
    status: 'OPEN'
  },
  {
    id: 'SH-104',
    name: 'Harbor Pier Community Hall',
    district: 'Harbor',
    total_beds: 80,
    available_beds: 7,
    wheelchair_accessible: false,
    backup_power: false,
    pet_friendly: true,
    status: 'NEAR_CAPACITY'
  },
  {
    id: 'SH-412',
    name: 'Eastside Library Annex',
    district: 'Eastside',
    total_beds: 65,
    available_beds: 19,
    wheelchair_accessible: true,
    backup_power: false,
    pet_friendly: true,
    status: 'OPEN'
  }
];

export const INITIAL_SUPPLIES: SupplyItem[] = [
  { key: 'water_packs', label: 'Potable Water (24-pk)', quantity: 145, hub: 'Midtown Depot' },
  { key: 'medical_kits', label: 'Trauma & First-Aid Kits', quantity: 38, hub: 'Midtown Depot' },
  { key: 'blankets', label: 'Thermal Blankets', quantity: 92, hub: 'Northgate Hub' },
  { key: 'baby_formula', label: 'Infant Formula Packs', quantity: 24, hub: 'Northgate Hub' },
  { key: 'solar_chargers', label: 'Solar Power Banks', quantity: 31, hub: 'Eastside Annex' }
];

export const INITIAL_TICKETS: ActivityTicket[] = [
  {
    id: 'TK-9041',
    kind: 'DISPATCH',
    shelterId: 'SH-201',
    shelterName: 'Midtown Civic Center',
    summary: 'Dispatched 12 Thermal Blankets (routine)',
    priority: 'routine',
    timestamp: '00:40 UTC',
    approvedByHuman: true
  }
];

export const DEMO_SCENARIOS = [
  {
    id: 'evac-insulin',
    badge: 'Full Multi-Peer + HITL Write',
    title: 'Harbor Family Evacuation + Insulin + Flood Detour',
    prompt:
      'Family of 3 in Harbor needs a wheelchair-accessible shelter with backup power, nearby insulin clinic check, safe route avoiding flooded bridges, and reserve 3 beds.'
  },
  {
    id: 'aid-dispatch',
    badge: 'Inventory + Supply Dispatch',
    title: 'Urgent Medical Kits Dispatch to Midtown',
    prompt:
      'Midtown shelter needs urgent dispatch of medical kits and verify water pack availability for incoming storm evacuees.'
  },
  {
    id: 'pet-pediatric',
    badge: 'Pet Shelter + Pediatric Peer',
    title: 'Eastside Pet-Friendly Shelter & Pediatric Triage',
    prompt:
      'Solo resident with a dog in Eastside needs a pet-friendly shelter bed reserved and a pediatric clinic check with safe wheelchair transit.'
  }
];
