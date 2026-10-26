// Texts shown to participants in the scenario experiment (from the experiment plan,
// 情境模拟实验). English version (branch study-flow-en); the questionnaires stay as they are.

// Scenario texts: one paragraph per line on screen.
const scenario = (destination) => [
  'You are travelling on your own in Stockholm, Sweden, staying next to Gärdet metro station.',
  `It is 18:30 in the evening. A friend who lives in Stockholm has invited you to their home at 20:00 and suggests you arrive at ${destination} metro station at 19:45, where they will pick you up.`,
  'While reading travel tips online these past days, you heard that Stockholm’s metro stations are known for their art, but you haven’t looked into it yet. You would like to visit some.',
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
    title: 'Task 1 · Explore',
    text: (round) => (round === 1
      ? 'Look at the details of 6 sightseeing metro stations. Then search for each of them on the prototype’s map and save them as favourites. Using their positions on the map, decide which one is closest to you.'
      : 'Look at the details of 6 sightseeing metro stations (different from the ones you saved in the first round). Then search for each of them on the prototype’s map and save them as favourites. Using their positions on the map, decide which one is closest to you.'),
  },
  {
    id: 'T2',
    title: 'Task 2 · Route',
    text: () => 'Find the metro route from here to your friend’s station, and count how many sightseeing metro stations you pass on the way.',
  },
  {
    id: 'T3',
    title: 'Task 3 · Plan',
    text: () => 'Plan your evening: which sightseeing metro stations to visit, in what order, and when you will reach the station your friend named. When you are done, tell the moderator your final plan.',
  },
];

export const TEXT = {
  welcome: [
    'Thank you for taking part. We are studying how tourists use a transit app to plan their time in Stockholm. Today you will do some tasks in two versions of the app, fill in a few short questionnaires, and finally talk with us about your experience. The whole session takes about an hour.',
    'We are testing the app, not you: there are no right or wrong answers. If something feels hard to use or confusing, that is exactly what we want to know.',
    'The session is audio and screen recorded. The data is anonymised and used only for research. You can stop at any time without giving a reason.',
    'This is a prototype and some features are not built. Tapping them may show a message saying the feature isn’t available in the prototype; that is expected.',
  ],
  thinkAloud: [
    'While doing the tasks, please say out loud whatever you are thinking: what you are looking at, what you want to do, what you like, what you don’t understand. As if talking to yourself.',
  ],
  thinkAloudExamples: 'For example: “I’m looking for…”, “What does this icon mean?”, “Let me tap here”, “This is useful”. Fragments are fine.',
  warmupIntro: 'First, get to know the app. This step is only for practice and is not counted. If you get stuck, just ask the moderator.',
  warmupTasks: [
    'Find out when the next metro from Gärdet towards T-Centralen leaves.',
    'Zoom and pan the map, and see how the station icons change.',
    'Explore the app’s features freely.',
  ],
  warmupWait: (left) => `${left} left. Please keep exploring; the tasks start when the time is up.`,
  warmupReady: 'Warm-up time is over. Continue when you are ready.',
  roundIntro: 'This round has three tasks. Press “Start” when you begin a task and “Done” when you have finished it. Take your time: there is no time limit.',
  // Sightseeing metro stations = all three kinds in the guide: Art Interior, Art Exhibits, Scenic View.
  found: (n, total) => (n === 0 ? 'No sightseeing stations saved yet. Each sightseeing station you save as a favourite in the prototype counts.'
    : n < total ? `You have saved ${n}/${total} sightseeing stations:` : `You have saved ${total} sightseeing stations:`),
  foundExcluded: 'Stations saved in the first round don’t count.',
  guide: 'During the tasks you can open the “Stockholm Metro Art Guide” at any time. It is not part of the prototype; it is external reference material.',
  guideNote: 'External reference material · not part of the prototype',
  avoid: 'Stations saved in the first round (please choose other ones this time): ',
  touristMode: 'Before this round, please turn on Tourist Mode: tap the layers button at the top left of the map, and switch on Tourist Mode in Map Setting. A few intro cards will appear; you can read them or skip them.',
  touristModeOn: 'Tourist Mode is on. You can start the tasks.',
  roundDone: 'You have finished all three tasks of this round.',
  break: 'The first round is over. Take a break of a minute or two, and continue to the second round when you are ready.',
  interview: 'All tasks and questionnaires are done. Finally, please talk with the moderator about your experience (about 10 minutes).',
  thanks: 'Thank you very much for taking part!',
};
