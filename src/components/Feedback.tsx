import type { FeedbackMessage } from '../types';

interface FeedbackProps {
  message: FeedbackMessage | null;
}

export default function Feedback({ message }: FeedbackProps) {
  if (!message) return null;
  return (
    <div
      className={`feedback ${message.ok ? 'feedback-success' : 'feedback-error'}`}
    >
      {message.ok ? '✅ ' : '⚠️ '}
      {message.msg}
    </div>
  );
}
