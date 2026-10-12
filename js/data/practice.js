// Sentence sets, connected speech, intonation, word stress, diagnostic and conversation scenarios.
export const SETS = [
  { id: 'wards', name: 'On the wards', items: [
    "Hi, I'm Doctor {name}, one of the doctors looking after you today.",
    "What brought you to the hospital?",
    "When did the chest pain start?",
    "Does the pain spread to your arm, jaw or back?",
    "Have you had any shortness of breath?",
    "Are you allergic to any medications?",
    "On a scale from zero to ten, how bad is the pain right now?",
    "I'm going to listen to your heart and lungs.",
    "Take a deep breath in, and let it out slowly.",
    "Your blood tests show that your kidneys are working well.",
    "We're starting a blood thinner to prevent a stroke.",
    "Is there anyone you'd like us to call?",
    "We'll check your kidney function again in the morning.",
    "Do you have any questions for me?" ] },
  { id: 'rounds', name: 'Rounds and handoffs', items: [
    "This is a sixty-eight-year-old man with heart failure and atrial fibrillation.",
    "He presented with three days of worsening shortness of breath.",
    "On exam, he had crackles at both bases and leg swelling.",
    "His troponin was mildly elevated but flat on repeat.",
    "The echo showed an ejection fraction of thirty percent.",
    "We diuresed him overnight, and he's down two liters.",
    "The plan is to continue diuresis and start guideline-directed therapy.",
    "Overnight, please watch his potassium and urine output.",
    "If his pressure drops below ninety, hold the diuretic and call me.",
    "Any questions before I hand off?" ] },
  { id: 'talks', name: 'Research talks', items: [
    "Thank you all for coming this afternoon.",
    "Let me walk you through the results.",
    "Our primary outcome was thirty-day readmission.",
    "The model's sensitivity was ninety-two percent.",
    "This figure compares the two groups side by side.",
    "Specificity was lower in patients with atrial fibrillation.",
    "We validated the algorithm on an external cohort.",
    "These findings are preliminary, so we should be cautious.",
    "That's a great question, and I'm glad you asked it.",
    "Does anyone have any other questions?" ] },
  { id: 'everyday', name: 'Everyday', items: [
    "I'd like a large coffee with oat milk, please.",
    "What time does the pharmacy close tonight?",
    "Could you send me the slides by Thursday?",
    "I think the weather will be better this weekend.",
    "Sorry, could you say that one more time?",
    "I'm running about ten minutes late.",
    "It was really nice to finally meet you.",
    "Very well, thank you. And you?",
    "Let's grab lunch sometime next week.",
    "I'll call you back in a few minutes." ] },
  { id: 'phone', name: 'Phone calls', items: [
    "Hi, this is Doctor {name} calling from the medical floor.",
    "I'm calling about your patient in room four-twelve.",
    "Could you please spell the last name for me?",
    "Let me read that back to make sure I have it right.",
    "I'll put the order in right away.",
    "Thanks so much for your help. Have a good night." ] },
];

// Lines grouped by teaching point.
export const CONNECTED = [
  { id: 'flap', name: 'Flap T', tip: 'Between vowels (and after r), American t becomes a quick tap, like a soft d: water = “wah-der”, better = “beh-der”. The tongue just flicks the ridge.',
    items: ["Get a bottle of water.", "It's better to wait a little.", "What is it?", "I need a lot of data.", "Put it on the computer.", "Matter of fact, it's getting better."] },
  { id: 'linking', name: 'Linking', tip: 'A word ending in a consonant links to a word starting with a vowel. “Check it out” sounds like “che-ki-tout”. Don’t pause between them.',
    items: ["Check it out.", "Turn it off.", "Pick it up at eleven.", "Hold on a minute.", "Is it an emergency?", "Fill in all of it."] },
  { id: 'reduce', name: 'Weak forms', tip: 'Small grammar words shrink when unstressed: to → tə, for → fər, and → ən, of → əv, can → kən, a → ə. Saying them fully sounds formal and slow.',
    items: ["I need to go to the store.", "It's for the patient in bed four.", "A cup of tea and a piece of cake.", "I can see you at ten.", "Some of them are ready.", "What do you want to do?"] },
  { id: 'glottal', name: 'Stopped T', tip: 'Before n (“button”, “certain”) and at the end of a phrase, t is often just a catch in the throat. The tongue goes up but there’s no release.',
    items: ["Press the button.", "I'm certain it's important.", "He's written a lot.", "Don't wait. Get it now.", "That's not right.", "The mountain is beautiful."] },
  { id: 'cant', name: 'Can vs can’t', tip: '“Can” is usually reduced (kən) and unstressed. “Can’t” keeps the full æ vowel, is stressed, and the t is often just a stop: “I kən go” vs “I KÆN’T go”.',
    items: ["I can come tomorrow.", "I can't come tomorrow.", "You can take it with food.", "You can't take it with alcohol.", "We can start now.", "We can't start yet."] },
];

