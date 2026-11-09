'use strict';
// 기술 스택 후보 비교 검사 (VAL-21, 계약 0.16).
// 경고: 형식과 완결성만 본다. 후보가 진짜 대안인지(요구를 만족하는데 탈락했는지)는 게이트가 모른다. 실현성 리뷰어의 몫.

const RAN = ['VAL-21'];

const plain = (s) => (s || '').replace(/[`*]/g, '').trim();
const word = (s) => plain(s).split(/[\s(（:：]/)[0];

function check(doc, report) {
  const f = doc.file;
  const sec = doc.findHeading('후보 비교');
  if (!sec) {
    report.add('VAL-21', f, '후보 비교', "'후보 비교' 섹션이 없다 (후보 2~3개와 선택·탈락 사유. 사용자가 기술을 지정했으면 '사용자 지정' 1행)");
    return;
  }
  const table = doc.tables(sec).find((t) => t.col('후보') >= 0 && t.col('선택') >= 0);
  if (!table) {
    report.add('VAL-21', f, '후보 비교', "'후보 비교'에 '후보'와 '선택' 열이 있는 표가 없다");
    return;
  }
  const nc = table.col('후보');
  const sc = table.col('선택');
  const rows = table.rows.filter((r) => plain(r.cells[nc]));
  if (rows.length === 0) {
    report.add('VAL-21', f, '후보 비교', '후보가 1개도 없다');
    return;
  }
  if (rows.length < 2 && !rows.some((r) => /사용자 지정/.test(r.cells.join(' ')))) {
    report.add('VAL-21', f, '후보 비교', `후보가 ${rows.length}개뿐이다 (2개 이상. 사용자가 기술을 지정했으면 그 행에 '사용자 지정'이라고 쓴다)`);
  }
  const chosen = rows.filter((r) => word(r.cells[sc]) === '선택');
  if (chosen.length !== 1) report.add('VAL-21', f, '선택', `'선택'인 후보가 ${chosen.length}개다 (정확히 1개)`);
  for (const r of rows) {
    const value = plain(r.cells[sc]);
    if (word(value) === '선택') continue;
    const name = plain(r.cells[nc]);
    if (!/^탈락\s*[:：]\s*\S/.test(value)) report.add('VAL-21', f, name, `후보 '${name}'의 선택 칸은 '선택' 또는 '탈락: 사유'여야 한다 (현재: ${value || '비어 있음'})`);
  }
}

module.exports = { RAN, check };
