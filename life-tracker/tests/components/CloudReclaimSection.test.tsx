import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudReclaimSection } from '../../src/components/settings/CloudReclaimSection';

const actions=vi.hoisted(()=>({send:vi.fn()}));
vi.mock('../../src/lib/appAction',()=>({sendAppAction:actions.send}));
const fileId='img_'+'a'.repeat(32);
const candidate={fileId,bytes:1050,purpose:'tasks',state:'verified'};

beforeEach(()=>{
  actions.send.mockReset();
  actions.send.mockImplementation(async(payload:{action:string})=>{
    switch(payload.action){
      case 'list_reclaimable_media': return{candidates:[candidate],hasMore:false};
      case 'request_owner_media_cleanup':return{fileId,confirmationToken:'b'.repeat(64),notBefore:'2000-01-01T00:00:00.000Z'};
      case 'confirm_owner_media_cleanup':return{fileId,status:'deleted'};
      default:throw Error('Unexpected action');
    }
  });
});

describe('owner-confirmed cloud photo reclamation',()=>{
  it('does not contact backend or delete anything until user initiates a scan',()=>{
    render(<CloudReclaimSection ownerId="owner1"/>);
    expect(screen.getByText('Unused cloud photos')).toBeTruthy();
    expect(screen.getByText(/Offline devices or restored backups can/)).toBeTruthy();
    expect(actions.send).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete permanently')).toBeNull();
  });
  it('requires scan and a second explicit confirmation before calling the destructive action',async()=>{
    render(<CloudReclaimSection ownerId="owner1"/>);
    fireEvent.click(screen.getByRole('button',{name:'Find unused uploads'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'Review deletion'})).toBeTruthy());
    expect(actions.send).toHaveBeenCalledWith({action:'list_reclaimable_media'},45_000);
    fireEvent.click(screen.getByRole('button',{name:'Review deletion'}));
    await waitFor(()=>expect(screen.getByText('Permanently delete this cloud photo?')).toBeTruthy());
    expect(actions.send).toHaveBeenCalledWith({
      action:'request_owner_media_cleanup',fileId,confirmIntent:true,
    },45_000);
    expect(actions.send.mock.calls.map(([p])=>p.action)).not.toContain('confirm_owner_media_cleanup');
    await waitFor(()=>expect(screen.getByRole('button',{name:'Delete permanently'}).hasAttribute('disabled')).toBe(false),{timeout:2000});
    fireEvent.click(screen.getByRole('button',{name:'Delete permanently'}));
    await waitFor(()=>expect(screen.getByText(/Cloud file deleted\. No synced references were found/)).toBeTruthy());
    expect(actions.send).toHaveBeenCalledWith({
      action:'confirm_owner_media_cleanup',fileId,confirmationToken:'b'.repeat(64),
    },45_000);
  });
  it('rejects malformed list results instead of displaying unsafe controls',async()=>{
    actions.send.mockResolvedValueOnce({candidates:[{...candidate,fileId:'bad-file'}]});
    render(<CloudReclaimSection ownerId="owner1"/>);
    fireEvent.click(screen.getByRole('button',{name:'Find unused uploads'}));
    await waitFor(()=>expect(screen.getByText(/could not be checked/)).toBeTruthy());
    expect(screen.queryByRole('button',{name:'Review deletion'})).toBeNull();
  });
});
