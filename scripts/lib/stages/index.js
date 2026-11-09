'use strict';
const interview = require('./interview');
const prd = require('./prd');
const spec = require('./spec');
const design = require('./design');
const build = require('./build');
const test = require('./test');

// 구현된 단계. approval 이 있으면 그 단계는 승인 대상이다.
const STAGES = {
  interview: { label: '인터뷰', run: interview.run, approval: null },
  prd: { label: 'PRD', run: prd.run, approval: prd.approval },
  spec: { label: '명세', run: spec.run, approval: spec.approval },
  design: { label: '설계', run: design.run, approval: design.approval },
  build: { label: '구현', run: build.run, approval: null },
  test: { label: '시험', run: test.run, approval: test.approval },
};

// 계약에는 있으나 아직 구현하지 않은 단계 (없음)
const PLANNED = [];

module.exports = { STAGES, PLANNED };