export const INTONATION = [
  { id: 'statement', name: 'Statements fall', tip: 'Pitch steps up on the main stressed word near the end, then falls to the bottom of your range. A rise at the end sounds unsure.',
    items: ["I've reviewed your labs.", "The scan was normal.", "We'll see you in two weeks."] },
  { id: 'yesno', name: 'Yes/no questions rise', tip: 'Questions that start with do, is, are, can, have and similar words rise at the end.',
    items: ["Are you allergic to anything?", "Do you have any pain right now?", "Can you hear me okay?"] },
  { id: 'wh', name: 'Wh-questions fall', tip: 'Questions with what, where, when, why and how usually fall at the end, like statements. A rise can sound surprised or impatient.',
    items: ["Where does it hurt?", "When did it start?", "What medications do you take?"] },
  { id: 'list', name: 'Lists', tip: 'Each item rises a little; the last one falls. That fall tells the listener the list is finished.',
    items: ["We checked his heart, lungs, and kidneys.", "Bring your ID, your insurance card, and your medicine list."] },
  { id: 'choice', name: 'Choices', tip: 'In “A or B?”, A rises and B falls.',
    items: ["Is the pain sharp or dull?", "Would you like coffee or tea?"] },
  { id: 'contrast', name: 'Contrastive stress', tip: 'Stress the word that carries the new or contrasting information. Make it louder, longer and higher; let everything after it stay low.',
    items: ["I said the left arm, not the right.", "It's the second dose that matters.", "She's a cardiologist, not a neurologist."] },
  { id: 'groups', name: 'Thought groups', tip: 'Break long sentences into chunks of meaning. Each chunk has one main stress; pause briefly between chunks.',
    items: ["If the pain gets worse, call the nurse right away.", "Before you leave, make sure you have your discharge papers.", "When we looked at the data, the results were surprising."] },
];

const sy = (s, k, say, pos) => ({ s: s.split('·'), k, say: say || s.replace(/·/g, ''), pos: pos || '', w: s.replace(/·/g, '') });
export const STRESS = [
  { id: 'clinical', name: 'Clinical', items: [sy('hy·per·ten·sion', 2), sy('pneu·mo·nia', 1), sy('ech·o·car·di·o·gram', 2), sy('e·lec·tro·car·di·o·gram', 3), sy('car·di·o·my·op·a·thy', 4), sy('an·ti·co·ag·u·la·tion', 5), sy('am·y·loi·do·sis', 3), sy('ar·rhyth·mi·a', 1), sy('fib·ril·la·tion', 2), sy('a·tri·al', 0), sy('di·ag·no·sis', 2), sy('cath·e·ter', 0), sy('med·i·ca·tion', 2), sy('di·a·be·tes', 2), sy('ab·do·men', 0), sy('ven·tri·cle', 0), sy('sen·si·tiv·i·ty', 2), sy('spec·i·fic·i·ty', 2), sy('al·go·rithm', 0), sy('co·hort', 0)] },
  { id: 'shifts', name: 'Stress moves', items: [sy('pho·to·graph', 0), sy('pho·tog·ra·pher', 1), sy('pho·to·graph·ic', 2), sy('e·con·o·my', 1), sy('ec·o·nom·ic', 2), sy('a·nal·y·sis', 1), sy('an·a·lyze', 0), sy('an·a·lyt·i·cal', 2), sy('car·di·ac', 0), sy('car·di·ol·o·gy', 2), sy('di·ag·nose', 0), sy('di·ag·nos·tic', 2), sy('ther·a·py', 0), sy('ther·a·peu·tic', 2)] },
  { id: 'nounverb', name: 'Noun vs verb', items: [sy('rec·ord', 0, 'a record', 'noun'), sy('re·cord', 1, 'to record', 'verb'), sy('pres·ent', 0, 'a present', 'noun'), sy('pre·sent', 1, 'to present', 'verb'), sy('con·tract', 0, 'a contract', 'noun'), sy('con·tract', 1, 'to contract', 'verb'), sy('ob·ject', 0, 'an object', 'noun'), sy('ob·ject', 1, 'to object', 'verb'), sy('in·crease', 0, 'an increase', 'noun'), sy('in·crease', 1, 'to increase', 'verb'), sy('prog·ress', 0, 'progress', 'noun'), sy('pro·gress', 1, 'to progress', 'verb')] },
  { id: 'everyday', name: 'Everyday', items: [sy('de·vel·op', 1), sy('com·fort·a·ble', 0), sy('ho·tel', 1), sy('de·ter·mine', 1), sy('in·ter·est·ing', 0), sy('a·vail·a·ble', 1), sy('cat·e·go·ry', 0), sy('tech·nol·o·gy', 1), sy('veg·e·ta·ble', 0), sy('e·vent', 1), sy('ca·reer', 1), sy('Ju·ly', 1), sy('ad·dress', 1), sy('pho·tog·ra·phy', 1)] },
];
export const STRESS_RULES = [
  ['-tion, -sion', 'stress the syllable before: in·for·MA·tion, hy·per·TEN·sion'],
  ['-ic, -ical', 'stress the syllable before: ec·o·NOM·ic, car·di·o·LOG·i·cal'],
  ['-ity, -ify', 'stress two before: sen·si·TIV·i·ty, spe·CIF·ic'],
  ['-logy, -graphy', 'stress just before: car·di·OL·o·gy, pho·TOG·ra·phy'],
  ['two-syllable nouns', 'usually first: RE·cord, PRES·ent'],
  ['two-syllable verbs', 'usually second: re·CORD, pre·SENT'],
];

