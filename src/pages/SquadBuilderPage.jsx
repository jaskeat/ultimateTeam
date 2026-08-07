import { useEffect, useMemo, useState } from 'react'

const formationRows = [
  {
    key: 'attack',
    title: 'Attack',
    slots: [
      { id: 'lw', label: 'LW', role: 'Left Wing' },
      { id: 'st', label: 'ST', role: 'Striker' },
      { id: 'rw', label: 'RW', role: 'Right Wing' },
    ],
  },
  {
    key: 'midfield',
    title: 'Midfield',
    slots: [
      { id: 'lcm', label: 'CM', role: 'Left Mid' },
      { id: 'cm', label: 'CM', role: 'Centre Mid' },
      { id: 'rcm', label: 'CM', role: 'Right Mid' },
    ],
  },
  {
    key: 'defence',
    title: 'Defence',
    slots: [
      { id: 'lb', label: 'LB', role: 'Left Back' },
      { id: 'lcb', label: 'CB', role: 'Left Centre Back' },
      { id: 'rcb', label: 'CB', role: 'Right Centre Back' },
      { id: 'rb', label: 'RB', role: 'Right Back' },
    ],
  },
  {
    key: 'goalkeeper',
    title: 'Goalkeeper',
    slots: [{ id: 'gk', label: 'GK', role: 'Goalkeeper' }],
  },
]

const squadSlots = formationRows.flatMap((row) => row.slots)
const FAVORITE_PLAYERS_STORAGE_KEY = 'ut-favorite-players-v1'
const LINEUP_STORAGE_KEY = 'ut-team-lineup-v1'
const TEAM_NAME_STORAGE_KEY = 'ut-team-name-v1'

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

function uniquePlayers(players) {
  const seenIds = new Set()

  return players.filter((player) => {
    if (seenIds.has(player.id)) {
      return false
    }

    seenIds.add(player.id)
    return true
  })
}

function getChemistryStats(players) {
  const clubCounts = new Map()
  const nationCounts = new Map()

  for (const player of players) {
    if (player.club) {
      clubCounts.set(player.club, (clubCounts.get(player.club) ?? 0) + 1)
    }

    if (player.nationality) {
      nationCounts.set(player.nationality, (nationCounts.get(player.nationality) ?? 0) + 1)
    }
  }

  const sharedClubLinks = Array.from(clubCounts.values()).reduce((total, count) => total + Math.max(0, count - 1), 0)
  const sharedNationLinks = Array.from(nationCounts.values()).reduce((total, count) => total + Math.max(0, count - 1), 0)

  return {
    sharedClubLinks,
    sharedNationLinks,
    chemistryScore: sharedClubLinks + sharedNationLinks,
  }
}

