/**
 * WPILog Parsing Utilities
 *
 * Parse AdvantageKit log files (.wpilog) for robot performance analysis.
 * These utilities extract telemetry data for performance analysis and debugging.
 */

export interface LogEntry {
  timestamp: number;
  key: string;
  value: number | string | boolean | number[];
  dataType: 'number' | 'string' | 'boolean' | 'number[]';
}

export interface ParsedLog {
  entries: LogEntry[];
  startTime: number;
  endTime: number;
  duration: number;
  metadata: {
    filename: string;
    fileSize: number;
    entryCount: number;
    uniqueKeys: number;
  };
}

export interface PerformanceMetrics {
  loopTime: {
    averageMs: number;
    maxMs: number;
    minMs: number;
    stdDevMs: number;
  };
  cpuUsage: {
    averagePercent: number;
    maxPercent: number;
    minPercent: number;
    stdDevPercent: number;
  };
  memoryUsage: {
    averageMB: number;
    maxMB: number;
    minMB: number;
    stdDevMB: number;
  };
}

export interface BottleneckAnalysis {
  category: string;
  metric: string;
  avgTimeMs: number;
  maxTimeMs: number;
  percentOfTotal: number;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Parse WPILog file and extract all entries
 */
export async function parseWPILog(file: File): Promise<ParsedLog> {
  const arrayBuffer = await file.arrayBuffer();
  const dataView = new DataView(arrayBuffer);

  // WPILog format: AdvantageKit binary format
  // This is a simplified parser - real format is more complex

  const entries: LogEntry[] = [];
  let startTime = Infinity;
  let endTime = -Infinity;
  const uniqueKeys = new Set<string>();

  try {
    // For now, we'll create a mock parser since WPILog format is complex
    // In production, this would use the actual AdvantageKit log format

    // Parse basic structure
    const entryCount = Math.floor(arrayBuffer.byteLength / 100); // Rough estimate

    for (let i = 0; i < Math.min(entryCount, 10000); i++) {
      const offset = i * 100;
      if (offset + 20 > arrayBuffer.byteLength) break;

      const timestamp = dataView.getFloat64(offset, true); // Little-endian
      dataView.getUint8(offset + 8); // keyLength
      const valueType = dataView.getUint8(offset + 9);

      let value: number | string | boolean | number[];
      let dataType: 'number' | 'string' | 'boolean' | 'number[]';

      switch (valueType) {
        case 0: { // number
          value = dataView.getFloat64(offset + 10, true);
          dataType = 'number';
          break;
        }
        case 1: { // string
          dataView.getUint8(offset + 10); // strLength
          // In real implementation, would read string bytes
          value = `Entry_${i}`;
          dataType = 'string';
          break;
        }
        case 2: { // boolean
          value = dataView.getUint8(offset + 10) === 1;
          dataType = 'boolean';
          break;
        }
        case 3: { // number array
          const arrLength = dataView.getUint8(offset + 10);
          value = new Array(arrLength).fill(0).map((_, j) =>
            dataView.getFloat64(offset + 11 + j * 8, true)
          );
          dataType = 'number[]';
          break;
        }
        default:
          continue;
      }

      if (timestamp < startTime) startTime = timestamp;
      if (timestamp > endTime) endTime = timestamp;

      // Extract key name (simplified)
      const key = `Metric_${i % 20}`;
      uniqueKeys.add(key);

      entries.push({
        timestamp,
        key,
        value,
        dataType,
      });
    }

    return {
      entries,
      startTime,
      endTime,
      duration: endTime - startTime,
      metadata: {
        filename: file.name,
        fileSize: file.size,
        entryCount: entries.length,
        uniqueKeys: uniqueKeys.size,
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse WPILog: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

/**
 * Extract performance metrics from parsed log
 */
export function calculatePerformanceMetrics(log: ParsedLog): PerformanceMetrics {
  const loopTimes = getEntriesByKey(log.entries, 'Perf/LoopTimeMs');
  const cpuUsages = getEntriesByKey(log.entries, 'Perf/CpuPercent');
  const memoryUsages = getEntriesByKey(log.entries, 'Perf/MemoryMB');

  const loop = calculateStats(loopTimes.map((e) => e.value as number));
  const cpu = calculateStats(cpuUsages.map((e) => e.value as number));
  const mem = calculateStats(memoryUsages.map((e) => e.value as number));

  return {
    loopTime: {
      averageMs: loop.average,
      maxMs: loop.max,
      minMs: loop.min,
      stdDevMs: loop.stdDev,
    },
    cpuUsage: {
      averagePercent: cpu.average,
      maxPercent: cpu.max,
      minPercent: cpu.min,
      stdDevPercent: cpu.stdDev,
    },
    memoryUsage: {
      averageMB: mem.average,
      maxMB: mem.max,
      minMB: mem.min,
      stdDevMB: mem.stdDev,
    },
  };
}

/**
 * Analyze log for performance bottlenecks
 */
export function analyzeBottlenecks(log: ParsedLog): BottleneckAnalysis[] {
  const bottlenecks: BottleneckAnalysis[] = [];

  // Group entries by category
  const categories = {
    'Swerve': getEntriesByKey(log.entries, 'Swerve'),
    'Vision': getEntriesByKey(log.entries, 'Vision'),
    'Mechanisms': getEntriesByKey(log.entries, 'Mechanism'),
    'State Machine': getEntriesByKey(log.entries, 'StateMachine'),
    'Other': [],
  };

  let totalLoopTime = 0;

  Object.entries(categories).forEach(([category, entries]) => {
    const times = entries
      .filter(e => e.key.includes('Ms') || e.key.includes('Us'))
      .map(e => e.value as number);

    if (times.length === 0) return;

    const stats = calculateStats(times);
    const avgTime = stats.average;
    const maxTime = stats.max;

    totalLoopTime += avgTime;

    bottlenecks.push({
      category,
      metric: `${category} Loop Time`,
      avgTimeMs: avgTime / 1000, // Convert to ms
      maxTimeMs: maxTime / 1000,
      percentOfTotal: 0, // Will calculate below
      severity: calculateSeverity(avgTime),
    });
  });

  // Calculate percentages
  bottlenecks.forEach(b => {
    b.percentOfTotal = (b.avgTimeMs / totalLoopTime) * 100;
  });

  // Sort by severity
  bottlenecks.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return bottlenecks;
}

/**
 * Filter log entries by key pattern
 */
export function filterByKey(log: ParsedLog, pattern: RegExp): LogEntry[] {
  return log.entries.filter(entry => pattern.test(entry.key));
}

/**
 * Get entries within time range
 */
export function getEntriesInTimeRange(
  log: ParsedLog,
  startTime: number,
  endTime: number
): LogEntry[] {
  return log.entries.filter(
    entry => entry.timestamp >= startTime && entry.timestamp <= endTime
  );
}

/**
 * Extract time series data for specific metric
 */
export function extractTimeSeries(log: ParsedLog, key: string): Array<{time: number; value: number}> {
  return log.entries
    .filter(entry => entry.key === key && entry.dataType === 'number')
    .map(entry => ({
      time: entry.timestamp,
      value: entry.value as number,
    }))
    .sort((a, b) => a.time - b.time);
}

/**
 * Detect anomalies in time series data
 */
export function detectAnomalies(
  timeSeries: Array<{time: number; value: number}>,
  stdDevThreshold: number = 3
): Array<{time: number; value: number; severity: string}> {
  const values = timeSeries.map(d => d.value);
  const stats = calculateStats(values);
  const mean = stats.average;
  const stdDev = stats.stdDev;

  return timeSeries.filter(d => {
    const zScore = Math.abs((d.value - mean) / stdDev);
    return zScore > stdDevThreshold;
  }).map(d => ({
    time: d.time,
    value: d.value,
    severity: Math.abs((d.value - mean) / stdDev) > 4 ? 'critical' : 'warning',
  }));
}

// Helper functions

function getEntriesByKey(entries: LogEntry[], keyPattern: string): LogEntry[] {
  return entries.filter(entry => entry.key.includes(keyPattern));
}

function calculateStats(values: number[]): {
  average: number;
  min: number;
  max: number;
  stdDev: number;
} {
  if (values.length === 0) {
    return { average: 0, min: 0, max: 0, stdDev: 0 };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  const average = sum / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  const variance = values.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return { average, min, max, stdDev };
}

function calculateSeverity(avgTime: number): 'low' | 'medium' | 'high' {
  if (avgTime < 1000) return 'low'; // < 1ms
  if (avgTime < 5000) return 'medium'; // < 5ms
  return 'high'; // >= 5ms
}

/**
 * Generate summary report from log analysis
 */
export function generateSummaryReport(log: ParsedLog): string {
  const metrics = calculatePerformanceMetrics(log);
  const bottlenecks = analyzeBottlenecks(log);

  let report = `# ARESLib Performance Analysis Report\n\n`;
  report += `**File**: ${log.metadata.filename}\n`;
  report += `**Duration**: ${(log.duration / 1000).toFixed(2)}s\n`;
  report += `**Entries**: ${log.metadata.entryCount}\n\n`;

  report += `## Performance Metrics\n\n`;
  report += `### Loop Time\n`;
  report += `- **Average**: ${metrics.loopTime.averageMs.toFixed(3)}ms\n`;
  report += `- **Max**: ${metrics.loopTime.maxMs.toFixed(3)}ms\n`;
  report += `- **Std Dev**: ${metrics.loopTime.stdDevMs.toFixed(3)}ms\n\n`;

  report += `### CPU Usage\n`;
  report += `- **Average**: ${metrics.cpuUsage.averagePercent.toFixed(1)}%\n`;
  report += `- **Max**: ${metrics.cpuUsage.maxPercent.toFixed(1)}%\n\n`;

  report += `### Memory Usage\n`;
  report += `- **Average**: ${metrics.memoryUsage.averageMB.toFixed(1)}MB\n`;
  report += `- **Max**: ${metrics.memoryUsage.maxMB.toFixed(1)}MB\n\n`;

  report += `## Bottleneck Analysis\n\n`;
  bottlenecks.forEach((b) => {
    const emoji = b.severity === 'high' ? '🔴' : b.severity === 'medium' ? '🟡' : '🟢';
    report += `${emoji} **${b.category}** (${b.metric})\n`;
    report += `   - Avg: ${b.avgTimeMs.toFixed(3)}ms (${b.percentOfTotal.toFixed(1)}%)\n`;
    report += `   - Max: ${b.maxTimeMs.toFixed(3)}ms\n\n`;
  });

  return report;
}

/**
 * Validate WPILog file integrity
 */
export async function validateWPILog(file: File): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Check file extension
  if (!file.name.endsWith('.wpilog')) {
    errors.push('File must have .wpilog extension');
  }

  // Check file size
  if (file.size === 0) {
    errors.push('File is empty');
  }

  if (file.size > 100_000_000) { // 100MB limit
    errors.push('File too large (>100MB)');
  }

  // Try to parse file
  try {
    await parseWPILog(file);
  } catch (error) {
    errors.push(`Failed to parse file: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
