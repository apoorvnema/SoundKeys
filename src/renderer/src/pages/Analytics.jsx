import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'


export default function Analytics() {
  const [activeTab, setActiveTab]   = useState('today') // 'today' | 'trend' | 'heatmap' | 'typing'
  const [summary, setSummary]       = useState({ totalKeys: 0, todayKeys: 0, peakWpm: 0, totalDays: 0 })
  const [hourlyData, setHourlyData] = useState([])
  const [dailyData, setDailyData]   = useState([])
  const [topKeys, setTopKeys]       = useState([])
  const [heatmap, setHeatmap]       = useState({})

  // Typing analytics state
  const [typingStats, setTypingStats]       = useState({ totalTests: 0, personalBest: 0, avgWpm: 0, bestAccuracy: 0 })
  const [typingTrend, setTypingTrend]       = useState([])
  const [typingByDiff, setTypingByDiff]     = useState([])
  const [typingSessions, setTypingSessions] = useState([])

  const loadData = useCallback(async () => {
    if (!window.soundkeys) return
    try {
      const [sum, hr, dl, top, hm, ts, tt, td, tss] = await Promise.all([
        window.soundkeys.getAnalyticsSummary?.() ?? null,
        window.soundkeys.getAnalyticsHourly?.() ?? null,
        window.soundkeys.getAnalyticsDaily?.(30) ?? null,
        window.soundkeys.getAnalyticsTopKeys?.(10) ?? null,
        window.soundkeys.getAnalyticsHeatmap?.() ?? null,
        window.soundkeys.getTypingStats?.() ?? null,
        window.soundkeys.getTypingTrend?.(30) ?? null,
        window.soundkeys.getTypingByDifficulty?.() ?? null,
        window.soundkeys.getTypingSessions?.(50) ?? null
      ])

      if (sum) setSummary(sum)
      if (hr) setHourlyData(hr)
      if (dl) setDailyData(dl)
      if (top) setTopKeys(top)
      if (hm) setHeatmap(hm)
      if (ts) setTypingStats(ts)
      if (tt) setTypingTrend(tt.map((s, i) => ({ ...s, index: i + 1, label: new Date(s.timestamp).toLocaleDateString() })))
      if (td) setTypingByDiff(td)
      if (tss) setTypingSessions(tss)
    } catch (err) {
      console.error('[Analytics] Failed to fetch analytics:', err)
    }
  }, [])

  useEffect(() => {
    loadData()

    // Listen for live key events to refresh counts periodically
    const unsub = window.soundkeys?.onPlaySound(() => {
      setSummary(prev => ({
        ...prev,
        totalKeys: prev.totalKeys + 1,
        todayKeys: prev.todayKeys + 1
      }))
    })

    return () => unsub?.()
  }, [loadData])

  // Calculate max heatmap count for color scaling
  const maxHeatmapCount = Math.max(...Object.values(heatmap), 1)

  return (
    <div className="page analytics-page">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Track your typing activity, peak speeds, and key usage</p>
        </div>
      </div>

      {/* ── Summary Stat Cards ─────────────────────────────── */}
      <div className="analytics-summary-grid">
        <div className="analytics-card">
          <div className="analytics-card-label">Total Keystrokes</div>
          <div className="analytics-card-val text-neon-green">{summary.totalKeys.toLocaleString()}</div>
          <div className="analytics-card-sub">All time recorded</div>
        </div>

        <div className="analytics-card">
          <div className="analytics-card-label">Today's Keystrokes</div>
          <div className="analytics-card-val text-neon-blue">{summary.todayKeys.toLocaleString()}</div>
          <div className="analytics-card-sub">Since midnight</div>
        </div>

        <div className="analytics-card">
          <div className="analytics-card-label">Peak WPM</div>
          <div className="analytics-card-val text-neon-purple">{summary.peakWpm}</div>
          <div className="analytics-card-sub">Words per minute</div>
        </div>

        <div className="analytics-card">
          <div className="analytics-card-label">Active Days</div>
          <div className="analytics-card-val text-neon-orange">{summary.totalDays}</div>
          <div className="analytics-card-sub">Days tracked</div>
        </div>
      </div>

      {/* ── Tab Navigation ──────────────────────────────────── */}
      <div className="analytics-tabs">
        <button
          className={`tab-btn ${activeTab === 'today' ? 'active' : ''}`}
          onClick={() => setActiveTab('today')}
        >
          Hourly Today
        </button>
        <button
          className={`tab-btn ${activeTab === 'trend' ? 'active' : ''}`}
          onClick={() => setActiveTab('trend')}
        >
          30-Day Trend
        </button>
        <button
          className={`tab-btn ${activeTab === 'heatmap' ? 'active' : ''}`}
          onClick={() => setActiveTab('heatmap')}
        >
          Key Frequency & Heatmap
        </button>
        <button
          className={`tab-btn ${activeTab === 'typing' ? 'active' : ''}`}
          onClick={() => setActiveTab('typing')}
        >
          ⌨️ Typing Tests
        </button>
      </div>

      {/* ── Tab Contents ────────────────────────────────────── */}
      <div className="analytics-content-body">
        {/* TODAY HOURLY CHART */}
        {activeTab === 'today' && (
          <div className="chart-section">
            <h3 className="chart-title">Hourly Activity (Today)</h3>
            <div className="chart-container" style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="hour" stroke="#8e8ea0" fontSize={12} />
                  <YAxis stroke="#8e8ea0" fontSize={12} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    contentStyle={{ backgroundColor: '#13131c', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, color: '#fff' }}
                    itemStyle={{ color: '#4ade80', fontWeight: 500 }}
                    labelStyle={{ color: '#ffffff', fontWeight: 700 }}
                  />
                  <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} name="Keystrokes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 30-DAY TREND */}
        {activeTab === 'trend' && (
          <div className="chart-section">
            <h3 className="chart-title">30-Day Keystroke & Speed Trend</h3>
            <div className="chart-container" style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" stroke="#8e8ea0" fontSize={11} />
                  <YAxis yAxisId="left" stroke="#3b82f6" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="#a855f7" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#13131c', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, color: '#fff' }}
                    itemStyle={{ color: '#b06ef3', fontWeight: 500 }}
                    labelStyle={{ color: '#ffffff', fontWeight: 700 }}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="total_keys" stroke="#3b82f6" strokeWidth={2.5} name="Keystrokes" dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="peak_wpm" stroke="#a855f7" strokeWidth={2} name="Peak WPM" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* HEATMAP & TOP KEYS */}
        {activeTab === 'heatmap' && (
          <div className="heatmap-section-grid">
            <div className="chart-card flex-1">
              <h3 className="chart-title">Alphabet Key Heatmap (A–Z)</h3>
              <div className="letter-heatmap-grid">
                {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(char => {
                  const count = heatmap[char] || 0
                  const ratio = count / maxHeatmapCount
                  const opacity = count > 0 ? Math.max(0.2, ratio) : 0.05
                  return (
                    <div
                      key={char}
                      className="heatmap-key-tile"
                      style={{
                        backgroundColor: `rgba(34, 197, 94, ${opacity})`,
                        borderColor: count > 0 ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255,255,255,0.05)'
                      }}
                      title={`${char}: ${count.toLocaleString()} presses`}
                    >
                      <span className="key-letter">{char}</span>
                      <span className="key-count">{count > 0 ? count : ''}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="chart-card flex-1">
              <h3 className="chart-title">Top 10 Most Used Keys</h3>
              <div className="chart-container" style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={topKeys} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis type="number" stroke="#8e8ea0" fontSize={11} />
                    <YAxis dataKey="key_name" type="category" stroke="#8e8ea0" fontSize={12} width={60} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                      contentStyle={{ backgroundColor: '#13131c', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, color: '#fff' }}
                      itemStyle={{ color: '#ec4899', fontWeight: 500 }}
                      labelStyle={{ color: '#ffffff', fontWeight: 700 }}
                    />
                    <Bar dataKey="count" fill="#ec4899" radius={[0, 4, 4, 0]} name="Presses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* TYPING TEST ANALYTICS */}
        {activeTab === 'typing' && (
          <div className="typing-analytics-tab">
            {/* Summary cards */}
            <div className="analytics-summary-grid">
              <div className="analytics-card">
                <div className="analytics-card-label">Personal Best</div>
                <div className="analytics-card-val text-neon-green">{typingStats.personalBest}<span style={{ fontSize: '0.5em' }}> WPM</span></div>
                <div className="analytics-card-sub">All-time highest</div>
              </div>
              <div className="analytics-card">
                <div className="analytics-card-label">Total Tests</div>
                <div className="analytics-card-val text-neon-blue">{typingStats.totalTests}</div>
                <div className="analytics-card-sub">Sessions completed</div>
              </div>
              <div className="analytics-card">
                <div className="analytics-card-label">Average WPM</div>
                <div className="analytics-card-val text-neon-purple">{typingStats.avgWpm}</div>
                <div className="analytics-card-sub">Across all tests</div>
              </div>
              <div className="analytics-card">
                <div className="analytics-card-label">Best Accuracy</div>
                <div className="analytics-card-val text-neon-orange">{typingStats.bestAccuracy ? `${typingStats.bestAccuracy.toFixed(0)}%` : '—'}</div>
                <div className="analytics-card-sub">Highest accuracy test</div>
              </div>
            </div>

            {typingStats.totalTests === 0 ? (
              <div className="library-empty" style={{ marginTop: 32 }}>
                <p style={{ fontSize: '1.1rem' }}>⌨️ No typing tests completed yet.</p>
                <p className="dim-text">Head to the Typing Test page to start a session!</p>
              </div>
            ) : (
              <>
                {/* WPM Trend chart */}
                <div className="chart-section">
                  <h3 className="chart-title">WPM Over Last {typingTrend.length} Sessions</h3>
                  <div className="chart-container" style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer>
                      <LineChart data={typingTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="index" stroke="#8e8ea0" fontSize={11} label={{ value: 'Session #', position: 'insideBottomRight', fill: '#8e8ea0', fontSize: 11 }} />
                        <YAxis stroke="#8e8ea0" fontSize={12} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#13131c', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, color: '#fff' }}
                          itemStyle={{ color: '#4ade80', fontWeight: 500 }}
                          labelStyle={{ color: '#ffffff', fontWeight: 700 }}
                          formatter={(v, name) => [v, name === 'wpm' ? 'WPM' : 'Accuracy %']}
                          labelFormatter={(i) => `Session ${i}`}
                        />
                        <Line type="monotone" dataKey="wpm" stroke="#22c55e" strokeWidth={2.5} name="wpm" dot={{ fill: '#22c55e', r: 3 }} />
                        <Line type="monotone" dataKey="accuracy" stroke="#a855f7" strokeWidth={2} name="accuracy" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Difficulty breakdown */}
                {typingByDiff.length > 0 && (
                  <div className="chart-section">
                    <h3 className="chart-title">Average WPM by Difficulty</h3>
                    <div className="chart-container" style={{ width: '100%', height: 220 }}>
                      <ResponsiveContainer>
                        <BarChart data={typingByDiff}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="difficulty" stroke="#8e8ea0" fontSize={12} />
                          <YAxis stroke="#8e8ea0" fontSize={12} />
                          <Tooltip
                            cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                            contentStyle={{ backgroundColor: '#13131c', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, color: '#ffffff' }}
                            itemStyle={{ color: '#b06ef3', fontWeight: 600, fontSize: '0.92rem' }}
                            labelStyle={{ color: '#ffffff', fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}
                            formatter={(v) => [`${v} WPM`, 'Average WPM']}
                          />
                          <Bar dataKey="avgWpm" radius={[6, 6, 0, 0]} name="Avg WPM">
                            {typingByDiff.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.difficulty === 'easy' ? '#4ade80' : entry.difficulty === 'medium' ? '#facc15' : '#f87171'}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}


                {/* Session history table */}
                <div className="chart-section">
                  <h3 className="chart-title">Session History (Last {typingSessions.length})</h3>
                  <div className="typing-session-table-wrap">
                    <table className="typing-session-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>WPM</th>
                          <th>Accuracy</th>
                          <th>Duration</th>
                          <th>Mode</th>
                          <th>Difficulty</th>
                          <th>Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {typingSessions.map(s => (
                          <tr key={s.id} className={s.isPersonalBest ? 'pb-row' : ''}>
                            <td>{new Date(s.timestamp).toLocaleDateString()}</td>
                            <td className="wpm-cell">{s.wpm} {s.isPersonalBest && <span title="Personal Best">🏆</span>}</td>
                            <td>{s.accuracy ? `${s.accuracy.toFixed(0)}%` : '—'}</td>
                            <td>{s.durationSeconds}s</td>
                            <td><span className="result-badge mode-badge">{s.mode}</span></td>
                            <td><span className={`result-badge difficulty-badge`} data-diff={s.difficulty}>{s.difficulty}</span></td>
                            <td>{s.category || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
