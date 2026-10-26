// Settings for the scenario experiment (study/index.html). Edit here, not in study.js.

export const STUDY = {
  // Online questionnaires (问卷星 wjx.cn). Empty = the page shows a placeholder.
  // The consent form is sent before the session (experiment plan), so it isn't a step here.
  questionnaires: {
    background: 'https://v.wjx.cn/vm/tKqTGEy.aspx', // 背景信息
    preTest: 'https://v.wjx.cn/vm/mpgPwiK.aspx', // 意愿测试（任务开始前）
    post: 'https://v.wjx.cn/vm/mecLCiK.aspx', // 测试后问卷：SAM + UEQ-S + 意愿 + 版本偏好（两轮共用）
  },

  // Google Sheet that collects the data of formal sessions: the web app URL of the Apps
  // Script in scripts/google-sheet-apps-script.gs (deployed on the sheet "SL 情境实验 · 本场数据").
  // Empty = nothing is sent; the download button still works.
  sheetUrl: '',

  // A task that runs longer than this shows a note (the moderator asks whether to go on).
  longTaskMin: 8,

  // Warm-up (version A, not recorded): "完成热身" unlocks after this many minutes of exploring.
  warmupMin: 3,
  // The round summary stays up this long before "去填问卷" unlocks.
  summaryWaitSec: 5,
};
