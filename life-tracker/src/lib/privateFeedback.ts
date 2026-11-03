import { sendAppAction } from './appAction';
import { collectBugReportDiagnostics, newBugReportRequestId } from './bugReports';

export type FeedbackKind = 'idea' | 'experience' | 'other';

export const FEEDBACK_KINDS: Readonly<Record<FeedbackKind, string>> = {
  idea: 'Suggestion',
  experience: 'Experience',
  other: 'Other feedback',
};

export const newFeedbackRequestId = newBugReportRequestId;
export const collectFeedbackDiagnostics = collectBugReportDiagnostics;

// Reuse the authenticated private inbox, not the public GitHub publishing action.
// The title prefix lets the operator distinguish general feedback from bug reports.
export async function submitPrivateFeedback(
  kind: FeedbackKind,
  message: string,
  requestId: string,
  diagnostics?: Record<string, string>,
): Promise<{ reference: string }> {
  const description = message.trim();
  if (!(kind in FEEDBACK_KINDS) || !description || description.length > 3000 ||
      !/^[a-f0-9]{32}$/.test(requestId)) {
    throw new Error('Invalid feedback');
  }
  const result = await sendAppAction({
    action: 'submit_bug_report',
    requestId,
    title: '[Feedback] ' + FEEDBACK_KINDS[kind],
    description,
    steps: '',
    ...(diagnostics ? { diagnostics } : {}),
  });
  if (typeof result.reportId !== 'string' || !/^bug_[a-f0-9]{32}$/.test(result.reportId)) {
    throw new Error('Feedback confirmation unavailable');
  }
  return { reference: result.reportId };
}
