import { describe, expect, it } from 'vitest';
import {
  APPWRITE_DATABASE_ID, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID,
  APPWRITE_STORAGE_BUCKET_ID, APPWRITE_TABLES,
} from '../../src/lib/appwriteConfig';
import {
  auditAppwriteSourceWriteFreeze,
  type AppwriteWriterFreezeReadback,
} from '../../supabase-poc/appwriteWriterFreezePreflight';

const owner='legacy_owner';
const tableIds=[
  APPWRITE_TABLES.tasks,APPWRITE_TABLES.categories,APPWRITE_TABLES.diary,
  APPWRITE_TABLES.settings,APPWRITE_TABLES.bucketList,APPWRITE_TABLES.bucketTaskLinks,
];
const deployment=[APPWRITE_ENDPOINT,APPWRITE_PROJECT_ID,
  APPWRITE_DATABASE_ID,'cloud-fixture'].join('|');
const read=['read("user:legacy_owner")'];
function fixture():AppwriteWriterFreezeReadback {
  const tableGrants=tableIds.map(table=>({
    id:table,enabled:true as const,rowSecurity:true as const,
    permissions:[],
    ownerRows:[
      {id:table+'_1',ownerId:owner,permissions:[...read]},
    ],
  }));
  const expectedOwnerCounts=Object.fromEntries(
    [...tableIds,APPWRITE_STORAGE_BUCKET_ID].map(id=>[id,1]),
  ) as AppwriteWriterFreezeReadback['expectedOwnerCounts'];
  return {
    ownerLegacyId:owner,sourceDeploymentId:deployment,
    generation:'frozen_generation_15',expiresAt:'2999-01-01T00:00:00Z',
    tableGrants,expectedOwnerCounts,
    photoBucket:{
      id:APPWRITE_STORAGE_BUCKET_ID,enabled:true,fileSecurity:true,
      permissions:[],ownerFiles:[{id:'private_file_1',ownerId:owner,permissions:[...read]}],
    },
    functionGrants:[
      {id:'message-action',enabled:false,scopes:['rows.write','users.write']},
      {id:'dr-backup',enabled:true,scopes:['rows.read','files.read']},
    ],
    expectedFunctionCount:2,
    signedOldClientDenials:[...tableIds,APPWRITE_STORAGE_BUCKET_ID].flatMap(domain=>
      (['create','update','delete'] as const).map(operation=>({
        domain,operation,ownerId:owner,accountAuthenticated:true as const,
        httpStatus:403 as const,sourceDeploymentId:deployment,
        generation:'frozen_generation_15',
      }))),
  };
}
describe('administrative Appwrite old-PWA write cutoff audit (#1027)',()=>{
  it('provisionally accepts complete read-only ACL snapshot and all signed old-client 403 probes',()=>{
    const value=auditAppwriteSourceWriteFreeze(fixture());
    expect(value).toMatchObject({
      ownerId:owner,checkedPersonalTables:6,checkedOwnerRows:6,
      checkedOwnerFiles:1,checkedOldClientDenials:21,
      serverFreezeAuthorityAuthenticated:false,
      privilegedWriterCredentialsRevoked:false,
      providerCutoverEligible:false,
    });
    expect(value.inspectedMetadataSha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it('refuses existing production-style create(users) table grants despite read-only local UI',()=>{
    const x=fixture();
    x.tableGrants[0].permissions=['create("users")'];
    expect(()=>auditAppwriteSourceWriteFreeze(x)).toThrow(/client write permission remains/);
    const y=fixture();
    y.tableGrants[1].permissions=['create("user:legacy_owner")'];
    expect(()=>auditAppwriteSourceWriteFreeze(y)).toThrow(/client write permission remains/);
  });
  it('refuses old owner update and delete through rowSecurity even after table create is removed',()=>{
    for(const permission of ['update("user:legacy_owner")',
      'delete("users")','write("team:friends")']) {
      const x=fixture();x.tableGrants[0].ownerRows[0].permissions.push(permission);
      expect(()=>auditAppwriteSourceWriteFreeze(x))
        .toThrow(/client write permission remains/);
    }
  });
  it('refuses Storage bucket create and existing file update/delete rights',()=>{
    const x=fixture();x.photoBucket.permissions=['create("users")'];
    expect(()=>auditAppwriteSourceWriteFreeze(x)).toThrow(/photo bucket/);
    const y=fixture();y.photoBucket.ownerFiles[0].permissions=['delete("user:legacy_owner")'];
    expect(()=>auditAppwriteSourceWriteFreeze(y)).toThrow(/photo file row/);
  });
  it('refuses enabled Functions with privileged write scopes even if all direct client grants are gone',()=>{
    const x=fixture();x.functionGrants[0].enabled=true;
    expect(()=>auditAppwriteSourceWriteFreeze(x)).toThrow(/privileged Function/);
    const y=fixture();y.functionGrants[1].scopes.push('files.write');
    expect(()=>auditAppwriteSourceWriteFreeze(y)).toThrow(/privileged Function/);
  });
  it('rejects a missing or foreign owner record even with a copied count witness',()=>{
    const omitted=fixture();omitted.tableGrants[0].ownerRows=[];
    expect(()=>auditAppwriteSourceWriteFreeze(omitted))
      .toThrow(/incomplete independently counted/);
    const foreign=fixture();foreign.tableGrants[0].ownerRows[0].ownerId='other';
    expect(()=>auditAppwriteSourceWriteFreeze(foreign)).toThrow(/foreign/);
    const duplicate=fixture();duplicate.tableGrants[0].ownerRows.push(
      {...duplicate.tableGrants[0].ownerRows[0]});
    duplicate.expectedOwnerCounts[tableIds[0]]=2;
    expect(()=>auditAppwriteSourceWriteFreeze(duplicate)).toThrow(/duplicate/);
  });
  it('refuses missing or duplicate full table grants and incomplete Function inventory',()=>{
    const missing=fixture();missing.tableGrants.pop();
    expect(()=>auditAppwriteSourceWriteFreeze(missing)).toThrow(/missing private personal table/);
    const duplicate=fixture();duplicate.tableGrants[1].id=duplicate.tableGrants[0].id;
    expect(()=>auditAppwriteSourceWriteFreeze(duplicate)).toThrow(/duplicated/);
    const functions=fixture();functions.functionGrants.pop();
    expect(()=>auditAppwriteSourceWriteFreeze(functions))
      .toThrow(/incomplete privileged Function inventory/);
  });
  it('requires valid signed owner account 403 denial of every create/update/delete path',()=>{
    const missing=fixture();missing.signedOldClientDenials.pop();
    expect(()=>auditAppwriteSourceWriteFreeze(missing)).toThrow(/incomplete signed old-client/);
    const unauthorized=fixture();unauthorized.signedOldClientDenials[0].httpStatus=401 as never;
    expect(()=>auditAppwriteSourceWriteFreeze(unauthorized)).toThrow(/missing authentic owner/);
    const spoofed=fixture();spoofed.signedOldClientDenials[0].ownerId='other';
    expect(()=>auditAppwriteSourceWriteFreeze(spoofed)).toThrow(/missing authentic owner/);
    const duplicate=fixture();duplicate.signedOldClientDenials.push(
      {...duplicate.signedOldClientDenials[0]});
    expect(()=>auditAppwriteSourceWriteFreeze(duplicate)).toThrow(/missing authentic owner/);
  });
  it('rejects source deployment, generation, expiration and bad privilege syntax',()=>{
    const wrong=fixture();wrong.sourceDeploymentId='https://unreviewed.example/v1|another|database';
    expect(()=>auditAppwriteSourceWriteFreeze(wrong)).toThrow(/source Appwrite endpoint/);
    const stale=fixture();stale.expiresAt='2000-01-01T00:00:00Z';
    expect(()=>auditAppwriteSourceWriteFreeze(stale)).toThrow(/missing owner/);
    const gen=fixture();gen.signedOldClientDenials[2].generation='previous';
    expect(()=>auditAppwriteSourceWriteFreeze(gen)).toThrow(/wrong generation/);
    const malformed=fixture();malformed.tableGrants[0].permissions=['create users'];
    expect(()=>auditAppwriteSourceWriteFreeze(malformed)).toThrow(/unreviewed/);
  });
  it('returns stable operator metadata digest when supplied inventories are reordered',()=>{
    const x=fixture(),y=fixture();
    y.tableGrants.reverse();
    y.functionGrants.reverse();
    y.signedOldClientDenials.reverse();
    expect(auditAppwriteSourceWriteFreeze(x).inspectedMetadataSha256)
      .toBe(auditAppwriteSourceWriteFreeze(y).inspectedMetadataSha256);
  });
});
