// Texts shown to participants in the scenario experiment (from the experiment plan,
// 情境模拟实验). Chinese, as in the sessions; the prototype itself stays in English.

// Scenario texts: one paragraph per line on screen.
const scenario = (destination) => [
  '你来瑞典的斯德哥尔摩自由行，入住在 Gärdet 地铁站旁边。',
  `现在是晚上 18:30。你在斯德哥尔摩的好友邀请你 20:00 到家里做客，建议你 19:45 到达 ${destination} 地铁站，他会准时来接你。`,
  '你这几天在网上找旅行攻略时，听说斯德哥尔摩的地铁站很有艺术特色，但还没有深入了解，想找机会参观一些。',
];

export const SCENARIOS = {
  X: { destination: 'Mörby centrum', text: scenario('Mörby centrum') },
  Y: { destination: 'Hallonbergen', text: scenario('Hallonbergen') },
};

// Tasks of each round. T1 counts the stations whose details were viewed (the guide in both
// rounds; in version B also the stations' pages in the app); in round 2 they should be six
// stations not viewed in round 1 (the task card lists those).
export const TASKS = [
  {
    id: 'T1',
    title: '任务 1 · 探索',
    text: (round) => (round === 1
      ? '请查看 6 个艺术地铁站的详情，然后利用它们在地图上的位置，找出其中离你最近的那一个。'
      : '请查看 6 个艺术地铁站的详情（要和第一轮看过的不同），然后利用它们在地图上的位置，找出其中离你最近的那一个。'),
    done: '我找到了',
  },
  {
    id: 'T2',
    title: '任务 2 · 路线',
    text: () => '请查一下从这里去朋友那里的地铁路线，数一数路上会经过几个艺术地铁站。',
    done: '我数好了',
  },
  {
    id: 'T3',
    title: '任务 3 · 规划',
    text: () => '请安排今晚的行程：去哪几个艺术站、按什么顺序、几点能到朋友指定的地铁站。安排好后告诉主持人你的最终计划。',
    done: '我安排好了',
  },
];

export const TEXT = {
  welcome: [
    '谢谢你参加这次测试。我们在研究游客如何用交通 app 来安排在斯德哥尔摩的行程。今天你会在两个版本的 app 里完成一些任务，然后填几份简短的问卷，最后聊一聊你的感受。全程大约一个小时。',
    '我们测试的是 app，不是你，没有对错之分。如果某个地方你觉得难用或看不懂，那正是我们想知道的。',
    '测试会录音和录屏，数据会匿名处理，只用于研究。你可以随时停止，不需要理由。',
    '这是一个原型，有些功能没有做完，点了可能会提示“原型里没有这个功能”，这是正常的。',
  ],
  thinkAloud: [
    '做任务的时候，请把你在想的都说出来：你在看什么、想做什么、喜欢什么、哪里看不懂。就像在自言自语。',
  ],
  thinkAloudExamples: '比如：“我在找……”“这个图标是什么意思？”“我想点这里看看”“这个信息很有用”。说得零碎也没关系。',
  warmup: '先熟悉一下这个 app：请查一下从 Gärdet 站出发、开往 T-Centralen 方向的下一班地铁是几点。',
  warmupNote: '这一步只是熟悉操作，不计入结果。遇到不会的地方可以直接问主持人。',
  guide: '做任务时，你可以随时打开《斯德哥尔摩艺术地铁站介绍》。',
  avoid: '第一轮看过的站（这次请选其他站）：',
  touristMode: '这一轮开始前，请先打开 Tourist Mode：点地图左上角的图层按钮，在 Map Setting 里打开 Tourist Mode 开关。打开后会出现几张介绍卡片，可以看完，也可以跳过。',
  touristModeOn: 'Tourist Mode 已打开，可以开始任务了。',
  roundDone: '这一轮的三个任务都完成了。请稍等片刻，主持人会记录一下用时。',
  break: '第一轮结束了。可以休息一两分钟，准备好后再进入第二轮。',
  interview: '所有任务和问卷都完成了。最后请和主持人聊一聊你的感受，大约 10 分钟。',
  thanks: '非常感谢你的参与！',
};
