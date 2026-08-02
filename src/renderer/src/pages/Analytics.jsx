import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

export default function Analytics() {
  const [activeTab, setActiveTab]   = useState('today') // 'today' | 'trend' | 'heatmap'
  const [summary, setSummary]       = useState({ totalKeys: 0, todayKeys: 0, peakWpm: 0, totalDays: 0 })
  const [hourlyData, setHourlyData] = useState([])
  const [dailyData, setDailyData]   = useState([])
  const [topKeys, setTopKeys]       = useState([])
  const [heatmap, setHeatmap]       = useState({})

  const loadData = useCallback(async () => {
    if (!window.soundkeys) return
    try {
      const [sum, hr, dl, top, hm] = await Promise.all([
        window.soundkeys.getAnalyticsSummary(),
        window.soundkeys.getAnalyticsHourly(),
        window.soundkeys.getAnalyticsDaily(30),
        window.soundkeys.getAnalyticsTopKeys(10),
        window.soundkeys.getAnalyticsHeatmap()
      ])

      if (sum) setSummary(sum)
      if (hr) setHourlyData(hr)
      if (dl) setDailyData(dl)
      if (top) setTopKeys(top)
      if (hm) setHeatmap(hm)
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
                    contentStyle={{ backgroundColor: '#13131c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
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
                    contentStyle={{ backgroundColor: '#13131c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
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
                      contentStyle={{ backgroundColor: '#13131c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }}
                    />
                    <Bar dataKey="count" fill="#ec4899" radius={[0, 4, 4, 0]} name="Presses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
