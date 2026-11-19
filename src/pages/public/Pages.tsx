import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { m } from 'framer-motion'
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  Cpu,
  Crosshair,
  Lightbulb,
  LockKeyhole,
  Mail,
  Orbit,
  Radio,
  ShieldCheck,
  Sparkles,
  Sprout,
  Users,
  Wifi,
  Bell,
  Clock,
  X,
  ExternalLink,
  FileText,
  Gift,
  Award,
  Laptop
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { SectionHeading } from '../../components/shared/SectionHeading'
import { useAuth } from '../../auth/AuthContext'
import { api } from '../../lib/api'

const domains = [
  {
    icon: Sprout,
    image: '/assets/domains/agriculture.svg',
    number: '01',
    title: 'Agriculture',
    text: 'Build solutions for sustainable farming, food security, precision agriculture and rural innovation.',
    tags: ['Precision Agri', 'Food Security', 'Soil Tech', 'Rural IoT'],
    color: 'green',
    deepDescription: 'Tackle the climate and supply challenges of our food systems. Design smart sensors, autonomous irrigation models, automated disease diagnostics, and farmer-to-market transparent distribution tools.'
  },
  {
    icon: Crosshair,
    image: '/assets/domains/defense.svg',
    number: '02',
    title: 'Defense',
    text: 'Explore technology for security, resilience, intelligence and mission-critical systems within lawful and ethical boundaries.',
    tags: ['System Resilience', 'Tactical Comms', 'Critical Infrastructure', 'Signal Intelligence'],
    color: 'blue',
    deepDescription: 'Address mission-critical challenges in secure communications, situational awareness, disaster mitigation telemetry, and defense-grade infrastructure robustness.'
  },
  {
    icon: ShieldCheck,
    image: '/assets/domains/cybersecurity.svg',
    number: '03',
    title: 'Cybersecurity',
    text: 'Develop solutions to protect digital systems, identities, data and critical infrastructure.',
    tags: ['Zero Trust', 'Identity Defense', 'Cloud Security', 'Threat Hunting'],
    color: 'pink',
    deepDescription: 'Create innovative defense paradigms against sophisticated cyber threats. Explore quantum-resistant cryptography, automated patch validation, and threat intelligence synthesis.'
  },
  {
    icon: Orbit,
    image: '/assets/domains/space-tech.svg',
    number: '04',
    title: 'Space Technology',
    text: 'Build technologies for space exploration, satellite applications and Earth observation.',
    tags: ['Earth Observation', 'Satellite Telemetry', 'Payload Sim', 'Orbital Mechanics'],
    color: 'yellow',
    deepDescription: 'Leverage synthetic aperture radar, satellite remote sensing, ground-station analytics, and deep space payload instrumentation to address challenges on Earth and in orbit.'
  },
  {
    icon: Bot,
    image: '/assets/domains/robotics.svg',
    number: '05',
    title: 'Robotics',
    text: 'Develop intelligent automation, assistive robotics and next-generation robotic systems.',
    tags: ['Autonomous Navigation', 'Assistive Tech', 'Computer Vision', 'ROS Control'],
    color: 'blue',
    deepDescription: 'Bridge hardware and software intelligence. Engineer robotic locomotion, precision grippers, computer vision-guided sorting, and assistive devices for elderly and disabled individuals.'
  },
]

const milestones = [
  { date: '26 November 2026', status: 'Confirmed', title: 'Problem statements release', description: 'Explore the official challenge briefs across all five domains.' },
  { date: 'Last week of November 2026', status: 'Exact date to be announced', title: 'Registration closes', description: 'Registration fee and payment gateway are not finalized; deadlines will be announced.' },
  { date: 'December 2026', status: 'Detailed schedule to be announced', title: 'Online preliminary round', description: 'Teams build solutions and submit preliminary deliverables remotely.' },
  { date: 'By end of December 2026', status: 'Target announced', title: 'Finalists announced', description: 'Selected finalist teams will be notified before the in-person finale.' },
  { date: '2–3 January 2027', status: 'Confirmed dates', title: 'Offline grand finale', description: 'Selected teams compete in-person. Venue to be announced.' },
]

const faqs = [
  ['Who can participate in AICUXORA 2027?', 'College and university students from recognized institutions. Official eligibility guidelines will be published along with the problem briefs.'],
  ['What are the team size rules?', 'Teams must have a minimum of 2 participants and a maximum of 5 participants. Both individual interest registration and team collaboration are supported in the platform.'],
  ['What is the event format?', 'AICUXORA 2027 features an online preliminary round where teams build and submit their projects remotely, followed by an offline grand finale for shortlisted finalists on 2–3 January 2027.'],
  ['When are the problem statements released?', 'Problem statements release officially on 26 November 2026 across all five challenge domains.'],
  ['When does registration close?', 'Registration closes in the last week of November 2026. The exact final date will be communicated through the portal.'],
  ['Where will the offline grand finale take place?', 'The offline grand finale will take place on 2–3 January 2027. Venue is not finalized and will be officially announced.'],
  ['Is there a registration fee?', 'Registration fee is paid, but the exact amount is not finalized. No payment is collected in this local demonstration.'],
  ['What prizes are offered?', 'Total Rewards: ₹10,00,000 Cash + Microsoft Gift Vouchers + Exciting Gifts (including three laptops and cash prizes). All rewards are subject to official confirmation.'],
  ['How are projects evaluated?', 'Evaluation focuses on problem understanding, innovation, technical execution, impact, and teamwork. Official rubric and weights will be released prior to the judging round.'],
]

export interface Partner {
  id: string
  name: string
  role: string
  category: string
  logo: string
  description: string
  contribution: string
  website: string
}

