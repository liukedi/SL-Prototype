// Settings for the scenario experiment (study/index.html). Edit here, not in study.js.

export const STUDY = {
  // Online questionnaires (e.g. 问卷星 wjx.cn). Paste each questionnaire's link here.
  // Empty = the page shows a placeholder (for trying out the flow).
  questionnaires: {
    consent: '', // 知情同意书
    background: '', // 开场问卷：背景信息 + 意愿前测
    round1: '', // 第一轮问卷：SAM + UEQ-S + 计划把握程度
    round2: '', // 第二轮问卷 + 收尾：SAM + UEQ-S + 计划把握程度 + 意愿后测 + 版本偏好
  },

  // Each questionnaire link gets the participant's code and, after a round, the task times,
  // as this URL parameter, so the answers can be matched without a database.
  // 问卷星 records the parameter "sojumpparm" with each response ("来源详情 / 自定义参数").
  paramName: 'sojumpparm',

  // A task that runs longer than this shows a note (the moderator asks whether to go on).
  longTaskMin: 8,
};
