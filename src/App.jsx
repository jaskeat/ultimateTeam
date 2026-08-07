import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import './App.css'
import SquadBuilderPage from './pages/SquadBuilderPage.jsx'

const packs = [
  {
    name: 'Classic Pack',
    price: '750',
    rarity: 'Standard odds',
    gradient: 'bronze',
    chance: '40% 85+ OVR',
  },
  {
    name: 'Premium Gold Pack',
    price: '7,500 or 150',
    rarity: 'Better odds',
    gradient: 'gold',
    chance: '65% 85+ OVR',
  },
  {
    name: 'Elite Gold Pack',
    price: '7,500 or 150',
    rarity: 'High value',
    gradient: 'gold-shine',
    chance: '80% 85+ OVR',
  },
  {
    name: 'Icon Pack',
    price: '3,750 or 75',
    rarity: 'Locked tier',
    gradient: 'silver',
    chance: '70% 85+ OVR',
  },
]

const PACKED_PLAYERS_STORAGE_KEY = 'ut-packed-players-v1'

function readStorageValue(key, fallback) {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(key)

    if (!raw) {
      return fallback
    }

    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function writeStorageValue(key, value) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

function comparePlayers(left, right) {
  return right.overall - left.overall || (right.count ?? 0) - (left.count ?? 0) || left.name.localeCompare(right.name)
}

function getPrimaryPosition(value) {
  if (!value) {
    return '—'
  }

  return String(value)
    .split(',')
    .map((position) => position.trim())
    .filter(Boolean)[0] ?? '—'
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

function getPackRevealPlayer(packName, players) {
  if (!players.length) {
    return null
  }

  if (packName === 'Elite Gold Pack') {
    const eliteTierPools = [
      { minOverall: 90, chance: 0.03 },
      { minOverall: 80, chance: 0.3 },
      { minOverall: 70, chance: 0.67 },
    ]

    const roll = Math.random()
    let cumulativeChance = 0

    for (const tier of eliteTierPools) {
      cumulativeChance += tier.chance

      if (roll <= cumulativeChance) {
        const tierPlayers = players.filter((player) => player.overall >= tier.minOverall)

        if (tierPlayers.length > 0) {
          const index = Math.floor(Math.random() * tierPlayers.length)
          return tierPlayers[index]
        }
      }
    }
  }

  const highRatedPlayers = players.filter((player) => player.overall >= 85)
  const highRatedOdds = {
    'Icon Pack': 0.7,
    'Elite Gold Pack': 0.5,
    'Premium Gold Pack': 0.3,
    'Classic Pack': 0.1,
  }
  const maxTierRatios = {
    'Icon Pack': 0.05,
    'Elite Gold Pack': 0.08,
    'Premium Gold Pack': 0.2,
    'Classic Pack': 0.6,
  }

  const useHighRatedPool = highRatedPlayers.length > 0 && Math.random() < (highRatedOdds[packName] ?? 0.5)
  const pool = useHighRatedPool ? highRatedPlayers : players
  const maxRatio = maxTierRatios[packName] ?? 0.5
  const index = Math.min(Math.floor(pool.length * Math.random() * maxRatio), pool.length - 1)

  return pool[index] ?? players[0]
}

function App() {
  const [activePage, setActivePage] = useState('team-builder')
  const [selectedPackName, setSelectedPackName] = useState(packs[0].name)
  const [openingRun, setOpeningRun] = useState(0)
  const [players, setPlayers] = useState([])
  const [playerLoadError, setPlayerLoadError] = useState('')
  const [pullCount, setPullCount] = useState(0)
  const [revealedPlayer, setRevealedPlayer] = useState(null)
  const [packedPlayers, setPackedPlayers] = useState(() => readStorageValue(PACKED_PLAYERS_STORAGE_KEY, {}))
  const [historyResetToken, setHistoryResetToken] = useState(0)

  const packOptions = packs.map((pack) => ({
    ...pack,
    locked: pack.name === 'Icon Pack' ? pullCount < 10 : false,
  }))
  const selectedPack = packOptions.find((pack) => pack.name === selectedPackName) ?? packOptions[0]

  const packedPlayersList = useMemo(() => {
    return Object.values(packedPlayers).sort(comparePlayers)
  }, [packedPlayers])

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
      } catch {
        if (!cancelled) {
          setPlayerLoadError('Unable to load the player catalog.')
        }
      }
    }

    loadPlayers()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    writeStorageValue(PACKED_PLAYERS_STORAGE_KEY, packedPlayers)
  }, [packedPlayers])

  const trackPackedPlayer = (player) => {
    if (!player) {
      return
    }

    setPackedPlayers((current) => {
      const existingEntry = current[player.id]
      const updatedEntry = {
        id: player.id,
        name: player.name,
        overall: player.overall,
        club: player.club,
        nationality: player.nationality,
        faceUrl: player.faceUrl,
        count: (existingEntry?.count ?? 0) + 1,
      }

      return {
        ...current,
        [player.id]: updatedEntry,
      }
    })
  }

  const handlePackOpen = (pack) => {
    if (pack.locked || players.length === 0) {
      return
    }

    const nextRevealPlayer = getPackRevealPlayer(pack.name, players)

    setSelectedPackName(pack.name)
    setOpeningRun((current) => current + 1)
    setRevealedPlayer(nextRevealPlayer)
    trackPackedPlayer(nextRevealPlayer)

    if (pack.name === 'Icon Pack') {
      setPullCount(0)
      return
    }

    setPullCount((current) => current + 1)
  }

  const clearPackedHistory = () => {
    setPackedPlayers({})
    setHistoryResetToken((current) => current + 1)
  }

  const totalPackedCount = useMemo(() => {
    return packedPlayersList.reduce((total, player) => total + player.count, 0)
  }, [packedPlayersList])

  const renderOpenPacksPage = () => {
    return (
      <>
        <header className="content-header">
          <p className="eyebrow">Pack opening</p>
          <h1 id="opening-title">Open a pack and reveal your next player.</h1>
          <p className="store-subkicker">
            Pulls: {pullCount}/10 · {Math.max(0, 10 - pullCount)} to Icon Pack
          </p>
          {playerLoadError ? <p className="catalog-status error">{playerLoadError}</p> : null}
        </header>

        <div className="pack-grid">
          {packOptions.map((pack) => (
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

        <section className="opening-stage">
          <div className="opening-demo" key={openingRun} aria-hidden="true">
            <div className="open-pack">
              <span className="pack-tear pack-tear-left"></span>
              <span className="pack-tear pack-tear-right"></span>
              <span className="pack-front">UT</span>
            </div>

            <div className="reveal-track">
              <div className="reveal-step nation-step">
                <span className="reveal-label">Nationality</span>
                <strong>{revealedPlayer ? revealedPlayer.nationality : 'Open a pack'}</strong>
              </div>
              <div className="reveal-step position-step">
                <span className="reveal-label">Position</span>
                <strong>{revealedPlayer ? revealedPlayer.position : 'Open a pack'}</strong>
              </div>
              <div className="reveal-step card-step">
                {revealedPlayer ? (
                  <article className={`player-card reveal-card ${selectedPack.gradient}`}>
                    <div className="player-face-wrap">
                      <img className="player-face" src={revealedPlayer.faceUrl} alt={`${revealedPlayer.name} face`} loading="lazy" />
                      <span className="player-overall">{revealedPlayer.overall}</span>
                    </div>
                    <h3>{revealedPlayer.name}</h3>
                    <p>{revealedPlayer.club}</p>
                    <div className="card-meta">
                      <span>{revealedPlayer.nationality}</span>
                      <span>{revealedPlayer.position}</span>
                    </div>
                  </article>
                ) : (
                  <div className="reveal-loading">Open a pack to reveal and track a player.</div>
                )}
              </div>
            </div>
          </div>
        </section>
      </>
    )
  }

  const renderHistoryPage = () => {
    return (
      <section className="tracker-section" aria-labelledby="tracker-title">
        <div className="tracker-header">
          <div>
            <p className="eyebrow">Pack tracker</p>
            <h2 id="tracker-title">Packed players history</h2>
            <p className="tracker-stats">
              Total packed: {totalPackedCount} · Unique players: {packedPlayersList.length}
            </p>
          </div>
          <button type="button" className="clear-history-btn" onClick={clearPackedHistory} disabled={packedPlayersList.length === 0}>
            Clear history
          </button>
        </div>

        {packedPlayersList.length === 0 ? (
          <p className="catalog-status">No players tracked yet. Open a pack to start tracking.</p>
        ) : (
          <div className="packed-table-wrap">
            <table className="packed-table">
              <thead>
                <tr>
                  <th scope="col">Player</th>
                  <th scope="col">Overall</th>
                  <th scope="col">Club</th>
                  <th scope="col">Nationality</th>
                  <th scope="col">Packed</th>
                </tr>
              </thead>
              <tbody>
                {packedPlayersList.map((player) => (
                  <tr key={player.id}>
                    <td className="player-cell">
                      <img src={player.faceUrl} alt={`${player.name} face`} loading="lazy" />
                      <span>{player.name}</span>
                    </td>
                    <td>{player.overall}</td>
                    <td>{player.club || 'Unknown'}</td>
                    <td>{player.nationality}</td>
                    <td>{player.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    )
  }

  return (
    <div className="store-shell">
      <main className="content-area" id="store">
        <nav className="page-tabs" aria-label="Pages">
          <button
            type="button"
            className={`page-tab ${activePage === 'team-builder' ? 'active' : ''}`}
            onClick={() => setActivePage('team-builder')}
          >
            Squad Builder
          </button>
          <button
            type="button"
            className={`page-tab ${activePage === 'open-packs' ? 'active' : ''}`}
            onClick={() => setActivePage('open-packs')}
          >
            Open Packs
          </button>
          <button
            type="button"
            className={`page-tab ${activePage === 'pack-history' ? 'active' : ''}`}
            onClick={() => setActivePage('pack-history')}
          >
            Pack History
          </button>
        </nav>

        {activePage === 'team-builder'
          ? (
            <SquadBuilderPage packedPlayers={packedPlayers} playerLoadError={playerLoadError} historyResetToken={historyResetToken} />
            )
          : activePage === 'open-packs'
            ? renderOpenPacksPage()
            : renderHistoryPage()}
      </main>
    </div>
  )
}

export default App