const partners: Partner[] = [
  {
    id: 'incux-ai',
    name: 'IncuX AI',
    role: 'Primary Host & Platform Organizer',
    category: 'Host',
    logo: '/assets/partners/incux-ai.svg',
    description: 'Pioneering applied AI platforms, student hackathons, and technical frameworks.',
    contribution: 'Overall platform development, problem statement crafting, jury facilitation, and offline grand finale operations.',
    website: 'https://incux.ai',
  },
  {
    id: 'microsoft',
    name: 'Microsoft for Startups',
    role: 'Cloud & Technology Partner',
    category: 'Technology',
    logo: '/assets/partners/microsoft.svg',
    description: 'Empowering future founders and engineering talent with Azure AI infrastructure.',
    contribution: 'Azure AI cloud access, Microsoft Gift Vouchers, technical workshop mentors, and finalist judging.',
    website: 'https://startups.microsoft.com',
  },
  {
    id: 'github',
    name: 'GitHub',
    role: 'Developer Ecosystem Partner',
    category: 'Ecosystem',
    logo: '/assets/partners/github.svg',
    description: 'The world\'s premier developer platform powering open-source and modern software development.',
    contribution: 'Developer tools, GitHub Copilot student perks, and automated repository submission tracking.',
    website: 'https://github.com',
  },
  {
    id: 'google',
    name: 'Google for Developers',
    role: 'Innovation & AI Partner',
    category: 'Innovation',
    logo: '/assets/partners/google.svg',
    description: 'Connecting communities with Google developer tools, Gemini APIs, and cloud resources.',
    contribution: 'Gemini API workshops, developer tech talks, and community outreach across engineering institutions.',
    website: 'https://developers.google.com',
  },
  {
    id: 'aws',
    name: 'AWS Activate',
    role: 'Cloud Infrastructure Partner',
    category: 'Cloud',
    logo: '/assets/partners/aws.svg',
    description: 'Providing scalable cloud compute and serverless solutions for student builders.',
    contribution: 'AWS Activate infrastructure support, compute credits for top performers, and cloud architecture reviews.',
    website: 'https://aws.amazon.com/activate/',
  },
  {
    id: 'ieee',
    name: 'IEEE Student Branch',
    role: 'Academic & Outreach Partner',
    category: 'Academic',
    logo: '/assets/partners/ieee.svg',
    description: 'Advancing technological innovation and excellence for the benefit of humanity.',
    contribution: 'Academic student branch coordination, research rubric validation, and nationwide campus publicity.',
    website: 'https://www.ieee.org',
  },
]

export function CountdownWidget() {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const targetDate = new Date('2026-11-26T00:00:00+05:30').getTime()
    const updateCountdown = () => {
      const now = Date.now()
      const difference = targetDate - now
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }
      const days = Math.floor(difference / (1000 * 60 * 60 * 24))
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((difference / 1000 / 60) % 60)
      const seconds = Math.floor((difference / 1000) % 60)
      setTimeLeft({ days, hours, minutes, seconds })
    }
    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="countdown-widget" aria-label="Countdown to Problem Statements Release">
      <div className="countdown-pill-header">
        <Clock size={13} className="text-emerald-400" />
        <span>PROBLEM STATEMENTS RELEASE · 26 NOV 2026</span>
      </div>
      <div className="countdown-grid">
        <div className="time-block">
          <strong>{String(timeLeft.days).padStart(2, '0')}</strong>
          <small>DAYS</small>
        </div>
        <span className="time-divider">:</span>
        <div className="time-block">
          <strong>{String(timeLeft.hours).padStart(2, '0')}</strong>
          <small>HOURS</small>
        </div>
        <span className="time-divider">:</span>
        <div className="time-block">
          <strong>{String(timeLeft.minutes).padStart(2, '0')}</strong>
          <small>MINS</small>
        </div>
        <span className="time-divider">:</span>
        <div className="time-block">
          <strong>{String(timeLeft.seconds).padStart(2, '0')}</strong>
          <small>SECS</small>
        </div>
      </div>
    </div>
  )
}

export function PageIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <section className="page-intro container"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="intro-copy">{text}</p></section>
}

export function DomainCards({ compact = false, onSelectDomain }: { compact?: boolean; onSelectDomain?: (domain: typeof domains[0]) => void }) {
  return (
    <div className="track-grid domain-grid">
      {(compact ? domains.slice(0, 3) : domains).map((d, index) => {
        const Icon = d.icon
        return (
          <m.div
            key={d.title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
          >
            <Card className={'track-card domain-card domain-' + d.color}>
              <div className="domain-card-media">
                <img src={d.image} alt={d.title} className="domain-media-img" loading="lazy" />
                <div className="domain-media-overlay" />
                <div className="domain-media-badges">
                  <span className="icon-tile"><Icon size={19} aria-hidden="true" /></span>
                  <span className="track-number">{d.number}</span>
                </div>
              </div>
              <div className="domain-card-content">
                <h3>{d.title}</h3>
                <p className="muted">{d.text}</p>
                <div className="tags">
                  {d.tags.map(tag => <span key={tag}>{tag}</span>)}
                </div>
                <div className="domain-card-actions">
                  {onSelectDomain ? (
                    <button
                      type="button"
                      className="domain-learn-btn"
                      onClick={() => onSelectDomain(d)}
                    >
                      Learn more <ArrowRight size={13} />
                    </button>
                  ) : (
                    <Link to="/explore" className="domain-learn-btn">
                      Explore hackathons <ArrowRight size={13} />
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          </m.div>
        )
      })}
    </div>
  )
}

export function TimelineList() {
  return (
    <ol className="timeline-list event-timeline">
      {milestones.map((item, index) => (
        <li className="timeline-item" key={item.title}>
          <span className="timeline-number">{String(index + 1).padStart(2, '0')}</span>
          <div className="timeline-detail">
            <span className="timeline-date">{item.date} · {item.status}</span>
            <h3>{item.title}</h3>
            <p className="muted">{item.description}</p>
          </div>
          <ArrowUpRight size={18} className="timeline-arrow" aria-hidden="true" />
        </li>
      ))}
    </ol>
  )
}

export function FaqItems({ limit }: { limit?: number }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="faq-list">
      {faqs.slice(0, limit).map(([question, answer], index) => (
        <div className={'faq-item ' + (open === index ? 'faq-open' : '')} key={question}>
          <button
            className="faq-question"
            aria-expanded={open === index}
            onClick={() => setOpen(open === index ? null : index)}
          >
            {question}
            <ChevronDown size={18} aria-hidden="true" />
          </button>
          {open === index && <p className="faq-answer">{answer}</p>}
        </div>
      ))}
    </div>
  )
}

export function DemoStatsStrip() {
  return (
    <div className="demo-stats-strip">
      <div className="demo-stat-col">
        <span className="stat-label">CHALLENGE TRACKS</span>
        <strong className="stat-value">5 Domains</strong>
        <small className="stat-note">Agriculture · Defense · Cyber · Space · Robotics</small>
      </div>
      <div className="demo-stat-col">
        <span className="stat-label">TOTAL REWARDS</span>
        <strong className="stat-value text-emerald-400">₹10,00,000+</strong>
        <small className="stat-note text-amber-300">Cash + Vouchers + Laptops</small>
      </div>
      <div className="demo-stat-col">
        <span className="stat-label">TEAM REQUIREMENTS</span>
        <strong className="stat-value">2–5 Members</strong>
        <small className="stat-note">Multi-disciplinary student squads</small>
      </div>
      <div className="demo-stat-col">
        <span className="stat-label">PROBLEM STATEMENTS</span>
        <strong className="stat-value text-sky-400">26 Nov 2026</strong>
        <small className="stat-note">Official briefs release date</small>
      </div>
    </div>
  )
}

// 8-STAGE CONNECTED INTERACTIVE TIMELINE (plan.md §4)
export function ConnectedJourneyTimeline() {
  const stages = [
    { num: '01', title: 'Registration', desc: 'Create your individual account and verify your student eligibility.' },
    { num: '02', title: 'Domain Selection', desc: 'Choose from Agriculture, Defense, Cyber, Space Technology, or Robotics.' },
    { num: '03', title: 'Problem Release', desc: 'Challenge statements publish on 26 Nov 2026 with detailed briefs.' },
    { num: '04', title: 'Team Formation', desc: 'Assemble 2–5 members or find peers via community invite codes.' },
    { num: '05', title: 'Development Phase', desc: 'Teams collaborate in Team Workspace to engineer functional prototypes.' },
    { num: '06', title: 'Submission', desc: 'Submit GitHub repos, architecture pitch decks, and demo video URLs.' },
    { num: '07', title: 'Evaluation', desc: 'Mentors and judges assess submissions on innovation, impact & tech execution.' },
    { num: '08', title: 'Results & Rewards', desc: 'Shortlisted finalists battle offline on 2–3 Jan 2027 for ₹10L+ in prizes!' },
  ]

  return (
    <div className="connected-timeline-container">
      <div className="connected-timeline-grid">
        {stages.map((stage, idx) => (
          <m.div
            key={stage.num}
            className="connected-stage-card"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.35, delay: idx * 0.06 }}
          >
            <div className="stage-card-header">
              <span className="stage-number-pill">{stage.num}</span>
              {idx < stages.length - 1 && (
                <div className="stage-connector-line" aria-hidden="true">
                  <ArrowRight size={13} className="connector-arrow" />
                </div>
              )}
            </div>
            <h3 className="stage-title">{stage.title}</h3>
            <p className="stage-desc muted">{stage.desc}</p>
          </m.div>
        ))}
      </div>
    </div>
  )
}

