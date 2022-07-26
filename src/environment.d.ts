declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ATTESTATION_SIGNING_KEY: string;
      APPLICATION_CLIENT_ID: string;
      APPLICATION_CLIENT_SECRET: string;
      BANK_GUID: string;
      BASE_URL: string;
      TIMEOUT: string;
    }
  }
}

export {};
