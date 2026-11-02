import { DEMO_OWNER } from './fixtures';
import type { UseMyProfileReturn } from '../hooks/useMyProfile';
const profile:NonNullable<UseMyProfileReturn['profile']>={
 $id:'demo_profile',user_id:DEMO_OWNER,username:'demo',
 display_name:'Demo User',avatar_file_id:'',bio:'Fictional Mosaic profile',
 is_searchable:false,
};
export function useMyProfile():UseMyProfileReturn{
 return {profile,isLoading:false,error:null,
 createProfile:async()=>null,refetch:async()=>{},checkUsername:async()=>null};
}
