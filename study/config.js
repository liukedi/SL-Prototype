// Settings for the scenario experiment (study/index.html). Edit here, not in study.js.

export const STUDY = {
  // Online questionnaires (问卷星 wjx.cn). Empty = the page shows a placeholder.
  // The consent form is sent before the session (experiment plan), so it isn't a step here.
  questionnaires: {
    background: 'https://v.wjx.cn/vm/tKqTGEy.aspx', // 背景信息
    preTest: 'https://v.wjx.cn/vm/mpgPwiK.aspx', // 意愿测试（任务开始前）
    post: 'https://v.wjx.cn/vm/mecLCiK.aspx', // 测试后问卷：SAM + UEQ-S + 意愿 + 版本偏好（两轮共用）
  },

  // Each questionnaire link gets the participant's code and, after a round, the task times,
  // as this URL parameter, so the answers can be matched without a database.
  // 问卷星 records the parameter "sojumpparm" with each response ("来源详情 / 自定义参数").
  paramName: 'sojumpparm',

  // A task that runs longer than this shows a note (the moderator asks whether to go on).
  longTaskMin: 8,
};
