import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const MAX_MESSAGE_LENGTH = 1000;

export default function ChatWidget() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I can help you sort, prepare, and safely recycle household items. What would you like to know?',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryRequest, setRetryRequest] = useState(null);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading, error, open]);

  async function requestReply(request) {
    if (!token) {
      setError('Please log in before using the recycling assistant.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api.chatbot(token, request.message, request.history);
      setMessages((current) => [...current, { role: 'assistant', content: result.reply }]);
      setRetryRequest(null);
    } catch (requestError) {
      setError(requestError.message || 'The assistant could not respond. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function sendMessage(event) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || loading) return;

    const history = messages
      .slice(1)
      .slice(-10)
      .map(({ role, content }) => ({ role, content }));
    const request = { message, history };
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setDraft('');
    setRetryRequest(request);
    requestReply(request);
  }

  return (
    <div className="chat-widget">
      {open && (
        <section className="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title">
          <header className="chat-header">
                <div className="chat-header-mark" aria-hidden="true">🤖</div>            <div className="chat-header-copy">
              <h2 id="chat-title">AI Recycling Assistant</h2>
              <p>Friendly tips for a greener home</p>
            </div>
            <button
              className="chat-close"
              type="button"
              aria-label="Close recycling assistant"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>

          <div className="chat-messages" role="log" aria-live="polite" aria-relevant="additions text">
            {messages.map((item, index) => (
              <div className={`chat-message chat-message-${item.role}`} key={`${item.role}-${index}`}>
              {item.role === 'assistant' && <span className="chat-avatar" aria-hidden="true">🤖</span>}                <p>{item.content}</p>
              </div>
            ))}
            {loading && (
              <div className="chat-message chat-message-assistant" role="status" aria-label="Assistant is responding">
<span className="chat-avatar" aria-hidden="true">🤖</span>                <p className="chat-typing"><span /><span /><span /></p>
              </div>
            )}
            {error && (
              <div className="chat-error" role="alert">
                <p>{error}</p>
                {retryRequest && (
                  <button
                    className="chat-retry"
                    type="button"
                    disabled={loading}
                    onClick={() => requestReply(retryRequest)}
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-form" onSubmit={sendMessage}>
            <label className="chat-sr-only" htmlFor="chat-message">Ask a recycling question</label>
            <input
              id="chat-message"
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about recycling..."
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={loading}
            />
            <button className="chat-send" type="submit" disabled={loading || !draft.trim()}>
              Send
            </button>
          </form>
          <p className="chat-note">Recycling rules can vary by location.</p>
        </section>
      )}

      <button
        className="chat-launcher"
        type="button"
        aria-label={open ? 'Close AI Recycling Assistant' : 'Open AI Recycling Assistant'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
{open ? <span aria-hidden="true">×</span> : <span aria-hidden="true">🤖</span>}      </button>
    </div>
  );
}