// HORIZONTALLY SLIDING PARTNERS & ORGANIZERS CAROUSEL (plan.md §3)
export function PartnersSection({ onSelectPartner }: { onSelectPartner: (p: Partner) => void }) {
  return (
    <section className="section section-partners">
      <div className="container">
        <SectionHeading
          eyebrow="Ecosystem & Support"
          title="Partners & Organisers"
          text="Backing student innovation through industry mentorship, cloud credits, developer tools, and rewards."
        />

        {/* Sliding Carousel Track */}
        <div className="partners-carousel-viewport">
          <div className="partners-marquee-track">
            {[...partners, ...partners].map((p, idx) => (
              <button
                key={`${p.id}-${idx}`}
                type="button"
                className="partner-card"
                onClick={() => onSelectPartner(p)}
                aria-label={`View details for ${p.name}`}
              >
                <div className="partner-logo-box">
                  <img src={p.logo} alt={p.name} className="partner-logo-img" />
                </div>
                <div className="partner-card-body">
                  <h4>{p.name}</h4>
                  <span className="partner-role-badge">{p.role}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-4">
          Click any partner or organiser card to view their role and contributions to AICUXORA 2027.
        </p>
      </div>
    </section>
  )
}

export function PublicAnnouncementsStrip() {
  const [announcements, setAnnouncements] = useState<Array<{ id: string; title: string; body: string; created_at: string; author: string }>>([])

  useEffect(() => {
    void api<{ announcements: typeof announcements }>('/api/announcements/public')
      .then(res => setAnnouncements(res.announcements || []))
      .catch(() => {})
  }, [])

  if (announcements.length === 0) return null

  return (
    <div className="public-announcements-banner">
      <div className="announcement-strip-inner container">
        <div className="announcement-tag">
          <Bell size={15} /> <span>LATEST UPDATE:</span>
        </div>
        <div className="announcement-headline">
          <strong>{announcements[0].title}</strong> — {announcements[0].body.slice(0, 110)}...
        </div>
        <Link to="/explore" className="announcement-link">
          Explore challenges <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  )
}

// DOCUMENT MODAL ANIMATION (plan.md §2.3)
export function DocumentModal({
  docKey,
  onClose,
}: {
  docKey: 'brief' | 'rules' | 'rubric'
  onClose: () => void
}) {
  const docs: Record<string, { title: string; date: string; content: React.ReactNode }> = {
    brief: {
      title: 'Problem Statements Release Guide',
      date: 'Release Date: 26 November 2026',
      content: (
        <div className="document-body">
          <p className="large-copy">
            Detailed challenge problem statements across Agriculture, Defense, Cybersecurity, Space Tech, and Robotics will be published here on <strong>26 November 2026</strong>.
          </p>
          <ul className="doc-bullet-list">
            <li><strong>Agriculture:</strong> Smart IoT irrigation, autonomous pest detection, farm-to-table logistics.</li>
            <li><strong>Defense:</strong> Secure telemetry, situational mesh communications, infrastructure hardening.</li>
            <li><strong>Cybersecurity:</strong> Zero-trust identity defense, automated vulnerability scanners, threat detection.</li>
            <li><strong>Space Tech:</strong> Satellite remote sensing analytics, deep space payload simulators.</li>
            <li><strong>Robotics:</strong> Computer vision locomotion, robotic sorting, assistive mobility devices.</li>
          </ul>
        </div>
      ),
    },
    rules: {
      title: 'AICUXORA 2027 Official Rulebook',
      date: 'Version 1.0 · Preliminary & Finale Guidelines',
      content: (
        <div className="document-body">
          <p className="large-copy">
            Eligibility and competition rules for all student teams participating in the online preliminary round and offline finale.
          </p>
          <ul className="doc-bullet-list">
            <li><strong>Team Formation:</strong> Minimum 2, maximum 5 verified college or university students.</li>
            <li><strong>Original Work:</strong> All submissions must be newly engineered or explicitly cite open-source foundations.</li>
            <li><strong>Submissions:</strong> Teams must submit working code repos, architecture diagrams, and a 3-minute video pitch.</li>
            <li><strong>Code of Conduct:</strong> Ethical collaboration, zero harassment, respect of intellectual property.</li>
          </ul>
        </div>
      ),
    },
    rubric: {
      title: 'Comprehensive Evaluation & Judging Rubric',
      date: 'Scoring Framework · Total: 100 Points',
      content: (
        <div className="document-body">
          <div className="rubric-grid">
            <div className="rubric-item">
              <strong>1. Problem Understanding (20 Pts)</strong>
              <p>Clarity of domain insight, target users affected, and relevance to the frontier challenges.</p>
            </div>
            <div className="rubric-item">
              <strong>2. Technical Execution (30 Pts)</strong>
              <p>Architecture quality, reliability of working prototype, clean codebase, and engineering feasibility.</p>
            </div>
            <div className="rubric-item">
              <strong>3. Innovation & Originality (25 Pts)</strong>
              <p>Novelty of the approach, inventive combination of AI/hardware, and competitive differentiation.</p>
            </div>
            <div className="rubric-item">
              <strong>4. Team Presentation & Impact (25 Pts)</strong>
              <p>Demonstration quality, team collaboration, roadmap for deployment, and commercial/social impact.</p>
            </div>
          </div>
        </div>
      ),
    },
  }

  const activeDoc = docs[docKey] || docs.brief

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <m.div
        className="modal-content-card doc-modal"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <span className="icon-tile"><FileText size={22} /></span>
            <div>
              <p className="eyebrow">{activeDoc.date}</p>
              <h2>{activeDoc.title}</h2>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close document">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body-scroll">{activeDoc.content}</div>
        <div className="modal-footer">
          <button type="button" className="button button-ghost" onClick={onClose}>
            Close Document
          </button>
          <Link to="/register" className="button button-primary">
            Register for Challenge <ArrowRight size={14} />
          </Link>
        </div>
      </m.div>
    </div>
  )
}

export function HomePage() {
  const [selectedDomainModal, setSelectedDomainModal] = useState<typeof domains[0] | null>(null)
  const [selectedPartnerModal, setSelectedPartnerModal] = useState<Partner | null>(null)
  const [activeDocModal, setActiveDocModal] = useState<'brief' | 'rules' | 'rubric' | null>(null)

  return (
    <>
      <PublicAnnouncementsStrip />

      {/* Hero Section */}
      <section className="hero container event-hero">
        <div className="hero-copy">
          <div className="event-pill">
            <span className="status-dot" /> AICUXORA 2027 <span className="pill-divider" /> BY INCUX AI
          </div>
          <p className="hero-kicker">INNOVATE. BUILD. SOLVE. TRANSFORM.</p>
          <h1>
            Where Bold Ideas <br />
            <span className="gradient-text">Become Breakthroughs.</span>
          </h1>
          <p className="hero-lede">
            Join AICUXORA 2027. Collaborate with brilliant minds, solve real-world challenges across five critical frontier domains, and compete for ₹10 Lakhs+ in cash, laptops, and Microsoft vouchers.
          </p>
          <div className="hero-actions">
            <Button to="/explore" arrow>Explore Challenges</Button>
            <Button to="/register" variant="secondary">Register Now</Button>
          </div>
          <div className="hero-document-links">
            <button type="button" className="text-doc-link" onClick={() => setActiveDocModal('brief')}>
              <FileText size={14} /> Problem Briefs Preview (26 Nov)
            </button>
            <span className="divider-dot">·</span>
            <button type="button" className="text-doc-link" onClick={() => setActiveDocModal('rubric')}>
              <Award size={14} /> Evaluation Rubric
            </button>
          </div>
          <p className="hero-note">
            <strong>2–3 January 2027</strong>
            <span>Offline Grand Finale · Venue to be announced</span>
          </p>
        </div>

        <div className="hero-art event-hero-art" aria-label="AICUXORA 2027 event artwork" role="img">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-grid" />
          <div className="art-core">
            <div className="core-glow" />
            <div className="core-cube">
              <span /><span /><span />
            </div>
            <Sparkles className="spark spark-a" size={21} />
            <Sparkles className="spark spark-b" size={15} />
          </div>
          <div className="float-chip chip-ai"><Cpu size={17} /> FIVE DOMAINS</div>
          <div className="float-chip chip-build"><Users size={17} /> TEAMS OF 2–5</div>
          <div className="art-caption">
            <span className="caption-line" /> INNOVATE · BUILD · TRANSFORM
          </div>
        </div>

        <div className="hero-bottom-full">
          <CountdownWidget />
        </div>
      </section>

      {/* Demo Stats Strip */}
      <section className="section-stats-wrap container">
        <DemoStatsStrip />
      </section>

      {/* About Section */}
      <section className="section section-about">
        <div className="container about-grid">
          <div>
            <p className="eyebrow">The Challenge</p>
            <h2>
              Big problems.<br />
              <span className="gradient-text">Buildable solutions.</span>
            </h2>
          </div>
          <div className="about-copy">
            <p className="large-copy">
              AICUXORA 2027 brings student innovators together to engineer high-impact solutions with technology, creativity, and multidisciplinary collaboration.
            </p>
            <p className="muted">
              Start in the remote online preliminary round. Top shortlisted teams advance to the in-person grand finale on 2–3 January 2027. Problem statements release officially on 26 November 2026.
            </p>
            <Link className="text-link" to="/about">About AICUXORA & Incux AI <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      {/* Domains Section */}
      <section className="section section-tracks">
        <div className="container">
          <SectionHeading
            eyebrow="Five frontier challenge domains"
            title="Choose the domain that moves you."
            text="Tackle real-world challenges in Agriculture, Defense, Cybersecurity, Space Technology, and Robotics. Problem briefs release 26 November 2026."
            action={<Button to="/explore" variant="secondary" arrow>Discover All Hackathons</Button>}
          />
          <DomainCards onSelectDomain={d => setSelectedDomainModal(d)} />
        </div>
      </section>

      {/* How It Works Section – 8-Stage Connected Interactive Timeline (plan.md §4) */}
      <section className="section section-how">
        <div className="container">
          <SectionHeading
            eyebrow="Competition Journey"
            title="How AICUXORA 2027 Works"
            text="An interactive connected roadmap from registration to the offline grand finale."
          />
          <ConnectedJourneyTimeline />
        </div>
      </section>

      {/* Partners and Organisers Sliding Section (plan.md §3) */}
      <PartnersSection onSelectPartner={p => setSelectedPartnerModal(p)} />

      {/* Timeline Section */}
      <section className="section section-timeline">
        <div className="container timeline-preview">
          <div>
            <p className="eyebrow">Key dates</p>
            <h2>
              Mark the<br />
              <span className="gradient-text">milestones.</span>
            </h2>
            <p className="muted">
              Problem statements release on 26 November 2026. Finale dates are confirmed for 2–3 January 2027.
            </p>
            <Button to="/timeline" variant="secondary" arrow>View full timeline</Button>
          </div>
          <TimelineList />
        </div>
      </section>

      {/* Rewards Section – Updated per plan.md §5 */}
      <section className="section section-prizes">
        <div className="container prize-panel">
          <div className="prize-glow" />
          <div className="prize-content">
            <div className="badge-proposed-wrap">
              <span className="badge badge-proposed">TOTAL REWARDS & RECOGNITION</span>
            </div>
            <h2>
              ₹10,00,000 Cash <br />
              <span className="gradient-text">+ Microsoft Vouchers & Gifts</span>
            </h2>
            <p className="muted">
              AICUXORA 2027 rewards bold thinking with cash rewards, high-performance hardware, cloud credits, and exciting gifts.
            </p>

            <div className="rewards-card-grid">
              <div className="reward-sub-card">
                <Gift className="reward-icon text-emerald-400" size={24} />
                <strong>₹10,00,000 Cash Pool</strong>
                <p>Direct cash prize pool distributed across winners in all 5 challenge tracks.</p>
              </div>
              <div className="reward-sub-card">
                <Laptop className="reward-icon text-sky-400" size={24} />
                <strong>Three High-End Laptops</strong>
                <p>Top standout engineering teams win developer laptops for continued innovation.</p>
              </div>
              <div className="reward-sub-card">
                <Sparkles className="reward-icon text-amber-400" size={24} />
                <strong>Microsoft Vouchers & Cloud</strong>
                <p>Official Microsoft Gift Vouchers and Azure AI developer sponsorship credits.</p>
              </div>
              <div className="reward-sub-card">
                <Award className="reward-icon text-pink-400" size={24} />
                <strong>Exciting Gifts & Swag</strong>
                <p>Exclusive IncuX AI merchandise, certificates of excellence, and sponsor perks.</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3 flex-wrap">
              <Button to="/prizes" variant="secondary" arrow>Detailed Prize Breakdown</Button>
              <button type="button" className="button button-ghost" onClick={() => setActiveDocModal('rubric')}>
                View Evaluation Rubric <ExternalLink size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="section section-faq">
        <div className="container faq-grid">
          <div>
            <p className="eyebrow">Got questions?</p>
            <h2>
              Frequently Asked<br />
              <span className="gradient-text">Questions</span>
            </h2>
            <p className="muted">
              Key event details, team size guidelines (2–5 members), and formats are answered here.
            </p>
            <div className="flex gap-2 flex-col mt-4">
              <Button to="/rules" variant="secondary" arrow>Full Rules & Guidelines</Button>
              <button
                type="button"
                className="text-doc-link inline-flex items-center gap-2 mt-2"
                onClick={() => setActiveDocModal('rules')}
              >
                <FileText size={15} /> Open Official Rulebook Modal
              </button>
            </div>
          </div>
          <FaqItems limit={5} />
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="section final-cta">
        <div className="container final-cta-inner">
          <div className="cta-spark"><Sparkles size={22} /></div>
          <p className="eyebrow">AICUXORA 2027 · INCUX AI</p>
          <h2>
            INNOVATE.<br />
            <span className="gradient-text">BUILD. TRANSFORM.</span>
          </h2>
          <p className="muted">
            Create your student account, assemble your 2–5 member squad, and prepare for problem statements release on 26 November 2026.
          </p>
          <div className="hero-actions" style={{ justifyContent: 'center' }}>
            <Button to="/explore" arrow>Explore Challenges</Button>
            <Button to="/register" variant="secondary">Register Now</Button>
          </div>
        </div>
      </section>

      {/* Domain Detail Modal */}
      {selectedDomainModal && (
        <div className="modal-backdrop" onClick={() => setSelectedDomainModal(null)} role="dialog" aria-modal="true">
          <div className="modal-content-card small-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <span className="icon-tile"><selectedDomainModal.icon size={22} /></span>
                <div>
                  <p className="eyebrow">DOMAIN #{selectedDomainModal.number}</p>
                  <h2>{selectedDomainModal.title}</h2>
                </div>
              </div>
              <button type="button" className="modal-close" onClick={() => setSelectedDomainModal(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body-scroll">
              <div className="modal-image-preview">
                <img src={selectedDomainModal.image} alt={selectedDomainModal.title} className="modal-banner-img" />
              </div>
              <p className="large-copy" style={{ fontSize: '15px', color: 'var(--text)', marginTop: '12px' }}>
                {selectedDomainModal.text}
              </p>
              <div className="modal-section" style={{ marginTop: '16px' }}>
                <h4>What you can build</h4>
                <p className="muted">{selectedDomainModal.deepDescription}</p>
              </div>
              <div className="modal-section">
                <h4>Focus Tags</h4>
                <div className="tags">
                  {selectedDomainModal.tags.map(t => <span key={t}>{t}</span>)}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="button button-ghost" onClick={() => setSelectedDomainModal(null)}>
                Close
              </button>
              <Link to="/explore" className="button button-primary">
                Explore hackathons <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Partner Info Modal (plan.md §3) */}
      {selectedPartnerModal && (
        <div className="modal-backdrop" onClick={() => setSelectedPartnerModal(null)} role="dialog" aria-modal="true">
          <div className="modal-content-card partner-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-3">
                <div className="partner-modal-logo">
                  <img src={selectedPartnerModal.logo} alt={selectedPartnerModal.name} />
                </div>
                <div>
                  <p className="eyebrow">{selectedPartnerModal.category.toUpperCase()} PARTNER</p>
                  <h2>{selectedPartnerModal.name}</h2>
                </div>
              </div>
              <button type="button" className="modal-close" onClick={() => setSelectedPartnerModal(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body-scroll">
              <div className="partner-detail-section">
                <h4>Role in AICUXORA 2027</h4>
                <p className="partner-highlight-role">{selectedPartnerModal.role}</p>
              </div>
              <div className="partner-detail-section">
                <h4>About the Organisation</h4>
                <p className="muted">{selectedPartnerModal.description}</p>
              </div>
              <div className="partner-detail-section">
                <h4>Contribution to AICUXORA</h4>
                <p className="muted">{selectedPartnerModal.contribution}</p>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="button button-ghost" onClick={() => setSelectedPartnerModal(null)}>
                Close
              </button>
              <a
                href={selectedPartnerModal.website}
                target="_blank"
                rel="noreferrer noopener"
                className="button button-primary"
              >
                Visit Website <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Animated Document Modal (plan.md §2.3) */}
      {activeDocModal && (
        <DocumentModal docKey={activeDocModal} onClose={() => setActiveDocModal(null)} />
      )}
    </>
  )
}

export function AboutPage() {
  return (
    <>
      <PageIntro
        eyebrow="About AICUXORA 2027"
        title="A challenge built for student teams."
        text="AICUXORA 2027 is an IncuX AI student hackathon: an online preliminary round followed by an offline grand finale on January 2–3, 2027."
      />
      <section className="section">
        <div className="container about-detail-grid">
          <Card>
            <span className="icon-tile"><Lightbulb /></span>
            <h3>Purposeful innovation</h3>
            <p className="muted">Explore Agriculture, Defense, Cybersecurity, Space Technology, and Robotics.</p>
          </Card>
          <Card>
            <span className="icon-tile"><Wifi /></span>
            <h3>Online to in-person</h3>
            <p className="muted">The preliminary round is online. Finalists attend the offline grand finale on 2–3 Jan 2027; venue to be announced.</p>
          </Card>
          <Card>
            <span className="icon-tile"><Users /></span>
            <h3>Build as a team</h3>
            <p className="muted">Teams have 2–5 members. Eligibility rules will be published with official guidelines.</p>
          </Card>
        </div>
      </section>
      <section className="section">
        <div className="container notice-panel">
          <span className="icon-tile"><Sparkles /></span>
          <div>
            <p className="eyebrow">Organized by IncuX AI</p>
            <h2>INNOVATE. BUILD. SOLVE. TRANSFORM.</h2>
            <p className="muted">Problem statements release 26 November 2026. Total rewards: ₹10,00,000 Cash + Microsoft Gift Vouchers + Exciting Gifts.</p>
          </div>
        </div>
      </section>
    </>
  )
}

export function TracksPage() {
  return (
    <>
      <PageIntro
        eyebrow="AICUXORA 2027 domains"
        title="Five fields. Countless ways forward."
        text="Choose from five challenge domains. Problem statements release November 26, 2026."
      />
      <section className="section">
        <div className="container">
          <DomainCards />
          <p className="placeholder-note">
            <Sparkles size={16} /> Specific problem statements publish November 26, 2026.
          </p>
        </div>
      </section>
    </>
  )
}

export function TimelinePage() {
  return (
    <>
      <PageIntro
        eyebrow="Event timeline"
        title="From online round to finale."
        text="The finale dates are confirmed (2–3 January 2027). Problem statements release on 26 November 2026."
      />
      <section className="section">
        <div className="container timeline-page">
          <TimelineList />
          <aside className="timeline-side-note">
            <span className="icon-tile"><Radio /></span>
            <p className="eyebrow">Grand finale</p>
            <h3>January 2–3, 2027</h3>
            <p className="muted">Offline finale. Venue details will be announced.</p>
            <Button to="/register" variant="secondary" arrow>Registration information</Button>
          </aside>
        </div>
      </section>
    </>
  )
}

export function PrizesPage() {
  return (
    <>
      <PageIntro
        eyebrow="Total Rewards"
        title="Recognition for work that matters."
        text="Total Rewards: ₹10,00,000 Cash + Microsoft Gift Vouchers + Exciting Gifts."
      />
      <section className="section">
        <div className="container prize-detail">
          <div className="prize-detail-art">
            <div className="prize-orbit">
              <span className="prize-ring ring-a" />
              <span className="prize-ring ring-b" />
              <div className="prize-star"><Sparkles size={38} /></div>
            </div>
          </div>
          <div>
            <p className="eyebrow">Rewards breakdown</p>
            <h2>Total Pool<br /><span className="gradient-text">₹10,00,000+</span></h2>
            <p className="muted">
              Prizes include ₹10,00,000 cash rewards across the five domain tracks, three laptops for standout builders, Microsoft vouchers, and exclusive tech swag hampers.
            </p>
            <div className="check-list">
              <p><Check size={16} /> ₹10,00,000 Cash Prize Pool</p>
              <p><Check size={16} /> Three High-Performance Laptops</p>
              <p><Check size={16} /> Microsoft Gift Vouchers & Cloud Credits</p>
              <p><Check size={16} /> Exciting Gifts & Merch for Finalist Teams</p>
            </div>
            <Button to="/rules" variant="secondary" arrow>Read rules and FAQs</Button>
          </div>
        </div>
      </section>
    </>
  )
}

export function EvaluationPage() {
  const criteria = [
    ['Problem understanding', 'How clearly the team understands the challenge and people affected.'],
    ['Innovation and relevance', 'How thoughtfully the approach addresses the selected domain.'],
    ['Technical execution', 'Quality, reliability, and clarity of the working solution.'],
    ['Impact and feasibility', 'Potential usefulness, responsible use, and a credible path to application.'],
    ['Communication and teamwork', 'How clearly the team demonstrates its process and results.'],
  ]
  return (
    <>
      <PageIntro
        eyebrow="Evaluation"
        title="A clear rubric is coming."
        text="Official scoring criteria, weights, judging process, and tie-break rules for AICUXORA 2027."
      />
      <section className="section">
        <div className="container evaluation-wrap">
          <div className="notice-panel criteria-notice">
            <span className="icon-tile"><ShieldCheck /></span>
            <div>
              <p className="eyebrow">Evaluation Framework</p>
              <h2>Comprehensive Scoring Rubric</h2>
              <p className="muted">
                Each team submission will be evaluated on technical execution, innovation, problem understanding, and presentation impact.
              </p>
            </div>
          </div>
          <div className="criteria-grid">
            {criteria.map(([title, text], index) => (
              <Card key={title} className="criterion-card">
                <span className="track-number">0{index + 1}</span>
                <h3>{title}</h3>
                <p className="muted">{text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters')
})
const registerSchema = z.object({
  name: z.string().min(2, 'Enter at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(12, 'Use at least 12 characters'),
  institution: z.string().min(2, 'Enter your institution'),
  interest: z.string().min(1, 'Choose a domain')
})
const contactSchema = z.object({
  name: z.string().min(2, 'Enter your name'),
  email: z.string().email('Enter a valid email'),
  message: z.string().min(10, 'Please add a little more detail')
})
type LoginValues = z.infer<typeof loginSchema>
type RegisterValues = z.infer<typeof registerSchema>
type ContactValues = z.infer<typeof contactSchema>

function AuthFrame({ mode, children }: { mode: 'login' | 'register'; children: React.ReactNode }) {
  return (
    <section className="auth-section container">
      <div className="auth-aside">
        <img className="auth-brand-logo" src="/assets/brand/incux-ai-logo.jpeg" alt="IncuX AI official logo" />
        <div className="auth-art">
          <div className="auth-orbit" />
          <div className="auth-symbol"><Sparkles size={31} /></div>
        </div>
        <p className="eyebrow">AICUXORA 2027 · INCUX AI</p>
        <h2>
          {mode === 'login' ? (
            <>Your team’s<br />next step <span className="gradient-text">starts here.</span></>
          ) : (
            <>Build for<br /><span className="gradient-text">what matters.</span></>
          )}
        </h2>
        <p className="muted">
          {mode === 'login' ? 'Sign in to your student or administrator account.' : 'Create an individual student account. Connect with your team inside.'}
        </p>
      </div>
      <div className="auth-card">
        <p className="eyebrow">{mode === 'login' ? 'Secure local sign-in' : 'AICUXORA 2027 registration'}</p>
        <h1>{mode === 'login' ? 'Log in' : 'Student registration'}</h1>
        <p className="muted auth-subtitle">
          {mode === 'login' ? 'Sign in to access your dashboard, team hub, and submissions.' : 'Your password is saved securely with scrypt. Verification is required.'}
        </p>
        {children}
      </div>
    </section>
  )
}

export function LoginPage() {
  const [message, setMessage] = useState('')
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const { register, handleSubmit, formState: { errors } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  return (
    <AuthFrame mode="login">
      <form
        onSubmit={handleSubmit(async values => {
          setMessage('')
          try {
            const result = await api<{ user: { role: string } }>('/api/auth/login', {
              method: 'POST',
              body: JSON.stringify({ email: values.email, password: values.password }),
            })
            await refresh()
            navigate(result.user.role === 'student' ? '/student' : '/admin')
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Sign-in failed.')
          }
        })}
        noValidate
      >
        <label className="field-label" htmlFor="login-email">Email address</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          aria-required="true"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          {...register('email')}
        />
        {errors.email && <span id="login-email-error" className="field-error" role="alert">{errors.email.message}</span>}

        <label className="field-label" htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          aria-required="true"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'login-password-error' : undefined}
          {...register('password')}
        />
        {errors.password && <span id="login-password-error" className="field-error" role="alert">{errors.password.message}</span>}

        <Button type="submit" className="full-button">
          Sign in <ArrowRight size={17} />
        </Button>
        {message && <p className="form-notice" role="status">{message}</p>}
        <p className="auth-switch"><Link to="/forgot-password">Forgot password?</Link></p>
        <p className="auth-switch">Need an account? <Link to="/register">Student registration</Link></p>
      </form>
    </AuthFrame>
  )
}

export function RegisterPage() {
  const [message, setMessage] = useState('')
  const [verificationUrl, setVerificationUrl] = useState('')
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) })

  return (
    <AuthFrame mode="register">
      <form
        onSubmit={handleSubmit(async values => {
          setMessage('')
          setVerificationUrl('')
          try {
            const result = await api<{ message: string; localVerificationToken?: string; demoOnly?: string }>('/api/auth/register', {
              method: 'POST',
              body: JSON.stringify({
                fullName: values.name,
                email: values.email,
                password: values.password,
                college: values.institution,
                domain: values.interest,
              }),
            })
            setMessage(`${result.message} ${result.demoOnly || ''}`)
            if (result.localVerificationToken) {
              setVerificationUrl(`/verify-email?token=${encodeURIComponent(result.localVerificationToken)}`)
            }
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Registration failed.')
          }
        })}
        noValidate
      >
        <label className="field-label" htmlFor="register-name">Full name</label>
        <input
          id="register-name"
          autoComplete="name"
          aria-required="true"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'register-name-error' : undefined}
          {...register('name')}
        />
        {errors.name && <span id="register-name-error" className="field-error" role="alert">{errors.name.message}</span>}

        <label className="field-label" htmlFor="register-email">Email address</label>
        <input
          id="register-email"
          type="email"
          autoComplete="email"
          aria-required="true"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'register-email-error' : undefined}
          {...register('email')}
        />
        {errors.email && <span id="register-email-error" className="field-error" role="alert">{errors.email.message}</span>}

        <label className="field-label" htmlFor="register-password">Password (at least 12 characters)</label>
        <input
          id="register-password"
          type="password"
          autoComplete="new-password"
          aria-required="true"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'register-password-error' : undefined}
          {...register('password')}
        />
        {errors.password && <span id="register-password-error" className="field-error" role="alert">{errors.password.message}</span>}

        <label className="field-label" htmlFor="register-institution">School / college</label>
        <input
          id="register-institution"
          autoComplete="organization"
          aria-required="true"
          aria-invalid={Boolean(errors.institution)}
          aria-describedby={errors.institution ? 'register-institution-error' : undefined}
          {...register('institution')}
        />
        {errors.institution && <span id="register-institution-error" className="field-error" role="alert">{errors.institution.message}</span>}

        <label className="field-label" htmlFor="register-interest">Preferred domain for your individual registration</label>
        <select
          id="register-interest"
          defaultValue=""
          aria-required="true"
          aria-invalid={Boolean(errors.interest)}
          aria-describedby={errors.interest ? 'register-interest-error' : undefined}
          {...register('interest')}
        >
          <option value="" disabled>Select a domain</option>
          {domains.map(domain => <option key={domain.title} value={domain.title}>{domain.title}</option>)}
        </select>
        {errors.interest && <span id="register-interest-error" className="field-error" role="alert">{errors.interest.message}</span>}

        <p className="muted">Registration is individual. You can form or join teams of 2–5 inside your Student Dashboard.</p>

        <Button type="submit" className="full-button">
          Create student account <ArrowRight size={17} />
        </Button>
        {message && <p className="form-notice" role="status">{message}</p>}
        {verificationUrl && (
          <p className="auth-switch">
            Local verification link: <Link to={verificationUrl} className="text-emerald-400 font-semibold underline">Verify this account now</Link>
          </p>
        )}
        <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </AuthFrame>
  )
}

export function FaqPage() {
  return (
    <>
      <PageIntro
        eyebrow="Rules and FAQs"
        title="The details teams need."
        text="Confirmed information is shown alongside items still awaiting announcement. Official rules will be published before registration closes."
      />
      <section className="section">
        <div className="container faq-page-grid">
          <div>
            <span className="icon-tile"><Mail /></span>
            <h3>Quick facts</h3>
            <p className="muted">
              Teams have 2–5 members. Problem statements publish 26 November 2026. Preliminary round online, finale offline January 2–3, 2027.
            </p>
            <Button to="/evaluation" variant="secondary" arrow>Evaluation criteria</Button>
          </div>
          <FaqItems />
        </div>
      </section>
      <section className="section">
        <div className="container notice-panel">
          <span className="icon-tile"><LockKeyhole /></span>
          <div>
            <p className="eyebrow">Official rules pending</p>
            <h2>Follow the official rulebook when published.</h2>
            <p className="muted">
              Eligibility, originality, team changes, submissions, judging, conduct, and prize terms are documented in the official rulebook.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}

export function CommunityPage() {
  return (
    <>
      <PageIntro
        eyebrow="Participant community & teams"
        title="Find your people. Build together."
        text="Assemble or discover teams of 2–5 members across Agriculture, Defense, Cybersecurity, Space Tech, and Robotics."
      />
      <section className="section">
        <div className="container community-full">
          <div className="community-feature">
            <div className="feature-art">
              <div className="feature-orb orb-one" />
              <div className="feature-orb orb-two" />
              <Users size={46} />
            </div>
            <div>
              <p className="eyebrow">Active in Student Portal</p>
              <h2>Form Your Squad.<br /><span className="gradient-text">Compete in AICUXORA 2027.</span></h2>
              <p className="muted">
                Create your team, invite peers with secure codes (e.g. AICU-XXXXX), or browse active hackathon challenges directly.
              </p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
                <Button to="/student/team" arrow>Team Workspace & Chat</Button>
                <Button to="/explore" variant="secondary">Explore Challenges</Button>
              </div>

              {/* Social Media Integration (plan.md §10) */}
              <div className="community-social-card mt-6">
                <h4>Join Our Official Online Communities</h4>
                <div className="flex gap-3 mt-3 flex-wrap">
                  <a
                    href="https://www.linkedin.com/company/incux-ai"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="social-badge linkedin"
                  >
                    <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                    </svg>
                    LinkedIn Page
                    <ArrowUpRight size={11} />
                  </a>
                  <a
                    href="https://www.instagram.com/incux_ai"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="social-badge instagram"
                  >
                    <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    Instagram Profile
                    <ArrowUpRight size={11} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export function ContactPage() {
  const [message, setMessage] = useState('')
  const { register, handleSubmit, formState: { errors } } = useForm<ContactValues>({ resolver: zodResolver(contactSchema) })
  return (
    <>
      <PageIntro
        eyebrow="Contact Organizers"
        title="Connect with the Incux AI team."
        text="Have queries regarding eligibility, challenge tracks, or partnership? Send a message to the organizing team."
      />
      <section className="section">
        <div className="container contact-grid">
          <div className="contact-copy">
            <span className="icon-tile"><Mail /></span>
            <h2>Questions about<br />AICUXORA 2027?</h2>
            <p className="muted">
              Organized by IncuX AI. Official venue and confirmed schedule updates will be released as announced.
            </p>

            <div className="contact-social-box mt-4">
              <strong>Official Channels</strong>
              <div className="flex gap-3 mt-2">
                <a href="https://www.linkedin.com/company/incux-ai" target="_blank" rel="noreferrer noopener" className="text-link">
                  LinkedIn <ArrowUpRight size={12} />
                </a>
                <a href="https://www.instagram.com/incux_ai" target="_blank" rel="noreferrer noopener" className="text-link">
                  Instagram <ArrowUpRight size={12} />
                </a>
              </div>
            </div>

            <div className="contact-note mt-4">
              <LockKeyhole size={17} />
              <span>Your message is kept secure.</span>
            </div>
          </div>
          <Card className="contact-form-card">
            <form
              onSubmit={handleSubmit(() => setMessage('Thank you! Your message has been received by the organizing console.'))}
              noValidate
            >
              <label className="field-label" htmlFor="contact-name">Your name</label>
              <input
                id="contact-name"
                autoComplete="name"
                aria-required="true"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'contact-name-error' : undefined}
                {...register('name')}
              />
              {errors.name && <span id="contact-name-error" className="field-error" role="alert">{errors.name.message}</span>}

              <label className="field-label" htmlFor="contact-email">Email address</label>
              <input
                id="contact-email"
                type="email"
                autoComplete="email"
                aria-required="true"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'contact-email-error' : undefined}
                {...register('email')}
              />
              {errors.email && <span id="contact-email-error" className="field-error" role="alert">{errors.email.message}</span>}

              <label className="field-label" htmlFor="contact-message">Your message</label>
              <textarea
                id="contact-message"
                rows={5}
                aria-required="true"
                aria-invalid={Boolean(errors.message)}
                aria-describedby={errors.message ? 'contact-message-error' : undefined}
                {...register('message')}
              />
              {errors.message && <span id="contact-message-error" className="field-error" role="alert">{errors.message.message}</span>}

              <Button type="submit" className="full-button">
                Submit Message <ArrowRight size={17} />
              </Button>
              {message && <p className="form-notice" role="status">{message}</p>}
            </form>
          </Card>
        </div>
      </section>
    </>
  )
}

export function NotFoundPage() {
  return (
    <section className="not-found container">
      <div className="not-found-mark">404</div>
      <p className="eyebrow">AICUXORA 2027</p>
      <h1>This page is not<br /><span className="gradient-text">on the map.</span></h1>
      <p className="muted">Return to the event homepage to explore confirmed details.</p>
      <Button to="/" arrow>Back to home</Button>
    </section>
  )
}
