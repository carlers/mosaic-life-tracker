// Source-owned, non-secret, immutable Oracle application-DR read targets.
// Executable admin scripts import this data instead of assuming any default
// Production project. Backup and restore actions still require separate
// explicit target confirmations and operator authorization.
export const ORACLE_DR_ENDPOINT = 'https://129-221-244-67.sslip.io/v1';

export const ORACLE_DR_TARGETS = Object.freeze({
  scratch: Object.freeze({
    projectId: '6ae94a2100014d01f5ed',
    prefix: 'mosaic-oracle-scratch-dr/v1',
  }),
  production: Object.freeze({
    projectId: '6ae9599c002ab812f9c3',
    prefix: 'mosaic-oracle-dr/v1',
  }),
});

export const ORACLE_DR_MESSAGE_FUNCTION_ID = '6aa8057f002a4c306fdd';
