import { useForm } from 'react-hook-form';
import './GroupComments.css';

export interface Comment {
  id: string;
  authorAddress: string;
  authorName?: string;
  content: string;
  timestamp: Date;
  deleted?: boolean;
}

export interface GroupCommentsProps {
  groupId: string;
  comments: Comment[];
  currentUserAddress?: string;
  creatorAddress?: string;
  onPost: (content: string) => void;
  onDelete?: (commentId: string) => void;
}

/** Minimal markdown: bold, italic, inline code, line breaks */
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />');
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

interface CommentFormValues {
  content: string;
}

const MAX_LENGTH = 500;

// See src/components/FORMS.md for the react-hook-form conventions used here.
export function GroupComments({
  comments,
  currentUserAddress,
  creatorAddress,
  onPost,
  onDelete,
}: GroupCommentsProps) {
  const { register, handleSubmit, watch, reset } = useForm<CommentFormValues>({
    defaultValues: { content: '' },
  });
  const draft = watch('content');

  const onValid = ({ content }: CommentFormValues) => {
    const trimmed = content.trim();
    if (!trimmed || !currentUserAddress) return;
    onPost(trimmed);
    reset({ content: '' });
  };

  const canModerate = (comment: Comment) =>
    onDelete &&
    (currentUserAddress === creatorAddress || currentUserAddress === comment.authorAddress);

  const visibleComments = comments.filter((c) => !c.deleted);

  return (
    <section className="group-comments" aria-label="Group comments">
      <h3 className="group-comments-title">
        Comments <span className="group-comments-count">({visibleComments.length})</span>
      </h3>

      <ul className="group-comments-list" aria-label="Comment list">
        {visibleComments.length === 0 && (
          <li className="group-comments-empty">No comments yet. Be the first to say something!</li>
        )}
        {visibleComments.map((comment) => (
          <li key={comment.id} className="group-comment" data-testid={`comment-${comment.id}`}>
            <div className="group-comment-meta">
              <span className="group-comment-author">
                {comment.authorName ?? shortAddress(comment.authorAddress)}
                {comment.authorAddress === creatorAddress && (
                  <span className="group-comment-creator-badge" title="Group creator">
                    {' '}
                    👑
                  </span>
                )}
              </span>
              <time className="group-comment-time" dateTime={comment.timestamp.toISOString()}>
                {formatTimestamp(comment.timestamp)}
              </time>
            </div>
            <div
              className="group-comment-content"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{
                __html: renderMarkdown(comment.content),
              }}
            />
            {canModerate(comment) && (
              <button
                className="group-comment-delete"
                onClick={() => onDelete!(comment.id)}
                aria-label={`Delete comment by ${comment.authorName ?? shortAddress(comment.authorAddress)}`}
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>

      {currentUserAddress ? (
        <form
          className="group-comments-form"
          onSubmit={handleSubmit(onValid)}
          aria-label="Post a comment"
        >
          <textarea
            className="group-comments-input"
            {...register('content')}
            placeholder="Write a comment… (supports **bold**, *italic*, `code`)"
            maxLength={MAX_LENGTH}
            rows={3}
            aria-label="Comment text"
          />
          <div className="group-comments-form-footer">
            <span className="group-comments-char-count">
              {draft.length}/{MAX_LENGTH}
            </span>
            <button
              type="submit"
              className="group-comments-submit"
              disabled={!draft.trim()}
              aria-label="Post comment"
            >
              Post
            </button>
          </div>
        </form>
      ) : (
        <p className="group-comments-login-prompt">Connect your wallet to leave a comment.</p>
      )}
    </section>
  );
}
