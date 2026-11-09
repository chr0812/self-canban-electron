'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const normalize = (text) => text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
const sha256 = (text) => crypto.createHash('sha256').update(normalize(text), 'utf8').digest('hex');
// 헤딩 앞의 이모지·기호와 번호("1. ")를 떼어 이름 비교에 쓴다. 번호는 FMT-02 가 따로 경고한다.
const cleanHeading = (text) => text.replace(/^[^\p{L}\p{N}]+/u, '').replace(/^\d+[.)]\s+/, '').trim();

const SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

function splitRow(line) {
  return line
    .replace(/\\\|/g, '\u0000')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.replace(/\u0000/g, '|').trim());
}

class Table {
  constructor(headers, rows, line) {
    this.headers = headers;
    this.rows = rows;
    this.line = line;
  }

  // 헤더 이름에 name이 포함된 첫 열의 위치 (없으면 -1)
  col(name) {
    return this.headers.findIndex((h) => h.includes(name));
  }
}

// 구간은 { start, end } (0부터, end 미포함) 형태다.
class Doc {
  constructor(file, text) {
    this.file = file;
    this.lines = normalize(text).split('\n');
    this.fenced = [];
    let inFence = false;
    for (const line of this.lines) {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        this.fenced.push(true);
      } else {
        this.fenced.push(inFence);
      }
    }
    this.headings = [];
    this.lines.forEach((line, i) => {
      if (this.fenced[i]) return;
      const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
      if (!m) return;
      const text = m[2].replace(/\s+#+$/, '');
      this.headings.push({ level: m[1].length, text, clean: cleanHeading(text), line: i });
    });
  }

  // root 기준 상대경로 파일을 읽는다. 없으면 null.
  static load(root, rel) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) return null;
    return new Doc(rel, fs.readFileSync(p, 'utf8'));
  }

  // 헤딩 텍스트가 name으로 시작하는 첫 헤딩의 구간. range 안에서만 찾을 수 있다.
  findHeading(name, level = 2, range = null) {
    const lo = range ? range.start : 0;
    const hi = range ? range.end : this.lines.length;
    const h = this.headings.find((x) => x.level === level && x.line >= lo && x.line < hi && x.clean.startsWith(name));
    if (!h) return null;
    const next = this.headings.find((x) => x.line > h.line && x.level <= h.level);
    return { heading: h, start: h.line + 1, end: next ? next.line : this.lines.length };
  }

  textOf(range) {
    return this.lines.slice(range.start, range.end).join('\n');
  }

  // 헤딩·빈 줄·구분선·주석을 뺀 본문이 있는가
  hasBody(range) {
    for (let i = range.start; i < range.end; i++) {
      const t = this.lines[i].trim();
      if (!t || /^-{3,}$/.test(t) || /^<!--.*-->$/.test(t)) continue;
      if (!this.fenced[i] && /^#{1,6}\s/.test(t)) continue;
      return true;
    }
    return false;
  }

  tables(range = { start: 0, end: this.lines.length }) {
    const out = [];
    for (let i = range.start; i < range.end - 1; i++) {
      if (this.fenced[i] || !this.lines[i].includes('|')) continue;
      const sep = this.lines[i + 1];
      if (this.fenced[i + 1] || !sep.includes('|') || !SEPARATOR.test(sep)) continue;
      const headers = splitRow(this.lines[i]);
      const rows = [];
      let j = i + 2;
      for (; j < range.end; j++) {
        const l = this.lines[j];
        if (this.fenced[j] || !l.trim() || !l.includes('|')) break;
        rows.push({ cells: splitRow(l), line: j + 1 });
      }
      out.push(new Table(headers, rows, i + 1));
      i = j - 1;
    }
    return out;
  }

  // 문서 머리의 "> 키: 값" 줄 (앞 25줄)
  meta() {
    const meta = {};
    for (let i = 0; i < Math.min(this.lines.length, 25); i++) {
      const m = /^>\s*([^:：]+)[:：]\s*(.*)$/.exec(this.lines[i]);
      if (m && !(m[1].trim() in meta)) meta[m[1].trim()] = m[2].trim();
    }
    return meta;
  }
}

module.exports = { Doc, normalize, sha256 };
