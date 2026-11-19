import { useState, useRef, useEffect } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { Bot, X, Send, Sparkles } from 'lucide-react'

interface Message {
  id: string
  sender: 'bot' | 'user'
  text: string
  time: string
}

const FAQ_KNOWLEDGE: Array<{ keywords: string[]; answer: string }> = [
  {
    keywords: ['date', 'when', 'schedule', 'timeline', 'release', 'problem', 'statement', '26'],
    answer: 'Problem statements will be officially released on 26 November 2026 across all 5 challenge domains! The online preliminary round runs through December, and the offline Grand Finale takes place on 2–3 January 2027.',
  },
  {
    keywords: ['team', 'member', 'size', 'solo', 'individual', 'join'],
    answer: 'Teams must consist of 2 to 5 student members. You can register individually and then either create your own squad (with an auto-generated join code) or join an existing team in the Student Dashboard.',
  },
  {
    keywords: ['domain', 'track', 'agriculture', 'defense', 'cyber', 'space', 'robotics'],
    answer: 'AICUXORA 2027 features five frontier domains: 1) Agriculture (Smart farming & IoT), 2) Defense (Mission-critical resilience), 3) Cybersecurity (Zero-trust defense), 4) Space Technology (Satellite & telemetry), and 5) Robotics (Autonomous locomotion & vision).',
  },
  {
    keywords: ['prize', 'reward', 'cash', 'money', 'voucher', 'laptop'],
    answer: 'Total rewards include ₹10,00,000 Cash + Microsoft Gift Vouchers + 3 High-Performance Laptops and exciting tech gifts for winning teams!',
  },
  {
    keywords: ['fee', 'payment', 'cost', 'free', 'price'],
    answer: 'Participation is for verified college/university students. The local demonstration mode collects zero fee, while official final fee details will be announced before registration closes in late November.',
  },
  {
    keywords: ['venue', 'location', 'where', 'offline', 'online'],
    answer: 'AICUXORA 2027 is a hybrid event: the preliminary round is conducted 100% online, and shortlisted finalist teams attend the offline Grand Finale on 2–3 January 2027 (venue to be officially announced).',
  },
  {
    keywords: ['submission', 'github', 'demo', 'video', 'pdf'],
    answer: 'Submissions will open after problem statements release on 26 November 2026. Teams will submit GitHub repository links, architecture decks, and video demonstration links via the Student Submissions portal.',
  },
]

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Hello! I am the AICUXORA AI Assistant. Ask me anything about problem statements (releasing 26 Nov), team rules, domains, or the ₹10 Lakhs prize pool!',
      time: 'Just now',
    },
  ])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
    }
  }, [messages, isOpen])

  const handleSend = (textToSend?: string) => {
    const query = (textToSend || input).trim()
    if (!query) return

    const userMsg: Message = {
      id: String(Date.now()),
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages(prev => [...prev, userMsg])
    if (!textToSend) setInput('')

    // Generate intelligent match
    const lower = query.toLowerCase()
    let botReply = "Thank you for asking! For specific details on team formation, browse the 'Community' page or sign in to your Student Dashboard. Official problem statements publish on 26 November 2026."

    for (const item of FAQ_KNOWLEDGE) {
      if (item.keywords.some(k => lower.includes(k))) {
        botReply = item.answer
        break
      }
    }

    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'bot',
          text: botReply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    }, 450)
  }

  const quickPrompts = [
    'When do problem statements release?',
    'What are the team size rules?',
    'What are the prizes and rewards?',
    'What are the 5 challenge domains?',
  ]

  return (
    <div className="floating-chatbot-container">
      <AnimatePresence>
        {isOpen && (
          <m.div
            className="chatbot-window"
            initial={{ opacity: 0, y: 20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.92 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            role="dialog"
            aria-label="AICUXORA Chatbot Assistant"
          >
            {/* Header */}
            <div className="chatbot-header">
              <div className="chatbot-header-info">
                <span className="chatbot-avatar">
                  <Bot size={18} />
                </span>
                <div>
                  <h4>AICUXORA Assistant</h4>
                  <small className="online-indicator">
                    <span className="online-dot" /> Online · 24/7 Support
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="chatbot-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close Chatbot"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Chips */}
            <div className="chatbot-chips-bar">
              {quickPrompts.map(prompt => (
                <button
                  key={prompt}
                  type="button"
                  className="chatbot-chip"
                  onClick={() => handleSend(prompt)}
                >
                  <Sparkles size={11} /> {prompt}
                </button>
              ))}
            </div>

            {/* Message Area */}
            <div className="chatbot-messages">
              {messages.map(m => (
                <div
                  key={m.id}
                  className={`chat-bubble-row ${m.sender === 'user' ? 'user-row' : 'bot-row'}`}
                >
                  {m.sender === 'bot' && (
                    <span className="chat-bubble-icon">
                      <Bot size={14} />
                    </span>
                  )}
                  <div className={`chat-bubble ${m.sender === 'user' ? 'user-bubble' : 'bot-bubble'}`}>
                    <p>{m.text}</p>
                    <span className="chat-time">{m.time}</span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <form
              className="chatbot-input-row"
              onSubmit={e => {
                e.preventDefault()
                handleSend()
              }}
            >
              <input
                type="text"
                placeholder="Ask about rules, dates, tracks, prizes..."
                value={input}
                onChange={e => setInput(e.target.value)}
                aria-label="Type your message"
              />
              <button type="submit" className="chatbot-send-btn" aria-label="Send message">
                <Send size={15} />
              </button>
            </form>
          </m.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle Button */}
      <button
        type="button"
        className={`floating-chatbot-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close AICUXORA Assistant' : 'Open AICUXORA Assistant'}
      >
        <span className="pulse-beacon" />
        {isOpen ? <X size={22} /> : <Bot size={24} />}
        {!isOpen && <span className="chatbot-trigger-label">Ask AICUXORA</span>}
      </button>
    </div>
  )
}
