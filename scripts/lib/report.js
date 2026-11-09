'use strict';
const { RULES } = require('./rules');

// 위반 수집기. 실행한 규칙(ran)과 위반(items)을 모은다.
class Report {
  constructor() {
    this.items = [];
    this.ran = new Set();
  }

  run(...ids) {
    for (const id of ids) this.ran.add(id);
  }

  add(rule, file, target, message) {
    const def = RULES[rule];
    if (!def) throw new Error(`알 수 없는 규칙: ${rule}`);
    this.items.push({ rule, level: def.level, file, target: target || '', message });
  }
}

module.exports = { Report };
