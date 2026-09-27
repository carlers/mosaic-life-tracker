import { Client, Account } from 'appwrite';

export const APPWRITE_ENDPOINT =
  import.meta.env.VITE_APPWRITE_ENDPOINT?.trim() ||
  'https://sgp.cloud.appwrite.io/v1';
export const APPWRITE_PROJECT_ID =
  import.meta.env.VITE_APPWRITE_PROJECT_ID?.trim() ||
  '6a9703c50016b37110ff';

const client = new Client();
client.setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);

export const account = new Account(client);
export { client };