function SquadBuilderPage({ packedPlayers, playerLoadError, historyResetToken }) {
  const [favoritePlayerIds, setFavoritePlayerIds] = useState(() => readStorageValue(FAVORITE_PLAYERS_STORAGE_KEY, []))
  const [lineup, setLineup] = useState(() => readStorageValue(LINEUP_STORAGE_KEY, {}))
  const [teamName, setTeamName] = useState(() => readStorageValue(TEAM_NAME_STORAGE_KEY, 'My Ultimate XI'))
  const [selectedSlotId, setSelectedSlotId] = useState('st')

  const packedPlayersList = useMemo(() => {
    return Object.values(packedPlayers).sort(comparePlayers)
  }, [packedPlayers])

  const packedPlayersLookup = useMemo(() => {
    return packedPlayersList.reduce((lookup, player) => {
      lookup[player.id] = player
      return lookup
    }, {})
  }, [packedPlayersList])

  const favoritePlayerIdSet = useMemo(() => new Set(favoritePlayerIds), [favoritePlayerIds])

  const favoritePlayers = useMemo(() => {
    return packedPlayersList.filter((player) => favoritePlayerIdSet.has(player.id))
  }, [favoritePlayerIdSet, packedPlayersList])

  const lineupCards = useMemo(() => {
    return squadSlots.map((slot) => ({
      ...slot,
      player: packedPlayersLookup[lineup[slot.id]] ?? null,
    }))
  }, [lineup, packedPlayersLookup])

  const filledLineupPlayers = useMemo(() => {
    return lineupCards.flatMap((slot) => (slot.player ? [slot.player] : []))
  }, [lineupCards])

  const emptySlotCount = squadSlots.length - filledLineupPlayers.length
  const averageOverall = filledLineupPlayers.length
    ? Math.round(filledLineupPlayers.reduce((total, player) => total + player.overall, 0) / filledLineupPlayers.length)
    : 0
  const chemistryStats = useMemo(() => getChemistryStats(filledLineupPlayers), [filledLineupPlayers])
  const selectedSlot = squadSlots.find((slot) => slot.id === selectedSlotId) ?? squadSlots[0]
  const nextAvailableSlotId = squadSlots.find((slot) => !lineup[slot.id])?.id ?? null

  useEffect(() => {
    writeStorageValue(FAVORITE_PLAYERS_STORAGE_KEY, favoritePlayerIds)
  }, [favoritePlayerIds])

  useEffect(() => {
    writeStorageValue(LINEUP_STORAGE_KEY, lineup)
  }, [lineup])

  useEffect(() => {
    writeStorageValue(TEAM_NAME_STORAGE_KEY, teamName)
  }, [teamName])

  useEffect(() => {
    if (historyResetToken === 0) {
      return
    }

    setFavoritePlayerIds([])
    setLineup({})
    setSelectedSlotId('st')
  }, [historyResetToken])

  const toggleFavoritePlayer = (playerId) => {
    setFavoritePlayerIds((current) => {
      if (current.includes(playerId)) {
        return current.filter((id) => id !== playerId)
      }

      return [...current, playerId]
    })
  }

  const removePlayerFromSlot = (slotId) => {
    setLineup((current) => {
      const nextLineup = { ...current }
      delete nextLineup[slotId]
      return nextLineup
    })
  }

  const assignPlayerToSlot = (player, slotId = selectedSlotId ?? nextAvailableSlotId) => {
    if (!player || !slotId) {
      return
    }

    setLineup((current) => {
      const nextLineup = {}

      for (const [currentSlotId, currentPlayerId] of Object.entries(current)) {
        if (currentPlayerId !== player.id) {
          nextLineup[currentSlotId] = currentPlayerId
        }
      }

      nextLineup[slotId] = player.id
      return nextLineup
    })

    setSelectedSlotId(slotId)
  }

  const autoBuildTeam = () => {
    const orderedPlayers = uniquePlayers([...favoritePlayers, ...packedPlayersList]).sort(comparePlayers)

    setLineup(() => {
      const nextLineup = {}
      const usedIds = new Set()

      for (const slot of squadSlots) {
        const player = orderedPlayers.find((candidate) => !usedIds.has(candidate.id))

        if (!player) {
          break
        }

        nextLineup[slot.id] = player.id
        usedIds.add(player.id)
      }

      return nextLineup
    })

    const firstAvailableSlot = squadSlots.find((slot) => !lineup[slot.id])?.id ?? squadSlots[0]?.id ?? 'st'
    setSelectedSlotId(firstAvailableSlot)
  }

  const clearTeam = () => {
    setLineup({})
    setSelectedSlotId('st')
  }

  return (
    <section className="builder-page" aria-labelledby="builder-title">
      <header className="builder-hero">
        <div className="builder-intro">
          <p className="eyebrow">Squad builder</p>
          <h1 id="builder-title">Build your favourite pulls into a starting XI.</h1>
          <p className="store-subkicker">
            Save the players you love, drop them onto the pitch, and keep tuning the squad until it feels right.
          </p>
        </div>

        <div className="builder-tools">
          <label className="team-name-field" htmlFor="team-name-input">
            <span>Team name</span>
            <input
              id="team-name-input"
              type="text"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="My Ultimate XI"
            />
          </label>

          <div className="builder-quick-actions">
            <button type="button" className="builder-action primary" onClick={autoBuildTeam} disabled={packedPlayersList.length === 0}>
              Auto-build with favourites
            </button>
            <button type="button" className="builder-action secondary" onClick={clearTeam} disabled={filledLineupPlayers.length === 0}>
              Clear XI
            </button>
          </div>
        </div>
      </header>

      {playerLoadError ? <p className="catalog-status error">{playerLoadError}</p> : null}

      <div className="builder-stats" aria-label="Squad summary">
        <div className="builder-stat">
          <span>Filled slots</span>
          <strong>{filledLineupPlayers.length}/11</strong>
        </div>
        <div className="builder-stat">
          <span>Average OVR</span>
          <strong>{averageOverall || '—'}</strong>
        </div>
        <div className="builder-stat">
          <span>Favourite pulls</span>
          <strong>{favoritePlayers.length}</strong>
        </div>
        <div className="builder-stat">
          <span>Chemistry links</span>
          <strong>{chemistryStats.chemistryScore}</strong>
        </div>
      </div>

      <div className="builder-grid">
        <section className="pitch-panel">
          <div className="pitch-header">
            <div>
              <p className="eyebrow">Starting XI</p>
              <h2>{teamName || 'My Ultimate XI'}</h2>
            </div>
            <div className="pitch-meta">
              <span>4-3-3 balanced</span>
              <span>{emptySlotCount} slots open</span>
            </div>
          </div>

          <div className="pitch-board">
            {formationRows.map((row) => (
              <section className="pitch-line" key={row.key}>
                <p className="pitch-line-label">{row.title}</p>
                <div className={`pitch-slot-group ${row.slots.length === 1 ? 'single-slot' : ''}`}>
                  {row.slots.map((slot) => {
                    const player = packedPlayersLookup[lineup[slot.id]] ?? null
                    const isSelected = selectedSlotId === slot.id

                    return (
                      <article className={`pitch-slot ${isSelected ? 'selected' : ''} ${player ? 'occupied' : 'empty'}`} key={slot.id}>
                        <div className="pitch-slot-top">
                          <button type="button" className="slot-target-btn" onClick={() => setSelectedSlotId(slot.id)}>
                            {isSelected ? 'Targeted' : 'Select slot'}
                          </button>

                          {player ? (
                            <button type="button" className="slot-clear-btn" onClick={() => removePlayerFromSlot(slot.id)}>
                              Clear
                            </button>
                          ) : null}
                        </div>

                        <button type="button" className="pitch-slot-body" onClick={() => setSelectedSlotId(slot.id)}>
                          {player ? (
                            <>
                              <div className="slot-player-face-wrap">
                                <img src={player.faceUrl} alt={`${player.name} face`} loading="lazy" />
                                <span>{player.overall}</span>
                              </div>
                              <strong>{player.name}</strong>
                              <p>
                                {player.position} · {player.club || 'No club'}
                              </p>
                            </>
                          ) : (
                            <>
                              <span className="slot-placeholder-mark">+</span>
                              <strong>{slot.label}</strong>
                              <p>Click a pulled player to fill this {slot.role.toLowerCase()} slot.</p>
                            </>
                          )}
                        </button>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="builder-note">
            <p>
              Selected slot: <strong>{selectedSlot ? `${selectedSlot.label} - ${selectedSlot.role}` : 'None'}</strong>
            </p>
            <p>Use the list on the right to mark favourites, then place them straight into your XI.</p>
          </div>
        </section>

        <aside className="collection-panel">
          <div className="collection-header">
            <div>
              <p className="eyebrow">Your packed players</p>
              <h2>Favourite picks</h2>
            </div>
            <p>
              Tap the star to save a pull. Use place to assign the player to the selected slot or the next open slot.
            </p>
          </div>

          <div className="favorite-strip" aria-label="Favourite shortlist">
            {favoritePlayers.length > 0 ? (
              favoritePlayers.map((player) => (
                <button key={player.id} type="button" className="favorite-chip" onClick={() => assignPlayerToSlot(player)}>
                  <span>{player.name}</span>
                  <strong>{player.overall}</strong>
                </button>
              ))
            ) : (
              <p className="catalog-status">No favourites yet. Star a pull to keep it in your shortlist.</p>
            )}
          </div>

          <div className="collection-scroll">
            {packedPlayersList.length === 0 ? (
              <p className="catalog-status">Open packs to start building your squad from real pulls.</p>
            ) : (
              packedPlayersList.map((player) => {
                const isFavourite = favoritePlayerIdSet.has(player.id)
                const isOnPitch = lineupCards.some((slot) => slot.player?.id === player.id)

                return (
                  <article key={player.id} className={`builder-player-card ${isFavourite ? 'is-favourite' : ''} ${isOnPitch ? 'is-on-pitch' : ''}`}>
                    <img src={player.faceUrl} alt={`${player.name} face`} loading="lazy" />
                    <div className="builder-player-copy">
                      <div className="builder-player-top">
                        <div>
                          <h3>{player.name}</h3>
                          <p>
                            {player.club || 'Unknown club'} · {player.nationality}
                          </p>
                        </div>
                        <span>{player.overall}</span>
                      </div>

                      <p className="builder-player-position">{player.position}</p>

                      <div className="builder-player-actions">
                        <button type="button" className="builder-mini-button" onClick={() => toggleFavoritePlayer(player.id)}>
                          {isFavourite ? 'Unsave' : 'Favourite'}
                        </button>
                        <button type="button" className="builder-mini-button primary" onClick={() => assignPlayerToSlot(player)}>
                          Place in XI
                        </button>
                      </div>

                      {isOnPitch ? <span className="builder-player-status">Already on the pitch</span> : null}
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}

export default SquadBuilderPage
