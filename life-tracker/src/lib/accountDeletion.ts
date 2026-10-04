import { sendMessageAction } from './messageDelivery';

export interface AccountDeletionRequestState {
  accepted: boolean;
  deletionPending: true;
}

export async function requestAccountDeletion(
  confirmation: string
): Promise<AccountDeletionRequestState> {
  if (confirmation !== 'DELETE') {
    throw new Error('Type DELETE to confirm account deletion.');
  }

  const response = await sendMessageAction({
    action: 'delete_account',
    confirmation,
  });
  if (response.deletionPending !== true) {
    throw new Error('Account deletion request was not retained. Try again.');
  }

  return {
    accepted: response.accepted === true,
    deletionPending: true,
  };
}
