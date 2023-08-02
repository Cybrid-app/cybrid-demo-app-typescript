import * as axios_lib from 'axios';

import { Config } from './config';

const axios = axios_lib.default;

const ACCOUNTS_SCOPES = ['accounts:read', 'accounts:execute'];
const BANKS_SCOPES = ['banks:read', 'banks:write'];
const CUSTOMER_SCOPES = [
  'customers:read',
  'customers:write',
  'customers:execute',
];
const PRICES_SCOPES = ['prices:read'];
const QUOTES_SCOPES = ['quotes:read', 'quotes:execute'];
const TRADES_SCOPES = ['trades:read', 'trades:execute'];
const TRANSFERS_SCOPES = ['transfers:read', 'transfers:execute'];
const EXTERNAL_WALLET_SCOPES = ['external_wallets:read', 'external_wallets:execute'];
const SCOPES = [
  ...ACCOUNTS_SCOPES,
  ...BANKS_SCOPES,
  ...CUSTOMER_SCOPES,
  ...PRICES_SCOPES,
  ...QUOTES_SCOPES,
  ...TRADES_SCOPES,
  ...TRANSFERS_SCOPES,
  ...EXTERNAL_WALLET_SCOPES,
];

const AUTH_URL = `${Config.URL_SCHEME}://id.${Config.BASE_URL}/oauth/token`;

async function getToken(): Promise<string> {
  console.log('Getting auth token...');
  try {
    const config = {
      headers: {
        'Content-type': 'application/json',
      },
    };
    const data = {
      grant_type: 'client_credentials',
      client_id: Config.CLIENT_ID,
      client_secret: Config.CLIENT_SECRET,
      scope: SCOPES.join(' '),
    };
    const response = await axios.post(AUTH_URL, data, config);
    console.log('Got auth token.');
    return response.data['access_token'];
  } catch (error) {
    console.error(`Unable to get auth token due to an error: ${error}`);
    throw error;
  }
}

export { getToken };
