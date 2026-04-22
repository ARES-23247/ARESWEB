import React, { useState, useCallback } from 'react';
import {
  parseWPILog,
  calculatePerformanceMetrics,
  analyzeBottlenecks,
 
  extractTimeSeries,
  type ParsedLog,
  type PerformanceMetrics,
  type BottleneckAnalysis,
} from './performance/LogParser';
import './PerformanceDashboard.css';

interface PerformanceDashboardProps {
  className?: string;
}

export default function PerformanceDashboard({ className = '' }: PerformanceDashboardProps) {
  const [log, setLog] = useState<ParsedLog | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [bottlenecks, setBottlenecks] = useState<BottleneckAnalysis[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<'overview' | 'bottlenecks' | 'timeline' | 'details'>('overview');

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Parse the log file
      const parsedLog = await parseWPILog(file);
      setLog(parsedLog);

      // Calculate metrics
      const perfMetrics = calculatePerformanceMetrics(parsedLog);
      setMetrics(perfMetrics);

      // Analyze bottlenecks
      const bottleneckAnalysis = analyzeBottlenecks(parsedLog);
      setBottlenecks(bottleneckAnalysis);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse log file');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const renderOverview = () => {
    if (!metrics || !log) return null;

    return (
      <div className="dashboard-overview">
        <h3>Performance Overview</h3>

        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-title">Loop Time</div>
            <div className="metric-value">{metrics.loopTime.averageMs.toFixed(3)}ms</div>
            <div className="metric-subtitle">Average</div>
            <div className="metric-range">Min: {metrics.loopTime.minMs.toFixed(3)}ms | Max: {metrics.loopTime.maxMs.toFixed(3)}ms</div>
            <div className={`metric-indicator ${metrics.loopTime.averageMs < 10 ? 'good' : metrics.loopTime.averageMs < 20 ? 'warning' : 'critical'}`}>
              {metrics.loopTime.averageMs < 10 ? '✓ Excellent' : metrics.loopTime.averageMs < 20 ? '⚠ Warning' : '❌ Critical'}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-title">CPU Usage</div>
            <div className="metric-value">{metrics.cpuUsage.averagePercent.toFixed(1)}%</div>
            <div className="metric-subtitle">Average</div>
            <div className="metric-range">Min: {metrics.cpuUsage.minPercent.toFixed(1)}% | Max: {metrics.cpuUsage.maxPercent.toFixed(1)}%</div>
            <div className={`metric-indicator ${metrics.cpuUsage.averagePercent < 50 ? 'good' : metrics.cpuUsage.averagePercent < 80 ? 'warning' : 'critical'}`}>
              {metrics.cpuUsage.averagePercent < 50 ? '✓ Excellent' : metrics.cpuUsage.averagePercent < 80 ? '⚠ Warning' : '❌ Critical'}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-title">Memory Usage</div>
            <div className="metric-value">{metrics.memoryUsage.averageMB.toFixed(1)}MB</div>
            <div className="metric-subtitle">Average</div>
            <div className="metric-range">Min: {metrics.memoryUsage.minMB.toFixed(1)}MB | Max: {metrics.memoryUsage.maxMB.toFixed(1)}MB</div>
            <div className={`metric-indicator ${metrics.memoryUsage.averageMB < 100 ? 'good' : metrics.memoryUsage.averageMB < 150 ? 'warning' : 'critical'}`}>
              {metrics.memoryUsage.averageMB < 100 ? '✓ Excellent' : metrics.memoryUsage.averageMB < 150 ? '⚠ Warning' : '❌ Critical'}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-title">Log Duration</div>
            <div className="metric-value">{(log.duration / 1000).toFixed(1)}s</div>
            <div className="metric-subtitle">Recording Time</div>
            <div className="metric-range">Entries: {log.metadata.entryCount.toLocaleString()}</div>
            <div className="metric-indicator good">✓ Complete</div>
          </div>
        </div>
      </div>
    );
  };

  const renderBottlenecks = () => {
    if (bottlenecks.length === 0) return (
      <div className="no-data">
        <p>Upload a log file to see bottleneck analysis</p>
      </div>
    );

    return (
      <div className="dashboard-bottlenecks">
        <h3>Bottleneck Analysis</h3>
        <div className="bottleneck-list">
          {bottlenecks.map((bottleneck, index) => (
            <div key={index} className={`bottleneck-card severity-${bottleneck.severity}`}>
              <div className="bottleneck-header">
                <span className="severity-icon">
                  {bottleneck.severity === 'high' ? '🔴' : bottleneck.severity === 'medium' ? '🟡' : '🟢'}
                </span>
                <span className="bottleneck-category">{bottleneck.category}</span>
              </div>
              <div className="bottleneck-metric">{bottleneck.metric}</div>
              <div className="bottleneck-stats">
                <div className="stat">
                  <span className="stat-label">Avg:</span>
                  <span className="stat-value">{bottleneck.avgTimeMs.toFixed(3)}ms</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Max:</span>
                  <span className="stat-value">{bottleneck.maxTimeMs.toFixed(3)}ms</span>
                </div>
                <div className="stat">
                  <span className="stat-label">% of Total:</span>
                  <span className="stat-value">{bottleneck.percentOfTotal.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTimeline = () => {
    if (!log) return (
      <div className="no-data">
        <p>Upload a log file to see timeline analysis</p>
      </div>
    );

    const loopTimeData = extractTimeSeries(log, 'Perf/LoopTimeMs');

    if (loopTimeData.length === 0) {
      return (
        <div className="no-data">
          <p>No loop time data found in log file</p>
        </div>
      );
    }

    return (
      <div className="dashboard-timeline">
        <h3>Performance Timeline</h3>
        <div className="timeline-chart">
          <div className="timeline-info">
            <span>Loop Time Over Log Duration</span>
            <span>{loopTimeData.length} data points</span>
          </div>
          <svg viewBox={`0 0 ${loopTimeData.length} 200`} className="timeline-svg">
            {/* Grid lines */}
            {[0, 5, 10, 15, 20].map(y => (
              <line key={y} x1="0" y1={y} x2={loopTimeData.length} y2={y} stroke="#333" strokeWidth="1" />
            ))}

            {/* Timeline bars */}
            {loopTimeData.map((point, index) => {
              const height = Math.min(point.value * 2, 150); // Scale: 1ms = 2px height
              const color = point.value < 5 ? '#4CAF50' : point.value < 10 ? '#FFC107' : '#F44336';

              return (
                <rect
                  key={index}
                  x={index}
                  y={180 - height}
                  width="2"
                  height={height}
                  fill={color}
                  opacity="0.8"
                  data-time={point.time}
                  data-value={point.value}
                  className="timeline-bar"
                />
              );
            })}

            {/* 10ms threshold line */}
            <line x1="0" y1={160} x2={loopTimeData.length} y2={160} stroke="#FF5722" strokeWidth="2" strokeDasharray="5,5" opacity="0.5"/>
            <text x={loopTimeData.length - 50} y={155} fill="#FF5722" fontSize="10">10ms threshold</text>
          </svg>

          {/* Interactive tooltip area */}
          <div className="timeline-legend">
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#4CAF50' }}></span>
              <span className="legend-label">Good (&lt;5ms)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#FFC107' }}></span>
              <span className="legend-label">Warning (5-10ms)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#F44336' }}></span>
              <span className="legend-label">Critical (&gt;10ms)</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDetails = () => {
    if (!log) return (
      <div className="no-data">
        <p>Upload a log file to see detailed analysis</p>
      </div>
    );

    return (
      <div className="dashboard-details">
        <h3>Log File Details</h3>
        <div className="details-list">
          <div className="detail-item">
            <span className="detail-label">Filename:</span>
            <span className="detail-value">{log.metadata.filename}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">File Size:</span>
            <span className="detail-value">{(log.metadata.fileSize / 1024 / 1024).toFixed(2)}MB</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Duration:</span>
            <span className="detail-value">{(log.duration / 1000).toFixed(2)}s</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Total Entries:</span>
            <span className="detail-value">{log.metadata.entryCount.toLocaleString()}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Unique Keys:</span>
            <span className="detail-value">{log.metadata.uniqueKeys}</span>
          </div>
        </div>

        {metrics && (
          <div className="detailed-metrics">
            <h4>Detailed Metrics</h4>
            <div className="metrics-table">
              <table>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Average</th>
                    <th>Min</th>
                    <th>Max</th>
                    <th>Std Dev</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Loop Time</td>
                    <td>{metrics.loopTime.averageMs.toFixed(3)}ms</td>
                    <td>{metrics.loopTime.minMs.toFixed(3)}ms</td>
                    <td>{metrics.loopTime.maxMs.toFixed(3)}ms</td>
                    <td>{metrics.loopTime.stdDevMs.toFixed(3)}ms</td>
                  </tr>
                  <tr>
                    <td>CPU Usage</td>
                    <td>{metrics.cpuUsage.averagePercent.toFixed(1)}%</td>
                    <td>{metrics.cpuUsage.minPercent.toFixed(1)}%</td>
                    <td>{metrics.cpuUsage.maxPercent.toFixed(1)}%</td>
                    <td>{metrics.cpuUsage.stdDevPercent.toFixed(1)}%</td>
                  </tr>
                  <tr>
                    <td>Memory Usage</td>
                    <td>{metrics.memoryUsage.averageMB.toFixed(1)}MB</td>
                    <td>{metrics.memoryUsage.minMB.toFixed(1)}MB</td>
                    <td>{metrics.memoryUsage.maxMB.toFixed(1)}MB</td>
                    <td>{metrics.memoryUsage.stdDevMB.toFixed(1)}MB</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`performance-dashboard ${className}`}>
      {/* Header */}
      <div className="dashboard-header">
        <h2>🔧 MARSLib Performance Dashboard</h2>
        <div className="upload-section">
          <label className="upload-label">
            <input
              type="file"
              accept=".wpilog"
              onChange={handleFileUpload}
              disabled={isProcessing}
              className="file-input"
            />
            <span className="upload-button">
              {isProcessing ? '⏳ Processing...' : '📁 Upload .wpilog File'}
            </span>
          </label>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {/* Tab Navigation */}
      {log && (
        <div className="tab-navigation">
          <button
            className={`tab ${selectedView === 'overview' ? 'active' : ''}`}
            onClick={() => setSelectedView('overview')}
          >
            📊 Overview
          </button>
          <button
            className={`tab ${selectedView === 'bottlenecks' ? 'active' : ''}`}
            onClick={() => setSelectedView('bottlenecks')}
          >
            🎯 Bottlenecks
          </button>
          <button
            className={`tab ${selectedView === 'timeline' ? 'active' : ''}`}
            onClick={() => setSelectedView('timeline')}
          >
            📈 Timeline
          </button>
          <button
            className={`tab ${selectedView === 'details' ? 'active' : ''}`}
            onClick={() => setSelectedView('details')}
          >
            📋 Details
          </button>
        </div>
      )}

      {/* Content */}
      <div className="dashboard-content">
        {!log && (
          <div className="upload-prompt">
            <div className="upload-icon">📊</div>
            <h3>Ready to Analyze Performance</h3>
            <p>Upload an AdvantageKit .wpilog file to see detailed performance analysis</p>
            <div className="upload-features">
              <div className="feature">✓ Loop time analysis</div>
              <div className="feature">✓ Bottleneck identification</div>
              <div className="feature">✓ Performance metrics</div>
              <div className="feature">✓ Timeline visualization</div>
            </div>
          </div>
        )}

        {log && selectedView === 'overview' && renderOverview()}
        {log && selectedView === 'bottlenecks' && renderBottlenecks()}
        {log && selectedView === 'timeline' && renderTimeline()}
        {log && selectedView === 'details' && renderDetails()}
      </div>

      {/* Footer */}
      {log && metrics && (
        <div className="dashboard-footer">
          <div className="recommendations">
            <strong>Recommendations:</strong>
            {metrics.loopTime.averageMs > 10 && (
              <span className="recommendation critical">
                ⚠️ High loop time detected. Consider optimizing expensive operations.
              </span>
            )}
            {metrics.cpuUsage.averagePercent > 80 && (
              <span className="recommendation warning">
                ⚠️ High CPU usage. Check for computational bottlenecks.
              </span>
            )}
            {metrics.memoryUsage.maxMB - metrics.memoryUsage.minMB > 20 && (
              <span className="recommendation warning">
                ⚠️ Significant memory growth. Check for allocations in periodic().
              </span>
            )}
            {metrics.loopTime.averageMs < 5 && metrics.cpuUsage.averagePercent < 50 && metrics.memoryUsage.averageMB < 100 && (
              <span className="recommendation good">
                ✅ Excellent performance! Your robot is running efficiently.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
