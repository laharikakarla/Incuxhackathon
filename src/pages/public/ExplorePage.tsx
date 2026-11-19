import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, Calendar, Users, Trophy, ShieldCheck, Sparkles, ArrowRight, X, CheckCircle2, ChevronRight } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { api } from '../../lib/api'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../context/ToastContext'

export interface Hackathon {
  id: string
  title: string
  organizer: string
  tagline: string
  domains: string[]
  status: 'Upcoming' | 'Live' | 'Completed'
  dates: string
  problemStatementsDate: string
  registrationDeadline: string
  finalistsAnnouncedDate: string
  mode: string
  venue: string
  teamSize: string
  registrationFee: string
  prizePool: string
  prizes: string[]
  rules: string[]
  description: string
  isFlagship: boolean
  demo: boolean
}

export function ExplorePage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [hackathons, setHackathons] = useState<Hackathon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDomain, setSelectedDomain] = useState('All')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [sortBy, setSortBy] = useState<'date' | 'title'>('date')

  // Selected Hackathon for Detail Modal
  const [selectedHackathon, setSelectedHackathon] = useState<Hackathon | null>(null)

  // Registration Modal State
  const [registeringHackathon, setRegisteringHackathon] = useState<Hackathon | null>(null)
  const [regDomain, setRegDomain] = useState<string>('Agriculture')
  const [regType, setRegType] = useState<'individual' | 'team'>('individual')
  const [regSubmitting, setRegSubmitting] = useState(false)

  // Existing student registration state
  const [studentReg, setStudentReg] = useState<{ domain: string; status: string; team_id?: string } | null>(null)

  useEffect(() => {
    void api<{ hackathons: Hackathon[] }>('/api/hackathons')
      .then(res => {
        setHackathons(res.hackathons)
        setLoading(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Could not load hackathons.')
        setLoading(false)
      })

    if (user?.role === 'student') {
      void api<{ registration?: { domain: string; status: string; team_id?: string } | null }>('/api/student/dashboard')
        .then(res => {
          if (res.registration) setStudentReg(res.registration)
        })
        .catch(() => {})
    }
  }, [user])

  const domainOptions = ['All', 'Agriculture', 'Defense', 'Cybersecurity', 'Space Technology', 'Robotics']
  const statusOptions = ['All', 'Upcoming', 'Live', 'Completed']

  const filteredHackathons = useMemo(() => {
    return hackathons
      .filter(item => {
        const matchesSearch =
          searchQuery === '' ||
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.domains.some(d => d.toLowerCase().includes(searchQuery.toLowerCase()))

        const matchesDomain = selectedDomain === 'All' || item.domains.includes(selectedDomain)
        const matchesStatus = selectedStatus === 'All' || item.status.toLowerCase() === selectedStatus.toLowerCase()

        return matchesSearch && matchesDomain && matchesStatus
      })
      .sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title)
        // Flagship first, then dates
        if (a.isFlagship) return -1
        if (b.isFlagship) return 1
        return 0
      })
  }, [hackathons, searchQuery, selectedDomain, selectedStatus, sortBy])

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      navigate('/login?next=/explore')
      return
    }
    setRegSubmitting(true)
    try {
      await api('/api/student/register-event', {
        method: 'POST',
        body: JSON.stringify({
          domain: regDomain,
          registrationType: regType,
        }),
      })
      showToast(`Successfully registered for ${registeringHackathon?.title} (${regDomain})!`, 'success')
      setStudentReg({ domain: regDomain, status: 'submitted' })
      setRegisteringHackathon(null)
      setSelectedHackathon(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Registration failed.', 'error')
    } finally {
      setRegSubmitting(false)
    }
  }

  return (
    <div className="explore-page container">
      {/* Header Banner */}
      <section className="explore-hero">
        <p className="eyebrow">AICUXORA 2027 · HACKATHON DISCOVERY</p>
        <h1>
          Explore Challenges & <br />
          <span className="gradient-text">Frontier Competitions</span>
        </h1>
        <p className="muted explore-lede">
          Discover high-impact hackathons across Agriculture, Defense, Cybersecurity, Space Technology, and Robotics. Form a 2–5 participant team, collaborate, and compete for proposed prizes.
        </p>
      </section>

      {/* Search and Filters Bar */}
      <div className="explore-controls-card">
        <div className="explore-search-box">
          <Search size={18} className="search-icon" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by challenge, domain, or technology..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search hackathons"
          />
          {searchQuery && (
            <button type="button" className="clear-btn" onClick={() => setSearchQuery('')} aria-label="Clear search">
              <X size={15} />
            </button>
          )}
        </div>

        <div className="explore-filter-group">
          {/* Domain Pills */}
          <div className="filter-row">
            <span className="filter-label"><Filter size={13} /> Domain:</span>
            <div className="filter-pills" role="radiogroup" aria-label="Filter by domain">
              {domainOptions.map(domain => (
                <button
                  key={domain}
                  type="button"
                  className={`pill-btn ${selectedDomain === domain ? 'active' : ''}`}
                  onClick={() => setSelectedDomain(domain)}
                >
                  {domain}
                </button>
              ))}
            </div>
          </div>

          {/* Status Pills & Sort */}
          <div className="filter-row-secondary">
            <div className="filter-row">
              <span className="filter-label">Status:</span>
              <div className="filter-pills" role="radiogroup" aria-label="Filter by status">
                {statusOptions.map(status => (
                  <button
                    key={status}
                    type="button"
                    className={`pill-btn ${selectedStatus === status ? 'active' : ''}`}
                    onClick={() => setSelectedStatus(status)}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="sort-box">
              <label htmlFor="sort-select">Sort by:</label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'date' | 'title')}
              >
                <option value="date">Featured & Date</option>
                <option value="title">Alphabetical (A–Z)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="explore-results-header">
        <p className="results-count">
          Showing <strong>{filteredHackathons.length}</strong> {filteredHackathons.length === 1 ? 'hackathon' : 'hackathons'}
          {selectedDomain !== 'All' && <span> in <b>{selectedDomain}</b></span>}
        </p>
      </div>

      {/* Loading & Error States */}
      {loading && <p className="loading-state" role="status">Loading hackathons catalog…</p>}
      {error && <p className="form-notice" role="alert">{error}</p>}

      {/* Cards Grid */}
      <div className="hackathon-grid">
        {filteredHackathons.map(hackathon => (
          <Card
            key={hackathon.id}
            className={`hackathon-card ${hackathon.isFlagship ? 'flagship-card' : ''}`}
          >
            <div className="hackathon-card-top">
              <div className="hackathon-badges">
                {hackathon.isFlagship && (
                  <span className="badge badge-flagship">
                    <Sparkles size={12} /> OFFICIAL FLAGSHIP
                  </span>
                )}
                {hackathon.demo && (
                  <span className="badge badge-demo">DEMO CHALLENGE</span>
                )}
                <span className={`badge badge-status badge-${hackathon.status.toLowerCase()}`}>
                  {hackathon.status}
                </span>
              </div>
              <span className="hackathon-team-size">
                <Users size={13} /> {hackathon.teamSize}
              </span>
            </div>

            <h3 className="hackathon-title">{hackathon.title}</h3>
            <p className="hackathon-organizer">Organized by {hackathon.organizer}</p>
            <p className="hackathon-desc">{hackathon.description}</p>

            <div className="hackathon-domain-tags">
              {hackathon.domains.map(d => (
                <span key={d} className="domain-chip">{d}</span>
              ))}
            </div>

            <div className="hackathon-meta-strip">
              <div className="meta-item">
                <Calendar size={14} />
                <span>{hackathon.dates}</span>
              </div>
              <div className="meta-item">
                <Trophy size={14} />
                <span className="prize-text">{hackathon.prizePool}</span>
              </div>
            </div>

            <div className="hackathon-card-footer">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setSelectedHackathon(hackathon)}
              >
                View Details
              </button>

              {user?.role === 'student' && studentReg && hackathon.isFlagship ? (
                <span className="registered-pill">
                  <CheckCircle2 size={14} /> Registered ({studentReg.domain})
                </span>
              ) : (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    if (!user) {
                      navigate(`/login?next=/explore`)
                    } else {
                      setRegisteringHackathon(hackathon)
                      setRegDomain(hackathon.domains[0] || 'Agriculture')
                    }
                  }}
                >
                  Register <ArrowRight size={14} />
                </button>
              )}
            </div>
          </Card>
        ))}

        {filteredHackathons.length === 0 && !loading && (
          <div className="empty-catalog">
            <Search size={32} />
            <h3>No hackathons match your search</h3>
            <p className="muted">Try adjusting your domain filters or search keywords.</p>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setSearchQuery('')
                setSelectedDomain('All')
                setSelectedStatus('All')
              }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedHackathon && (
        <div className="modal-backdrop" onClick={() => setSelectedHackathon(null)} role="dialog" aria-modal="true" aria-labelledby="modal-hackathon-title">
          <div className="modal-content-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="hackathon-badges">
                  {selectedHackathon.isFlagship && (
                    <span className="badge badge-flagship"><Sparkles size={12} /> FLAGSHIP</span>
                  )}
                  {selectedHackathon.demo && (
                    <span className="badge badge-demo">DEMO SIMULATION</span>
                  )}
                  <span className={`badge badge-status badge-${selectedHackathon.status.toLowerCase()}`}>
                    {selectedHackathon.status}
                  </span>
                </div>
                <h2 id="modal-hackathon-title">{selectedHackathon.title}</h2>
                <p className="muted">{selectedHackathon.tagline} · Organized by {selectedHackathon.organizer}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setSelectedHackathon(null)} aria-label="Close modal">
                <X size={20} />
              </button>
            </div>

            <div className="modal-body-scroll">
              <div className="modal-section">
                <h4>Challenge Overview</h4>
                <p className="muted">{selectedHackathon.description}</p>
              </div>

              <div className="modal-grid-two">
                <div className="modal-section">
                  <h4>Domains</h4>
                  <div className="hackathon-domain-tags">
                    {selectedHackathon.domains.map(d => (
                      <span key={d} className="domain-chip">{d}</span>
                    ))}
                  </div>
                </div>

                <div className="modal-section">
                  <h4>Participation Rules</h4>
                  <p className="muted-highlight"><Users size={15} /> Team size: <strong>{selectedHackathon.teamSize}</strong></p>
                  <p className="muted-highlight"><ShieldCheck size={15} /> Mode: <strong>{selectedHackathon.mode}</strong></p>
                </div>
              </div>

              <div className="modal-section">
                <h4>Timeline & Key Milestones</h4>
                <ul className="modal-timeline-list">
                  <li>
                    <span>Problem Statements Release</span>
                    <b>{selectedHackathon.problemStatementsDate}</b>
                  </li>
                  <li>
                    <span>Registration Deadline</span>
                    <b>{selectedHackathon.registrationDeadline}</b>
                  </li>
                  <li>
                    <span>Finalists Notification</span>
                    <b>{selectedHackathon.finalistsAnnouncedDate}</b>
                  </li>
                  <li>
                    <span>Grand Finale</span>
                    <b>{selectedHackathon.dates}</b>
                  </li>
                </ul>
              </div>

              <div className="modal-section prize-box">
                <h4>Prizes & Recognition</h4>
                <span className="sub-tag">PROPOSED / SUBJECT TO OFFICIAL CONFIRMATION</span>
                <ul className="prize-list">
                  {selectedHackathon.prizes.map((p, idx) => (
                    <li key={idx}><Trophy size={14} /> {p}</li>
                  ))}
                </ul>
                <p className="small-disclaimer">
                  All awards, laptops, and vouchers are subject to final confirmation by Incux AI.
                </p>
              </div>

              <div className="modal-section">
                <h4>Event Guidelines</h4>
                <ul className="rules-list">
                  {selectedHackathon.rules.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="button button-ghost" onClick={() => setSelectedHackathon(null)}>
                Close
              </button>

              {user?.role === 'student' && studentReg && selectedHackathon.isFlagship ? (
                <Button to="/student" variant="secondary">
                  View in Dashboard <ChevronRight size={14} />
                </Button>
              ) : (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    const target = selectedHackathon
                    setSelectedHackathon(null)
                    if (!user) {
                      navigate(`/login?next=/explore`)
                    } else {
                      setRegisteringHackathon(target)
                      setRegDomain(target.domains[0] || 'Agriculture')
                    }
                  }}
                >
                  Register Now <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Registration Modal Dialog */}
      {registeringHackathon && (
        <div className="modal-backdrop" onClick={() => setRegisteringHackathon(null)} role="dialog" aria-modal="true" aria-labelledby="modal-reg-title">
          <div className="modal-content-card small-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">AICUXORA 2027 · EVENT REGISTRATION</p>
                <h2 id="modal-reg-title">{registeringHackathon.title}</h2>
              </div>
              <button type="button" className="modal-close" onClick={() => setRegisteringHackathon(null)} aria-label="Close dialog">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit}>
              <div className="modal-form-body">
                <label className="field-label" htmlFor="reg-domain-select">
                  Select your Challenge Domain
                </label>
                <select
                  id="reg-domain-select"
                  value={regDomain}
                  onChange={e => setRegDomain(e.target.value)}
                  required
                >
                  {registeringHackathon.domains.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <div className="reg-type-selector">
                  <p className="field-label">Participation Format</p>
                  <div className="reg-radio-group">
                    <label className={`radio-pill ${regType === 'individual' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="regType"
                        value="individual"
                        checked={regType === 'individual'}
                        onChange={() => setRegType('individual')}
                      />
                      <div>
                        <strong>Individual Interest</strong>
                        <small>Register individually; form or join a team later.</small>
                      </div>
                    </label>

                    <label className={`radio-pill ${regType === 'team' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="regType"
                        value="team"
                        checked={regType === 'team'}
                        onChange={() => setRegType('team')}
                      />
                      <div>
                        <strong>Team Registration</strong>
                        <small>Link with your existing 2–5 participant team.</small>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="notice-box">
                  <ShieldCheck size={16} />
                  <div>
                    <strong>Independent Payment State</strong>
                    <p>Registration is saved directly to local SQLite. Payment gateway is not finalized (Coming Soon). Registration does not imply payment.</p>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="button button-ghost" onClick={() => setRegisteringHackathon(null)}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={regSubmitting}>
                  {regSubmitting ? 'Saving to Database…' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
