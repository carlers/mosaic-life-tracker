import { sendMessageAction } from './messageDelivery';

export interface AccountDeletionAccepted {
  accepted: true;
  deletionPending: true;
}

export async function requestAccountDeletion(
  confirmation: string
): Promise<AccountDeletionAccepted> {
  if (confirmation !== 'DELETE') {
    throw new Error('Type DELETE to confirm account deletion.');
  }
  const response = await sendMessageAction({
    action: 'delete_account',
    confirmation,
  });
  if (response.accepted !== true || response.deletionPending !== true) {
    throw new Error('Account deletion was not accepted. Try again.');
  }
  return {
    accepted: true,
    deletionPending: true,
  };
}