// Accent check: covers the contrasts that matter most for intelligibility.
export const CHECK = [
  "Thank you for thinking of three things on Thursday.",
  "They said the weather there is better than this.",
  "We were very worried the van would arrive late.",
  "Please sit in the seat and keep your feet still.",
  "The man said the bad pen was in his bag.",
  "Look, the cook took a good book to the pool.",
  "She chose some cheap shoes and a short shirt.",
  "Laura really likes the long road along the river.",
  "Zero visitors came to the busy zoo these days.",
  "Paul bought a boat on the coast in the fall.",
  "The nurse heard a murmur, but nothing was wrong.",
  "Are you able to walk up the stairs without stopping?",
];

export const SCENARIOS = [
  { id: 'admit', name: 'Admitting a patient', you: 'the admitting doctor', them: 'a 62-year-old patient with chest pain since this morning, a little anxious, a retired bus driver', opener: "Hi doctor. I've had this pressure in my chest since about six this morning." },
  { id: 'family', name: 'Talking with a family', you: 'the attending physician', them: 'the adult daughter of an elderly patient admitted with pneumonia and confusion; she is worried and asks direct questions', opener: "Hi, I'm Maria, his daughter. Nobody has really told us what's going on. Is he going to be okay?" },
  { id: 'rounds', name: 'Presenting on rounds', you: 'the resident presenting a patient', them: 'a busy attending physician on morning rounds who asks pointed follow-up questions', opener: "Morning. Who's first? Go ahead and present." },
  { id: 'qa', name: 'Conference Q&A', you: 'a researcher who just presented a study validating an AI model that reads ECGs', them: 'an audience member at a cardiology conference asking about methods, bias and real-world use', opener: "Thanks for the talk. How did you handle patients with paced rhythms or bundle branch blocks?" },
  { id: 'phone', name: 'Calling a pharmacy', you: 'a hospital doctor calling an outpatient pharmacy about a discharge prescription', them: 'a pharmacist who needs the drug, dose, frequency and patient details clarified', opener: "Good afternoon, Main Street Pharmacy, this is Jordan. How can I help you?" },
  { id: 'small', name: 'Small talk with colleagues', you: 'yourself, chatting before a meeting', them: 'a friendly American colleague who likes talking about weekends, food and sports', opener: "Hey! How was your weekend? Did you get up to anything fun?" },
  { id: 'interview', name: 'Job interview', you: 'a physician interviewing for a position', them: 'a hospital department chair interviewing a candidate for an academic hospitalist role', opener: "Thanks for coming in. Tell me a little about yourself and why you're interested in this position." },
];
