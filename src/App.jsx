import { useEffect, useState } from 'react'
import Papa from 'papaparse'
import './App.css'

const packs = [
  {
    name: 'Classic Pack',
    price: '750',
    rarity: 'Standard odds',
    gradient: 'bronze',
    chance: '75% 60-79 OVR',
  },
  {
    name: 'Premium Gold Pack',
    price: '7,500 or 150',
    rarity: 'Better odds',
    gradient: 'gold',
    chance: '32% 80-86 OVR',
  },
  {
    name: 'Elite Gold Pack',
    price: '7,500 or 150',
    rarity: 'High value',
    gradient: 'gold-shine',
    chance: '18% 87-91 OVR',
  },
  {
    name: 'Icon Pack',
    price: '3,750 or 75',
    rarity: 'Locked tier',
    gradient: 'silver',
    chance: 'Top ratings only',
    locked: true,
  },
]

function getPrimaryPosition(value) {
  if (!value) {
    return '—'
  }

  return String(value)
    .split(',')
    .map((position) => position.trim())
    .filter(Boolean)[0] ?? '—'
}

function getPackRevealIndex(packName, totalPlayers) {
  if (!totalPlayers) {
    return 0
  }

  // Ratios represent the MAXIMUM allowed index boundary (% of top players)
  // Index 0 = Absolute Best Player in Database
  const maxTierRatios = {
    'Icon Pack': 0.02,        // Top 2% (Indices 0 to ~2% of database)
    'Elite Gold Pack': 0.01,   // Top 10% (Indices 0 to ~10% of database)
    'Premium Gold Pack': 0.35, // Top 35%
    'Classic Pack': 0.85,      // Top 85%
  }

  const maxRatio = maxTierRatios[packName] ?? 0.5

  // Pick a random ratio between 0.0 (Best player) and maxRatio
  const randomRatio = Math.random() * maxRatio

  const index = Math.floor(totalPlayers * randomRatio)

  // Clamp within valid bounds
  return Math.min(index, totalPlayers - 1)
}

function normalizePlayer(row, index) {
  const overall = Number.parseInt(row.overall, 10)

  return {
    id: row.sofifa_id || `${row.short_name || 'player'}-${index}`,
    name: row.short_name || row.long_name || 'Unknown player',
    longName: row.long_name || row.short_name || 'Unknown player',
    overall: Number.isNaN(overall) ? 0 : overall,
    position: getPrimaryPosition(row.player_positions || row.club_position),
    nationality: row.nationality_name || 'Unknown',
    nationFlagUrl: row.nation_flag_url || row.club_flag_url || '',
    faceUrl: row.player_face_url || '',
    club: row.club_name || '',
  }
}

