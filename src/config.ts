import * as dotenv from 'dotenv';

dotenv.config();

const Config = {
  ATTESTATION_SIGNING_KEY: process.env.ATTESTATION_SIGNING_KEY,
  BANK_GUID: process.env.BANK_GUID,
  BASE_URL: process.env.BASE_URL,
  CLIENT_ID: process.env.APPLICATION_CLIENT_ID,
  CLIENT_SECRET: process.env.APPLICATION_CLIENT_SECRET,
  TIMEOUT: Number(process.env.TIMEOUT) * 1000,
  VERIFICATION_KEY_GUID: process.env.VERIFICATION_KEY_GUID,
};

export {Config};
