import fs from 'fs/promises';
import path from 'path';
import { validateContentIntegrity } from '../src/services/subtitle/contentValidator';

const TEST_DATA_DIR = path.resolve(process.cwd(), 'scripts/test_data');

async function loadSubtitleText(filename: string): Promise<string> {
  const filePath = path.join(TEST_DATA_DIR, filename);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const json = JSON.parse(content);
    return json.map((item: any) => item.original || '').join(' ');
  } catch (e: any) {
    console.error(`  Error loading ${filename}: ${e.message}`);
    return '';
  }
}

async function verifyPair(
  scenario: string,
  whisperFile: string,
  refineFile: string,
  expectedValid: boolean
) {
  console.log(`\n[FILE TEST] ${scenario}`);

  try {
    const source = await loadSubtitleText(whisperFile);
    const target = await loadSubtitleText(refineFile);

    if (!source || !target) {
      console.log('  Skipping (File not found)');
      return;
    }

    const result = validateContentIntegrity(source, target);

    console.log(`  Score: ${(result.score * 100).toFixed(2)}% | Valid: ${result.isValid}`);
    console.log(`  Details: ${result.details || 'OK'}`);

    if (result.isValid !== expectedValid) {
      console.error(`  ❌ FAIL: Expected ${expectedValid}, got ${result.isValid}`);
    } else {
      console.log(`  ✅ PASS`);
    }
  } catch (err) {
    console.log(`  Error: ${err}`);
  }
}

async function runManualTests() {
  console.log(`\n========================================`);
  console.log(`   RUNNING EDGE CASE TESTS (MANUAL)`);
  console.log(`========================================`);

  const testCases = [
    // 1. CJK Short Text Exemption (< 5 chars)
    {
      name: 'CJK Short Exemption (Valid)',
      source: 'うん', // 2 chars
      target: 'はい', // Rewrite
      expected: true,
    },
    {
      name: 'CJK Short Exemption (Boundary)',
      source: '羽衣煮?', // 4 chars
      target: 'はごろもに', // Rewrite to Hiragana (5 chars)
      expected: true,
    },
    // 2. CJK Normal Content (> 5 chars, CHECKED)
    {
      name: 'CJK Normal Rewrite (Pass)',
      source: 'すごい気になる', // 7 chars
      target: 'とても気になる', // Shared: "気になる"
      expected: true,
    },
    {
      name: 'CJK Severe Drop (Fail)',
      source: 'スマートフォンゲームプロジェクト世界カラフルステージ', // 25+ chars
      target: 'スマホゲーム', // Severe abbreviation
      expected: false,
    },
    // 3. English Short Text Exemption (< 10 chars)
    {
      name: 'English Short Exemption (Valid)',
      source: 'Hello.', // 6 chars
      target: 'Hi there.',
      expected: true,
    },
    {
      name: 'English Boundary (Fail if Checked)',
      source: 'Hello World', // 11 chars -> Checked (>10)
      target: 'Hi Earth', // Zero overlap
      expected: false,
    },
    // 4. English Valid Rewrite
    {
      name: 'English Rewrite (Pass)',
      source: 'It was a dark and stormy night.',
      target: 'The night was dark and stormy.',
      expected: true,
    },
    // 5. Language Switch (Hallucination Fix)
    {
      name: 'Language Switch (Short - Exempt)',
      source: 'by H.', // 5 chars
      target: 'はい。', // 3 chars
      expected: true, // Exempted (< 10 for Eng source? No, mixed check)
    },
    // 6. Kanji Normalization (Katakana -> Kanji)
    {
      name: 'Kanji Normalization (Boundary)',
      source: 'イブスキマクラザキセン', // 11 chars
      target: '指宿枕崎線', // 5 chars
      expected: false, // Exemption < 5 (CJK). Source 11. FAIL is CORRECT (Metric Limitation).
    },
  ];

  let passed = 0;
  for (const test of testCases) {
    const result = validateContentIntegrity(test.source, test.target);
    const success = result.isValid === test.expected;
    if (success) passed++;

    const icon = success ? '✅' : '❌';
    console.log(`${icon} [${test.name}]`);
    // console.log(`   Source: "${test.source}"`); // Optional: too verbose
    // console.log(`   Target: "${test.target}"`);
    console.log(`   -> Result: ${result.isValid} (Score: ${result.score.toFixed(2)})`);
    if (result.details) console.log(`   -> Note: ${result.details}`);
  }
  console.log(`\nManual Tests Summary: ${passed}/${testCases.length} Passed`);
}

async function run() {
  await runManualTests();

  console.log(`\n========================================`);
  console.log(`   RUNNING REGRESSION TESTS (FILES)`);
  console.log(`========================================`);

  // 1. Known Failure (Severe Hallucination)
  await verifyPair(
    'Severe Hallucination',
    'hallucination_whisper.json',
    'hallucination_refinement.json',
    false
  );

  // 2. Known Safe Rewrite
  await verifyPair('Safe Rewrite', 'rewrite_whisper.json', 'rewrite_refinement.json', true);

  // 3. Known "Mismatch" (Actually a Valid Correction)
  await verifyPair(
    'Mismatch (Valid Correction)',
    'mismatch_whisper.json',
    'mismatch_refinement.json',
    true
  );

  await verifyAbsolutePair(
    'Kanji Chunk (Full Context)',
    'temp_logs/2026-01-12/00-22-52-959_chunk_4_whisper.json',
    'temp_logs/2026-01-12/00-25-24-854_chunk_4_refinement.json'
  );
}

// Helper for testing absolute paths directly (e.g. from temp_logs)
async function verifyAbsolutePair(name: string, p1: string, p2: string) {
  console.log(`\n[ABSOLUTE FILE TEST] ${name}`);
  try {
    const content1 = await fs.readFile(p1, 'utf-8');
    const content2 = await fs.readFile(p2, 'utf-8');
    const json1 = JSON.parse(content1);
    const json2 = JSON.parse(content2);
    const t1 = json1.map((i: any) => i.original).join(' ');
    const t2 = json2.map((i: any) => i.original).join(' ');

    const res = validateContentIntegrity(t1, t2);
    console.log(`   Length: ${t1.length} -> ${t2.length}`);
    console.log(`   Score: ${(res.score * 100).toFixed(2)}% | Valid: ${res.isValid}`);
  } catch (e) {
    console.log('Skipping absolute test: ' + e);
  }
}

run();
