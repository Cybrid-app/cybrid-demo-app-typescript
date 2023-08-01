export interface Asset {
  iso_code: string;
  name: string;
  symbol: string;
  subunit: string;
  subunit_to_unit: number;
  separator: string;
  delimiter: string;
}

export const usd = {
  iso_code: 'USD',
  name: 'United States Dollar',
  symbol: '$',
  subunit: 'cents',
  subunit_to_unit: 100,
  separator: '.',
  delimiter: ','
};

export const bitcoin = {
  iso_code: 'BTC',
  name: 'Bitcoin',
  symbol: '₿',
  subunit: 'satoshi',
  subunit_to_unit: 100_000_000,
  separator: '.',
  delimiter: ','
};

export const ethereum = {
  iso_code: 'ETH',
  name: 'Ethereum',
  symbol: 'Ξ',
  subunit: 'wei',
  subunit_to_unit: 1_000_000_000_000_000_000,
  separator: '.',
  delimiter: ','
};

export const solana = {
  iso_code: 'SOL',
  name: 'Solana',
  symbol: '◎',
  subunit: 'lamport',
  subunit_to_unit: 1_000_000_000,
  separator: '.',
  delimiter: ','
};

export const usdc = {
  iso_code: 'USDC',
  name: 'USDC',
  symbol: '$',
  subunit: 'cents',
  subunit_to_unit: 1_000_000,
  separator: '.',
  delimiter: ','
};

export const usdc_sol = {
  iso_code: 'USDC_SOL',
  name: 'USDC (SOL)',
  symbol: '$',
  subunit: 'cents',
  subunit_to_unit: 1_000_000,
  separator: '.',
  delimiter: ','
};

export const usdc_pol = {
  iso_code: 'USDC_POL',
  name: 'USDC (POL)',
  symbol: '$',
  subunit: 'cents',
  subunit_to_unit: 1_000_000,
  separator: '.',
  delimiter: ','
};

export const usdc_ste = {
  iso_code: 'USDC_STE',
  name: 'USDC (STE)',
  symbol: '$',
  subunit: 'cents',
  subunit_to_unit: 10_000_000,
  separator: '.',
  delimiter: ','
};

export const crypto = [
  bitcoin,
  ethereum,
  solana,
  usdc,
  usdc_sol,
  usdc_ste,
  usdc_pol
];
