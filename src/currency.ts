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
