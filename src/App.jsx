import { useEffect, useState } from 'react'
import Papa from 'papaparse'
import './App.css'

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

function getPrimaryPosition(value) {
  if (!value) {
    return '—'
  }

  return String(value)
    .split(',')
    .map((position) => position.trim())
    .filter(Boolean)[0] ?? '—'
}

function getPackRevealPlayer(packName, players) {
  if (!players.length) {
    return null
  }

  if (packName === 'Elite Gold Pack') {
    const eliteTierPools = [
      { minOverall: 90, chance: 0.03 },
      { minOverall: 80, chance: 0.3
      },
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

  const highRatedThreshold = 85
  const highRatedPlayers = players.filter((player) => player.overall >= highRatedThreshold)

  const highRatedOdds = {
    'Icon Pack': 0.70,
    'Elite Gold Pack': 0.50,
    'Premium Gold Pack': 0.30,
    'Classic Pack': 0.1
    ,
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
  const randomRatio = Math.random() * maxRatio
  const index = Math.floor(pool.length * randomRatio)

  return pool[Math.min(index, pool.length - 1)] ?? players[0]
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
  const [selectedPackName, setSelectedPackName] = useState(packs[0].name)
  const [openingRun, setOpeningRun] = useState(0)
  const [players, setPlayers] = useState([])
  const [playerLoadError, setPlayerLoadError] = useState('')
  const [pullCount, setPullCount] = useState(0)

  const packOptions = packs.map((pack) => ({
    ...pack,
    locked: pack.name === 'Icon Pack' ? pullCount < 10 : false,
  }))
  const selectedPack = packOptions.find((pack) => pack.name === selectedPackName) ?? packOptions[0]
  const revealPlayer = getPackRevealPlayer(selectedPack.name, players)

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

    setSelectedPackName(pack.name)
    setOpeningRun((current) => current + 1)

    if (pack.name === 'Icon Pack') {
      setPullCount(0)
      return
    }

    setPullCount((current) => current + 1)
  }

  

  return (
    <div className="store-shell">
      <main className="content-area" id="store" aria-labelledby="opening-title">
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
      </main>
    </div>
  )
}

export default App
