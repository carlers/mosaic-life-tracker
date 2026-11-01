/** Genuine Mosaic auth context, fictional user. Never contacts Appwrite. */
import type { ReactNode } from 'react';
import { AuthContext, type AuthContextValue } from '../hooks/authContext';
import { DEMO_OWNER } from './fixtures';
const denied=async()=>false;
const user={
 $id:DEMO_OWNER,name:'Demo User',email:'demo@example.invalid',prefs:{},
 emailVerification:false,phoneVerification:false,status:true,labels:[],
 registration:'2026-01-01T00:00:00.000Z',
} as unknown as NonNullable<AuthContextValue['user']>;
const value:AuthContextValue={
 user,isLoading:false,error:null,recoveryLoading:false,recoveryError:null,
 recoverySuccess:null,isOffline:false,pendingSignup:null,
 login:denied,signup:denied,logout:denied,deleteAccount:denied,
 requestPasswordRecovery:denied,completePasswordRecovery:denied,
 updateEmail:denied,updatePassword:denied,retry:async()=>{},
};
export function DemoAuthProvider({children}:{children:ReactNode}){
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
