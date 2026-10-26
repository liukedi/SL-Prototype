// Texts shown to participants in the scenario experiment (from the experiment plan,
// 情境模拟实验). Chinese, as in the sessions; the prototype itself stays in English.

// Scenario texts: one paragraph per line on screen.
const scenario = (destination) => [
  '你来瑞典的斯德哥尔摩自由行，入住在 Gärdet 地铁站旁边。',
  `现在是晚上 18:30。你在斯德哥尔摩的好友邀请你 20:00 到家里做客，建议你 19:45 到达 ${destination} 地铁站，他会准时来接你。`,
  '你这几天在网上找旅行攻略时，听说斯德哥尔摩的地铁站很有艺术特色，但还没有深入了解，想找机会参观一些。',
];

export const SCENARIOS = {
  // (Not Mörby centrum: searching "Mörby" finds the Roslagsbanan station Mörby first.)
  X: { destination: 'Danderyds sjukhus', text: scenario('Danderyds sjukhus') },
  Y: { destination: 'Hallonbergen', text: scenario('Hallonbergen') },
};

// Tasks of each round; each one is started and finished with a button. T1 counts the
// sightseeing stations (all three kinds in the guide) saved as favourites in the prototype; in
// round 2 stations saved in round 1 don't count.
export const TASKS = [
  {
    id: 'T1',
    title: '任务 1 · 探索',
    text: (round) => (round === 1
      ? '请查看 6 个观赏性地铁站的详情，然后在原型的地图中分别搜索出这些站点的位置并收藏，利用它们在地图上的位置，判断其中离你最近的那一个。'
      : '请查看 6 个观赏性地铁站的详情（要和第一轮收藏的不同），然后在原型的地图中分别搜索出这些站点的位置并收藏，利用它们在地图上的位置，判断其中离你最近的那一个。'),
  },
  {
    id: 'T2',
    title: '任务 2 · 路线',
    text: () => '请查一下从这里去朋友那里的地铁路线，数一数路上会经过几个观赏性地铁站。',
  },
  {
    id: 'T3',
    title: '任务 3 · 规划',
    text: () => '请安排今晚的行程：去哪几个观赏性地铁站、按什么顺序、几点能到朋友指定的地铁站。安排好后告诉主持人你的最终计划。',
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
  warmupIntro: '先熟悉一下这个 app。这一步只是熟悉操作，不计入结果，遇到不会的地方可以直接问主持人。',
  warmupTasks: [
    '请查一下从 Gärdet 站出发、开往 T-Centralen 方向的下一班地铁是几点。',
    '在地图上缩放、移动，看看站点图标的变化。',
    '随意探索这个应用的各种功能。',
  ],
  warmupWait: (left) => `还剩 ${left}，请继续自由探索。时间到了才能进入正式任务。`,
  warmupReady: '热身时间到了，准备好后可以进入正式任务。',
  roundIntro: '这一轮一共有三个任务。每个任务开始时请点“开始”，完成后点“完成”。完全不用着急，没有时间限制。',
  // 观赏性地铁站 = all three kinds in the guide: Art Interior, Art Exhibits, Scenic View.
  found: (n, total) => (n === 0 ? '还没有收藏观赏性地铁站。在原型中每收藏一个观赏性地铁站，就算一个。'
    : n < total ? `你收藏了 ${n}/${total} 个观赏性地铁站：` : `你已经收藏了 ${total} 个观赏性地铁站：`),
  foundExcluded: '第一轮收藏过的站不计入。',
  guide: '做任务时，你可以随时打开《斯德哥尔摩艺术地铁站介绍》。它不属于原型，是外部的补充资料。',
  guideNote: '外部补充资料 · 不属于原型',
  avoid: '第一轮收藏的站（这次请选其他站）：',
  touristMode: '这一轮开始前，请先打开 Tourist Mode：点地图左上角的图层按钮，在 Map Setting 里打开 Tourist Mode 开关。打开后会出现几张介绍卡片，可以看完，也可以跳过。',
  touristModeOn: 'Tourist Mode 已打开，可以开始任务了。',
  roundDone: '这一轮的三个任务都完成了。',
  break: '第一轮结束了。可以休息一两分钟，准备好后再进入第二轮。',
  interview: '所有任务和问卷都完成了。最后请和主持人聊一聊你的感受，大约 10 分钟。',
  thanks: '非常感谢你的参与！',
};
