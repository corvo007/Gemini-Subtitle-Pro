/**
 * Analyze Subtitle Differences
 *
 * This script compares Whisper-generated subtitles with Refined subtitles to detect anomalies.
 * It checks for:
 * 1. Text Similarity (Levenshtein Distance) - Detecting dropped content
 * 2. Hallucinations - Detecting abnormally long durations (e.g. > 5 mins)
 * 3. Structural Differences - Significant line count changes
 *
 * Usage:
 *   npx tsx scripts/analyze-subtitle-diff.ts <file1> <file2>  (Single Pair)
 *   npx tsx scripts/analyze-subtitle-diff.ts <directory>      (Batch Mode)
 */
import fs from 'fs/promises';
import path from 'path';

interface SubtitleItem {
  id: string;
  startTime: string;
  endTime: string;
  original: string;
  translated?: string;
}

function parseTime(timeStr: string): number {
  // Format: HH:MM:SS,mmm
  // Handle cases where comma might be period just in case
  const normalized = timeStr.replace('.', ',');
  const parts = normalized.trim().split(',');
  if (parts.length < 2) return 0;

  const [hms, ms] = parts;
  const [h, m, s] = hms.split(':').map(Number);

  return h * 3600 * 1000 + m * 60 * 1000 + s * 1000 + Number(ms);
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Optimize space: we only need 2 rows
  // But for simplicity of debugging, standard matrix for now
  // Actually, standard matrix is O(NM) space, which might crash for 10k chars.
  // Let's use 2 rows space optimization.

  let row = new Int32Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) {
    row[i] = i;
  }

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    let diag = i - 1; // value at matrix[i-1][j-1]

    // row[0] for current row is i
    // but we can just use a generic 'newRow' or update in place with care
    // safer to use two arrays
    const nextRow = new Int32Array(b.length + 1);
    nextRow[0] = i;

    for (let j = 1; j <= b.length; j++) {
      if (a.charAt(i - 1) === b.charAt(j - 1)) {
        nextRow[j] = row[j - 1]; // match
      } else {
        nextRow[j] = Math.min(
          row[j - 1] + 1, // substitution
          nextRow[j - 1] + 1, // insertion
          row[j] + 1 // deletion
        );
      }
    }
    row = nextRow;
  }

  return row[b.length];
}

function jaccardSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Use Bigrams for better context than single chars in CJK
  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const setA = getBigrams(a);
  const setB = getBigrams(b);

  // If strings are too short for bigrams (<2 chars), fallback to char set
  if (setA.size === 0 || setB.size === 0) {
    const charSetA = new Set(a.split(''));
    const charSetB = new Set(b.split(''));
    const intersection = new Set([...charSetA].filter((x) => charSetB.has(x)));
    const union = new Set([...charSetA, ...charSetB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

function calculateCoverage(source: string, target: string): number {
  if (source.length === 0) return 1; // Nothing to cover
  if (target.length === 0) return 0; // Missed everything

  // Use Bigrams (or Trigrams) for Coverage
  // source: "ABCDE" -> AB, BC, CD, DE
  // target: "ABC"   -> AB, BC
  // Coverage: 2 / 4 = 50%

  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const sourceSet = getBigrams(source);
  const targetSet = getBigrams(target);

  if (sourceSet.size === 0) return 1; // Source too short to judge

  let hit = 0;
  sourceSet.forEach((gram) => {
    if (targetSet.has(gram)) hit++;
  });

  return hit / sourceSet.size;
}

const logs: string[] = [];
function log(msg: string) {
  console.log(msg);
  logs.push(msg);
}

interface AnalysisResult {
  pair: string;
  directory: string;
  similarity: number;
  jaccard: number;
  coverage: number;
  hallucinations: number;
  dropped: boolean;
  maxDuration: number;
  lineDiffRatio: number;
  fileA: string;
  fileB: string;
}

const results: AnalysisResult[] = [];

async function analyzeFilePair(file1Path: string, file2Path: string) {
  const filenameA = path.basename(file1Path);
  const filenameB = path.basename(file2Path);
  const dirName = path.basename(path.dirname(file1Path));

  log(`\n==================================================`);
  log(`Analyzing Pair [Folder: ${dirName}]:`);
  log(`  File A (Reference/Whisper): ${filenameA}`);
  log(`  File B (Refinement):        ${filenameB}`);
  log(`==================================================`);

  let content1: SubtitleItem[] = [];
  let content2: SubtitleItem[] = [];

  try {
    content1 = JSON.parse(await fs.readFile(file1Path, 'utf8'));
    content2 = JSON.parse(await fs.readFile(file2Path, 'utf8'));
  } catch (err) {
    log(`Error reading files: ${(err as Error).message}`);
    return;
  }

  // 1. Line Count
  // log(`\n--- 1. Structure Comparison ---`);
  // log(`  File A Lines: ${content1.length}`);
  // log(`  File B Lines: ${content2.length}`);
  const diffCount = content2.length - content1.length;
  // log(`  Delta (B - A): ${diffCount} lines`);

  // 2. Text Content Analysis
  const text1 = content1.map((c) => c.original || '').join('');
  const text2 = content2.map((c) => c.original || '').join('');

  let distance = -1;
  if (text1.length * text2.length <= 20000 * 20000) {
    distance = levenshteinDistance(text1, text2);
  } else {
    log('  [INFO] Text very long, skipping exact edit distance.');
  }

  const ratio = distance >= 0 ? 1 - distance / Math.max(text1.length, text2.length) : 0;
  const jaccard = jaccardSimilarity(text1, text2);
  const coverage = calculateCoverage(text1, text2);

  log(`  Lines: A=${content1.length}, B=${content2.length} (Diff: ${diffCount})`);
  log(
    `  Similarity: ${(ratio * 100).toFixed(2)}% (Lev) | ${(jaccard * 100).toFixed(2)}% (Jac) | Coverage: ${(coverage * 100).toFixed(2)}%`
  );

  // 3. Hallucination Check
  const SUSPICIOUS_DURATION_MS = 60 * 1000 * 5; // > 5 minutes
  let hallucinationCount = 0;

  const longDuration = content2.filter(
    (c) => parseTime(c.endTime) - parseTime(c.startTime) > SUSPICIOUS_DURATION_MS
  );
  if (longDuration.length > 0) {
    log(`  [ALERT] Refinement has ${longDuration.length} items with duration > 5 mins.`);
    hallucinationCount = longDuration.length;
    longDuration.forEach((i) => {
      const d = (parseTime(i.endTime) - parseTime(i.startTime)) / 1000;
      log(`    - ID ${i.id}: ${d}s (Content: "${i.original.substring(0, 30)}...")`);
    });
  }

  // Result tracking
  // Calculate max duration in file B for stats
  let maxDuration = 0;
  content2.forEach((c) => {
    const d = parseTime(c.endTime) - parseTime(c.startTime);
    if (d > maxDuration) maxDuration = d;
  });

  // Calculate line diff ratio
  const lineDiffRatio =
    content1.length > 0 ? (content2.length - content1.length) / content1.length : 0;

  results.push({
    pair: `${filenameA} <-> ${filenameB}`,
    directory: dirName,
    similarity: ratio,
    jaccard: jaccard,
    coverage: coverage,
    hallucinations: hallucinationCount, // Keep for legacy/alert
    dropped: ratio < 0.6,
    maxDuration: maxDuration / 1000, // seconds
    lineDiffRatio: lineDiffRatio,
    fileA: filenameA,
    fileB: filenameB,
  });
}

function getTimestampFromFilename(filename: string): number {
  // Format: HH-MM-SS-MMM_...
  // Or potentially Date...
  // We only care about relative ordering.
  // Let's assume sorting by filename string is roughly chronological for same day runs?
  // Actually, "00-22-39" vs "23-28-58".
  // If we assume regex match: (\d{2})-(\d{2})-(\d{2})-(\d{3})
  const match = filename.match(/^(\d{2})-(\d{2})-(\d{2})-(\d{3})/);
  if (match) {
    const [_, h, m, s, ms] = match;
    // Turn into ms from start of day
    return parseInt(h) * 3600000 + parseInt(m) * 60000 + parseInt(s) * 1000 + parseInt(ms);
  }
  return 0;
}

async function batchProcess(directory: string) {
  // Recursive directory processing or one-level shallow processing?
  // Robocopy made subfolders by Date? "2026-01-13" etc.
  // Inside might be just files (flattened by logging system? or nested by sessionID?)
  // Let's assume files are in the leaf directories.

  // Helper to get all files recursively
  async function getFilesRecursively(dir: string): Promise<string[]> {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const dirent of dirents) {
      const res = path.resolve(dir, dirent.name);
      if (dirent.isDirectory()) {
        files.push(...(await getFilesRecursively(res)));
      } else {
        files.push(res);
      }
    }
    return files;
  }

  const allFiles = await getFilesRecursively(directory);

  // Group by directory to ensure we only pair files in the same folder (Session)
  // NOTE: If the previous logs were flatfiles inside Date folders, then "same folder" = "same day".
  // That's still better than "global".
  // But if they are just Date folders, the pairing logic by timestamp is still needed within the day.

  const filesByDir: Record<string, string[]> = {};
  for (const file of allFiles) {
    const dir = path.dirname(file);
    if (!filesByDir[dir]) filesByDir[dir] = [];
    filesByDir[dir].push(file);
  }

  for (const [dirPath, files] of Object.entries(filesByDir)) {
    log(`\nProcessing Directory: ${path.basename(dirPath)}`);

    const whispers = files.filter((f) => f.includes('_whisper.json')).sort();
    const refinements = files.filter((f) => f.includes('_refinement.json')).sort();

    if (whispers.length === 0) continue;

    for (const w of whispers) {
      const filename = path.basename(w);
      const wChunkMatch = filename.match(/_chunk_(\d+)_/);
      if (!wChunkMatch) continue;
      const chunkId = wChunkMatch[1];
      const wTime = getTimestampFromFilename(filename);

      // Candidates in SAME directory
      const candidates = refinements.filter((r) => {
        const rName = path.basename(r);
        const rChunkMatch = rName.match(/_chunk_(\d+)_/);
        return rChunkMatch && rChunkMatch[1] === chunkId;
      });

      let bestMatch: string | null = null;
      let minTimeDiff = Infinity;

      for (const r of candidates) {
        const rName = path.basename(r);
        const rTime = getTimestampFromFilename(rName);
        let diff = rTime - wTime;

        // 24h wrap logic not strictly needed if in same folder (same day), but good for safety
        if (diff < -1000 * 60 * 60 * 12) diff += 24 * 3600000;
        if (diff > 1000 * 60 * 60 * 12) diff -= 24 * 3600000;

        // Window: 10 mins (Reduced from 20)
        if (Math.abs(diff) < 1000 * 60 * 10) {
          if (Math.abs(diff) < minTimeDiff) {
            minTimeDiff = Math.abs(diff);
            bestMatch = r;
          }
        }
      }

      if (bestMatch) {
        await analyzeFilePair(w, bestMatch);
      }
    }
  }

  // Summary
  log(`\n\n==================================================`);
  log(`BATCH ANALYSIS SUMMARY (Statistical Approach)`);
  log(`==================================================`);
  log(`Total Pairs Processed: ${results.length}`);

  if (results.length < 5) {
    log(`Not enough data for statistical analysis (need > 5 samples).`);
    return;
  }

  // Helper for stats
  const calculateStats = (values: number[]) => {
    if (values.length === 0) return { mean: 0, std: 0, min: 0, max: 0, q1: 0, q3: 0, iqr: 0 };
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / sorted.length;
    const variance = sorted.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / sorted.length;
    const std = Math.sqrt(variance);

    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;

    return { mean, std, min: sorted[0], max: sorted[sorted.length - 1], q1, q3, iqr };
  };

  // 1. Analyze Similarity Distribution
  const similarities = results.map((r) => r.similarity * 100);
  const simStats = calculateStats(similarities);
  log(`\n--- Similarity Stats (%) ---`);
  log(`Mean: ${simStats.mean.toFixed(2)}% | StdDev: ${simStats.std.toFixed(2)}%`);
  log(`Min: ${simStats.min.toFixed(2)}% | Max: ${simStats.max.toFixed(2)}%`);
  log(
    `IQR: ${simStats.iqr.toFixed(2)} (Q1: ${simStats.q1.toFixed(2)} - Q3: ${simStats.q3.toFixed(2)})`
  );

  // Outliers for Similarity (Low side)
  // Using IQR Rule: Low Outlier < Q1 - 1.5 * IQR
  // But since distribution is skewed high, let's look for robust deviations.
  // actually, simple threshold might be better if data is consistent,
  // but user asked for dynamic.
  const simThresholdLow = simStats.q1 - 1.5 * simStats.iqr;
  log(`Dynamic Low Threshold (Q1 - 1.5*IQR): ${simThresholdLow.toFixed(2)}%`);

  // 2. Analyze Jaccard Distribution
  const jaccardValues = results.map((r) => r.jaccard * 100);
  const jacStats = calculateStats(jaccardValues);
  log(`\n--- Jaccard Stats (%) ---`);
  log(`Mean: ${jacStats.mean.toFixed(2)}% | StdDev: ${jacStats.std.toFixed(2)}%`);
  log(`Min: ${jacStats.min.toFixed(2)}% | Max: ${jacStats.max.toFixed(2)}%`);
  log(
    `IQR: ${jacStats.iqr.toFixed(2)} (Q1: ${jacStats.q1.toFixed(2)} - Q3: ${jacStats.q3.toFixed(2)})`
  );
  const jacThresholdLow = jacStats.q1 - 1.5 * jacStats.iqr;
  log(`Dynamic Low Threshold (Q1 - 1.5*IQR): ${jacThresholdLow.toFixed(2)}%`);

  // 3. Analyze Coverage Distribution
  const coverageValues = results.map((r) => r.coverage * 100);
  const covStats = calculateStats(coverageValues);
  log(`\n--- Coverage Stats (Asymmetric Recall) (%) ---`);
  log(`Mean: ${covStats.mean.toFixed(2)}% | StdDev: ${covStats.std.toFixed(2)}%`);
  log(`Min: ${covStats.min.toFixed(2)}% | Max: ${covStats.max.toFixed(2)}%`);
  log(
    `IQR: ${covStats.iqr.toFixed(2)} (Q1: ${covStats.q1.toFixed(2)} - Q3: ${covStats.q3.toFixed(2)})`
  );
  const covThresholdLow = covStats.q1 - 1.5 * covStats.iqr;
  log(`Dynamic Low Threshold (Q1 - 1.5*IQR): ${covThresholdLow.toFixed(2)}%`);

  // 4. Analyze Duration Distribution (Max Duration per file)
  const durations = results.map((r) => r.maxDuration);
  const durStats = calculateStats(durations);
  log(`\n--- Max Duration Stats (s) ---`);
  log(`Mean: ${durStats.mean.toFixed(2)}s | StdDev: ${durStats.std.toFixed(2)}s`);
  // Outliers for Duration (High side)
  const durThresholdHigh = durStats.q3 + 1.5 * durStats.iqr;
  // If stats are tight (e.g. all 5s), threshold might be 7s. That's too strict.
  // Let's ensure a minimum sanity floor.
  const effectiveDurThreshold = Math.max(durThresholdHigh, 30); // At least 30s to be interesting
  log(
    `Dynamic High Threshold (Q3 + 1.5*IQR): ${durThresholdHigh.toFixed(2)}s (Effective: ${effectiveDurThreshold.toFixed(2)}s)`
  );

  log(`\n--- Anomaly Report (Statistical Outliers) ---`);

  const lowSimOutliers = results.filter((r) => r.similarity * 100 < simThresholdLow);
  const durOutliers = results.filter((r) => r.maxDuration > effectiveDurThreshold);

  if (lowSimOutliers.length > 0) {
    log(
      `\n[STATISTICAL ALERT] Found ${lowSimOutliers.length} Low Similarity Outliers (Levenshtein < ${simThresholdLow.toFixed(1)}%):`
    );

    lowSimOutliers.forEach((r) => {
      const isFalsePositive = r.coverage >= 0.5;
      const label = isFalsePositive
        ? '[SUSPECTED FALSE POSITIVE (REWRITE)]'
        : '[CONFIRMED DROPPED CONTENT]';

      log(`  - ${r.directory}\\${r.fileA}`);
      log(`    Status:      ${label}`);
      log(
        `    Levenshtein: ${(r.similarity * 100).toFixed(1)}% (Z: ${((r.similarity * 100 - simStats.mean) / simStats.std).toFixed(1)})`
      );
      log(`    Jaccard:     ${(r.jaccard * 100).toFixed(1)}%`);
      log(`    Coverage:    ${(r.coverage * 100).toFixed(1)}%`);
    });
  } else {
    log(`\nNo statistical outliers found for low similarity.`);
  }

  if (durOutliers.length > 0) {
    log(
      `\n[STATISTICAL ALERT] Found ${durOutliers.length} Duration Anomalies (Duration > ${effectiveDurThreshold.toFixed(1)}s):`
    );
    durOutliers.forEach((r) => {
      log(`  - ${r.directory}\\${r.fileB} (Max Duration: ${r.maxDuration.toFixed(1)}s)`);
    });
  } else {
    log(`\nNo statistical outliers found for duration.`);
  }

  log(`\nAnalysis Complete.`);
}

async function main() {
  const args = process.argv.slice(2);
  const target = args[0];

  if (!target) {
    console.log('Usage: npx tsx scripts/analyze-subtitle-diff.ts <file_or_directory>');
    return;
  }

  try {
    const stats = await fs.stat(target);
    if (stats.isDirectory()) {
      await batchProcess(target);
    } else {
      // pair mode
      if (args.length >= 2) {
        for (let i = 0; i < args.length; i += 2) {
          if (i + 1 >= args.length) break;
          await analyzeFilePair(args[i], args[i + 1]);
        }
      }
    }

    await fs.writeFile('analysis_result.log', logs.join('\n'));
  } catch (err) {
    console.error(err);
  }
}

main().catch(console.error);