function App() {
  const [selectedPack, setSelectedPack] = useState(packs[0])
  const [openingRun, setOpeningRun] = useState(0)
  const [players, setPlayers] = useState([])
  const [loadingPlayers, setLoadingPlayers] = useState(true)
  const [playerLoadError, setPlayerLoadError] = useState('')

    const revealIndex = getPackRevealIndex(selectedPack.name, players.length)
  const revealPlayer = players[revealIndex]
  const catalogPlayers = players
  console.log(players)
  useEffect(() => {
    let cancelled = false

    const loadPlayers = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}players_22.csv`)

        if (!response.ok) {
          throw new Error(`Failed to load players_22.csv (${response.status})`)
        }

        const csv = await response.text()
        const parsed = Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
        })

        if (parsed.errors.length > 0) {
          throw new Error(parsed.errors[0].message)
        }

        const normalizedPlayers = parsed.data
          .map((row, index) => normalizePlayer(row, index))
          .filter((player) => player.name && player.nationFlagUrl)
          .sort((left, right) => right.overall - left.overall || left.name.localeCompare(right.name))

        if (!cancelled) {
          setPlayers(normalizedPlayers)
        }
      } catch (error) {
        if (!cancelled) {
          setPlayerLoadError('Unable to load the player catalog.')
        }
      } finally {
        if (!cancelled) {
          setLoadingPlayers(false)
        }
      }
    }

    loadPlayers()

    return () => {
      cancelled = true
    }
  }, [])

  const handlePackOpen = (pack) => {
    if (pack.locked) {
      return
    }
    
    setSelectedPack(pack)
    setOpeningRun((current) => current + 1)
  }

  

  return (
    <div className="store-shell">
      <header className="store-topbar">
        <div className="store-brand">
          <span className="store-badge">UT</span>
          <div>
            <p className="store-kicker">Ultimate Team</p>
            <p className="store-subkicker">Pack Opening Store</p>
          </div>
        </div>

        <nav className="store-nav" aria-label="Store navigation">
          <a href="#store" className="active">
            Home
          </a>
          <a href="#catalog">Players</a>
          <a href="#my-packs">My Packs</a>
        </nav>

        <div className="store-wallet" aria-label="Currency summary">
          <span>UT 2,169,832</span>
          <span>♦ 61,275</span>
          <span>SP 27,150/28,000</span>
        </div>
      </header>

      <main className="store-layout" id="store">
        <aside className="sidebar" aria-label="Pack categories">
          {[
            'Featured',
            'Promo Packs',
            'Classic Packs',
            'Provisions',
            'Packs For You',
            'Season 1 Stadium Items',
            'Season 1 Stadium Bundles',
            'Season 3 Stadium Items',
            'Season 3 Stadium Bundles',
          ].map((section) => (
            <button
              key={section}
              type="button"
              className={section === 'Classic Packs' ? 'sidebar-item active' : 'sidebar-item'}
            >
              {section}
            </button>
          ))}
        </aside>

        <section className="content-area" aria-labelledby="packs-title">
          <div className="content-header">
            <p className="eyebrow">Featured store</p>
            <h1 id="packs-title">Classic Packs</h1>
          </div>

          <div className="pack-grid">
            {packs.map((pack) => (
              <button
                key={pack.name}
                type="button"
                className={`pack-card ${pack.gradient} ${selectedPack.name === pack.name ? 'selected' : ''}`}
                onClick={() => handlePackOpen(pack)}
              >
                <div className="pack-top">
                  <span className="pack-ribbon">UT</span>
                  {pack.locked ? <span className="pack-lock">Locked until 10 regular pulls</span> : null}
                </div>
                <div className="pack-art" aria-hidden="true">
                  <span>UT</span>
                </div>
                <div className="pack-meta">
                  <h2>{pack.name}</h2>
                  <p>{pack.rarity}</p>
                  <div className="pack-price">
                    <span className="coin">◉</span>
                    <strong>{pack.price}</strong>
                  </div>
                  <p className="pack-chance">{pack.chance}</p>
                </div>
              </button>
            ))}
          </div>

          <section className="pack-banner">
            <div>
              <p className="eyebrow">Odds and access</p>
              <h2>
                Higher overall ratings stay rare, and premium packs stay locked until you earn them.
              </h2>
            </div>
            <div className="banner-copy">
              <p>
                Regular packs feed the unlock track. Every 10 pulls, a new special pack tier becomes
                available with stronger chances at high OVR players.
              </p>
            </div>
          </section>

          <section className="opening-stage" aria-labelledby="opening-title">
            <div className="section-title">
              <p className="eyebrow">Pack opening</p>
              <h2 id="opening-title">Tear open the pack, then watch the reveal unfold.</h2>
            </div>

            <div className="opening-demo" key={openingRun} aria-hidden="true">
              <div className="open-pack">
                <span className="pack-tear pack-tear-left"></span>
                <span className="pack-tear pack-tear-right"></span>
                <span className="pack-front">UT</span>
              </div>

              <div className="reveal-track">
                <div className="reveal-step nation-step">
                  <span className="reveal-label">Nationality</span>
                  <strong>{revealPlayer ? revealPlayer.nationality : 'Loading'}</strong>
                </div>
                <div className="reveal-step position-step">
                  <span className="reveal-label">Position</span>
                  <strong>{revealPlayer ? revealPlayer.position : 'Loading'}</strong>
                </div>
                <div className="reveal-step card-step">
                  {revealPlayer ? (
                    <article className={`player-card reveal-card ${selectedPack.gradient}`}>
                      <div className="player-face-wrap">
                        <img
                          className="player-face"
                          src={revealPlayer.faceUrl}
                          alt={`${revealPlayer.name} face`}
                          loading="lazy"
                        />
                        <span className="player-overall">{revealPlayer.overall}</span>
                      </div>
                      <h3>{revealPlayer.name}</h3>
                      <p>{revealPlayer.club}</p>
                      <div className="card-meta">
                        <span>{revealPlayer.nationality}</span>
                        <span>{revealPlayer.position}</span>
                      </div>
                    </article>
                  ) : (
                    <div className="reveal-loading">Loading player data...</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="player-preview" id="catalog">
            <div className="section-title">
              <p className="eyebrow">Player catalog</p>
              <h2>All players from the dataset, shown as collectible cards.</h2>
            </div>

            {loadingPlayers ? (
              <p className="catalog-status">Loading player catalog...</p>
            ) : playerLoadError ? (
              <p className="catalog-status error">{playerLoadError}</p>
            ) : (
              <div className="catalog-grid">
                {catalogPlayers.map((player) => (
                  <article className="catalog-card" key={player.id}>
                    <div className="catalog-face-frame">
                      <img
                        className="catalog-face"
                        src={player.faceUrl}
                        alt={`${player.name} face`}
                        loading="lazy"
                      />
                      <span className="catalog-overall">{player.overall}</span>
                    </div>
                    <div className="catalog-meta">
                      <h3>{player.name}</h3>
                      <div className="catalog-nationality">
                        <img
                          className="catalog-flag"
                          src={player.nationFlagUrl}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                        />
                        <span>{player.nationality}</span>
                      </div>
                      <p>{player.position}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  )
}

export default App
