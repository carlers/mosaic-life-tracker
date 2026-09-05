import { Client, Account } from 'appwrite';

const client = new Client();
client
    .setEndpoint('https://sgp.cloud.appwrite.io/v1') // Singapore regional endpoint
    .setProject('6a9703c50016b37110ff');

export const account = new Account(client);
export { client };