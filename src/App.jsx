import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef(null);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    const botMessage = { sender: 'bot', text: '' };
    setMessages((prev) => [...prev, botMessage]);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('https://llama-chatbot-backend.onrender.com/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Cleanly handle JSON streamed as: {"response": "..."}
        try {
          const jsonChunk = JSON.parse(chunk);
          fullText += jsonChunk.response || '';
        } catch {
          fullText += chunk;
        }

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { sender: 'bot', text: fullText };
          return updated;
        });
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessages((prev) => [...prev, { sender: 'system', text: '⚠️ Response generation stopped by user.' }]);
      } else {
        setMessages((prev) => [...prev, { sender: 'system', text: '❌ Error occurred while generating response.' }]);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0d1117', color: 'white', padding: '2rem' }}>
      <h1 style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '2rem' }}>🦙 LlamaBot</h1>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
      <input
  style={{
    flex: 1,
    padding: '1rem',
    borderRadius: '8px',
    border: '1px solid #30363d',
    backgroundColor: '#161b22',
    color: 'white'
  }}
  value={input}
  onChange={(e) => setInput(e.target.value)}
  placeholder="Ask something..."
  disabled={isGenerating}
  onKeyDown={(e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }}
/>
        <button onClick={handleSend} disabled={isGenerating} style={{ padding: '0 1.5rem' }}>Send</button>
        <button onClick={handleStop} disabled={!isGenerating}>Stop</button>
      </div>

      {isGenerating && <p style={{ marginBottom: '1rem' }}>🤖 Thinking...</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
            backgroundColor: msg.sender === 'user' ? '#238636' : msg.sender === 'bot' ? '#1c1f24' : '#444c56',
            padding: '1rem',
            borderRadius: '10px',
            maxWidth: '90%',
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            position: 'relative'
          }}>
            <ReactMarkdown
              children={msg.text}
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const codeText = String(children).trim();
                  if (!inline) {
                    return (
                      <div style={{ position: 'relative', marginTop: '1rem' }}>
                        <pre style={{ backgroundColor: '#161b22', padding: '1rem', borderRadius: '8px', overflowX: 'auto' }}>
                          <code className={className} {...props}>{codeText}</code>
                        </pre>
                        <button
                          onClick={() => copyToClipboard(codeText)}
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            backgroundColor: '#30363d',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >Copy</button>
                      </div>
                    );
                  }
                  return (
                    <code style={{ backgroundColor: '#30363d', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace' }} {...props}>
                      {codeText}
                    </code>
                  );
                }
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
