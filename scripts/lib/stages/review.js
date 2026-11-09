'use strict';
// 설계 리뷰 결과(JSON)와 처리 기록(resolution.md)을 검사한다. 처리 규칙은 contracts/review-handling.md.
const fs = require('fs');
const path = require('path');
const { Doc } = require('../markdown');

const P = require('../paths');

const DIR = P.review;
const RESOLUTION = `${DIR}/resolution.md`;

const TYPES = new Set(['불일치', '구현', '요구·정책', '선호']);
const ACTIONS = new Set(['수정', '사용자 결정', '기록', '기각']);
// 사용자가 정할 일이다. 사용자 결정 없이 고치지 않는다.
const USER_OWNED = new Set(['요구·정책', '선호']);
// CRITICAL 이슈를 닫을 수 있는 처리
const CLOSES = new Set(['수정', '기각', '사용자 결정']);

// 리뷰어 출력(<관점>.json)의 이슈를 모은다. 재확인 결과(.recheck.json)는 제외한다.
function readReviews(root, report) {
  const dir = path.join(root, DIR);
  const issues = [];
  if (!fs.existsSync(dir)) return { files: [], issues };
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.endsWith('.recheck.json')).sort();
  for (const f of files) {
    const rel = `${DIR}/${f}`;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    } catch {
      report.add('REV-01', rel, '', '리뷰 결과를 JSON으로 읽을 수 없어 미해결 CRITICAL을 확인할 수 없다');
      continue;
    }
    if (!data || !Array.isArray(data.issues)) {
      report.add('REV-01', rel, '', "리뷰 결과에 'issues' 배열이 없어 미해결 CRITICAL을 확인할 수 없다");
      continue;
    }
    for (const it of data.issues) {
      if (it && typeof it.id === 'string') issues.push({ id: it.id, severity: String(it.severity || '').toUpperCase(), file: rel });
    }
  }
  return { files, issues };
}

// 처리 기록의 표 행: 이슈 ID, 유형, 처리, 근거
function readResolution(doc) {
  const rows = new Map();
  for (const table of doc.tables()) {
    const ci = table.col('이슈');
    const ct = table.col('유형');
    const ca = table.col('처리');
    const cb = table.col('근거');
    if (ci < 0 || ct < 0 || ca < 0) continue;
    for (const row of table.rows) {
      const id = row.cells[ci] || '';
      if (!/^[A-Z]{2}-\d{3}$/.test(id)) continue;
      rows.set(id, { id, type: row.cells[ct] || '', action: row.cells[ca] || '', basis: cb >= 0 ? row.cells[cb] || '' : '', line: row.line });
    }
  }
  return rows;
}

function check(root, report) {
  const { files, issues } = readReviews(root, report);
  const doc = Doc.load(root, RESOLUTION);

  // REV-02: 리뷰 결과·처리 기록이 있다
  if (files.length === 0) {
    report.add('REV-02', DIR, '', `설계 리뷰 결과(${DIR}/<관점>.json)가 없다. 리뷰를 했다면 결과를 파일로 남긴다`);
    return;
  }
  if (!doc && issues.length) {
    report.add('REV-02', RESOLUTION, '', '리뷰 처리 기록(resolution.md)이 없다. 지적마다 유형과 처리를 적는다 (contracts/review-handling.md)');
  }
  const rows = doc ? readResolution(doc) : new Map();

  for (const it of issues) {
    const row = rows.get(it.id);
    if (it.severity === 'CRITICAL') {
      // REV-01: CRITICAL 은 수정·기각(근거)·사용자 결정 중 하나로 닫혀야 한다
      if (!row) report.add('REV-01', RESOLUTION, it.id, `CRITICAL ${it.id}(${it.file})가 처리 기록에 없다`);
      else if (!CLOSES.has(row.action)) report.add('REV-01', RESOLUTION, it.id, `CRITICAL ${it.id}의 처리가 '${row.action}'이다. 수정·기각·사용자 결정 중 하나여야 한다`);
      else if (row.action === '기각' && !row.basis) report.add('REV-01', RESOLUTION, it.id, `CRITICAL ${it.id}를 기각하면서 근거를 적지 않았다`);
    } else if (it.severity === 'WARN' && doc && !row) {
      report.add('REV-02', RESOLUTION, it.id, `WARN ${it.id}(${it.file})가 처리 기록에 없다`);
    }
  }

  // REV-03: 처리 기록의 형식과 권한
  for (const row of rows.values()) {
    if (!TYPES.has(row.type)) {
      report.add('REV-03', RESOLUTION, row.id, `${row.id}의 유형 '${row.type}'이 허용 값(${[...TYPES].join(' / ')})이 아니다`);
      continue;
    }
    if (!ACTIONS.has(row.action)) {
      report.add('REV-03', RESOLUTION, row.id, `${row.id}의 처리 '${row.action}'이 허용 값(${[...ACTIONS].join(' / ')})이 아니다`);
      continue;
    }
    if (USER_OWNED.has(row.type) && row.action === '수정') {
      report.add('REV-03', RESOLUTION, row.id, `${row.id}는 '${row.type}' 지적이다. 사용자 결정 없이 수정하지 않는다 (처리를 '사용자 결정'으로 쓰고 사용자가 고른 내용을 근거에 적는다)`);
    }
    if (row.action === '사용자 결정' && !row.basis) {
      report.add('REV-03', RESOLUTION, row.id, `${row.id}의 사용자 결정 내용을 근거에 적지 않았다`);
    }
  }
}

module.exports = { check, DIR, RESOLUTION };
