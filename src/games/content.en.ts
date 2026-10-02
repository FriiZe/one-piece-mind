/** Textes anglais des pages de jeu (voir content.ts). */
import type { LiveSlug } from "@/lib/games/catalog";
import type { GameContent } from "./content";

const SPOILER_FAQ = {
  question: "Can this game spoil me?",
  answer:
    "No. Before you play, you say whether you follow the anime or the manga. In anime mode, the game only draws characters who have already appeared in the anime and only shows information that has already been adapted.",
};

export const GAME_CONTENT_EN: Record<LiveSlug, GameContent> = {
  onepiecedle: {
    metaTitle: "OnePiecedle: guess today's One Piece character",
    metaDescription:
      "Guess the One Piece character of the day, the same for everyone. Each guess shows what you got right: gender, affiliation, fruit, Haki, bounty, height, origin, first arc.",
    intro:
      "Every day, one mystery character, the same for all players. Guess a name: the game tells you what your character has in common with the one to find. Cross-check the hints until you land on the right one.",
    howTo: [
      "Type a character's name and pick it from the list.",
      "Check the colors: green means the box is right, orange means it's partly right, red means it's wrong.",
      "For bounty, height and first arc, an arrow tells you whether the right value is higher or lower.",
      "Keep going until you find the character, then share your grid without giving away the answer.",
    ],
    faq: [
      {
        question: "What time does the daily character change?",
        answer: "At midnight, Paris time. Until you've found it, your guesses for the day are saved.",
      },
      {
        question: "What does an orange box mean?",
        answer:
          "That the answer is partly right: for example, some Haki types in common but not all of them, or a Zoan fruit when the character to find has a Mythical Zoan.",
      },
      {
        question: "Can I play more than once a day?",
        answer:
          "Yes: the “Free play” tab draws a random character, as many times as you like, with three difficulty levels.",
      },
      SPOILER_FAQ,
    ],
  },
  revelation: {
    metaTitle: "Reveal: guess the pixelated One Piece character",
    metaDescription:
      "A pixelated One Piece portrait that sharpens with each guess. Name the character in as few guesses as you can: eight pictures per game, three difficulty levels.",
    intro:
      "The portrait starts out as big blocks of color and only sharpens after each of your guesses. A hairstyle, a hat, a skin tone: it's up to you to recognize the character before the picture comes into focus.",
    howTo: [
      "Study the picture: it goes through six stages of sharpness, and only moves on when you get it wrong. Take your time, there's no timer.",
      "Type the character's name as soon as you recognize them.",
      "A right answer at the first stage is worth 6 points, then one point less at each stage.",
      "No idea? A button sharpens the picture without you naming anyone: it costs one stage, just like a wrong guess. Eight pictures per game, 48 points at most.",
    ],
    faq: [
      {
        question: "Does every character have a portrait?",
        answer:
          "No: nearly five hundred characters have one. The others never come up in this game, but they still show up in the list of answers.",
      },
      {
        question: "What happens if I can't work it out?",
        answer:
          "The picture never moves on by itself. At the last stage, a wrong guess reveals the answer and scores no points, and so does the “Skip” button.",
      },
      SPOILER_FAQ,
    ],
  },
  "zoom-extreme": {
    metaTitle: "Extreme Zoom: guess the One Piece character from a close-up",
    metaDescription:
      "A close-up of a One Piece portrait that zooms out with each guess. An eye, a scar, the edge of a hat: name the character in as few guesses as you can.",
    intro:
      "At first you only see one detail of the portrait, magnified five times: an eye, a lock of hair, a piece of clothing. The picture only widens after each of your guesses.",
    howTo: [
      "Study the detail on screen: the frame widens over six stages, and only moves on when you get it wrong. Take your time, there's no timer.",
      "Type the character's name as soon as you recognize them.",
      "A right answer at the first stage is worth 6 points, then one point less at each stage.",
      "No idea? A button zooms out without you naming anyone: it costs one stage, just like a wrong guess. Eight pictures per game, 48 points at most.",
    ],
    faq: [
      {
        question: "Which part of the picture is magnified?",
        answer:
          "A point picked at random in the top half of the portrait, where the face usually is. It changes every game.",
      },
      {
        question: "How is it different from Reveal?",
        answer:
          "In Reveal, you see the whole portrait, but blurred. Here the picture is sharp, but you only see a detail: the hints aren't the same.",
      },
      SPOILER_FAQ,
    ],
  },
  "avis-de-recherche": {
    metaTitle: "Wanted Poster: guess the One Piece pirate from their bounty",
    metaDescription:
      "A One Piece wanted poster with no name and no photo: work out who it is from the bounty alone. Every wrong guess reveals a hint, and every hint costs a point.",
    intro:
      "The poster is there, but the name and the photo are gone. All that's left is the bounty. It's up to you to work out who is wanted, with as few hints as possible.",
    howTo: [
      "Read the bounty printed on the poster and guess a character.",
      "If you're wrong, a hint is revealed: affiliation, home sea, arc of first appearance, then the initial.",
      "A poster is worth 5 points with no hints, then one point less for each hint revealed.",
      "Five posters per game, for a maximum of 25 points.",
    ],
    faq: [
      {
        question: "Several characters have the same bounty: how does the game decide?",
        answer:
          "Any answer that the information on screen can't tell apart from the right one is accepted. So as long as no hint has been revealed, two characters with the same bounty are both valid.",
      },
      {
        question: "Where do the bounties come from?",
        answer: "From each character's latest known bounty in the manga, or in the anime if you play in anime mode.",
      },
      SPOILER_FAQ,
    ],
  },
  "plus-ou-moins": {
    metaTitle: "Higher or Lower: compare One Piece bounties",
    metaDescription:
      "One Piece higher or lower: two characters, two bounties, which one is higher? Keep the right answers coming and beat your best streak on each difficulty level.",
    intro:
      "Two wanted posters side by side. You know the first bounty: is the second one higher or lower? The streak goes on for as long as you don't get one wrong.",
    howTo: [
      "Compare the bounty on screen with the second character's hidden bounty.",
      "Choose “Higher” or “Lower”.",
      "If you're right, the second character becomes the reference and a new one comes in.",
      "At your first mistake, the streak ends: your best is saved for each difficulty level.",
    ],
    faq: [
      {
        question: "Can two bounties be equal?",
        answer: "No, the game never pits two characters with the same bounty against each other.",
      },
      {
        question: "What does the difficulty change?",
        answer:
          "Easy only draws major characters. Expert adds supporting characters and extras, whose bounties are far less well known.",
      },
      SPOILER_FAQ,
    ],
  },
  "le-classement": {
    metaTitle: "The Ranking: sort One Piece characters by bounty, height or age",
    metaDescription:
      "Five One Piece characters to rank by bounty, by height or by age, from highest to lowest. Five rounds, one point for every character in the right spot.",
    intro:
      "Five characters, one criterion: bounty, height or age. It's up to you to put them back in order, from highest to lowest.",
    howTo: [
      "Read the round's criterion: bounty, height or age.",
      "Move the characters with the arrows until the order is right, with the highest at the top.",
      "Submit: each character in the right spot earns a point, and the real values are shown.",
      "Five rounds per game, for a maximum of 25 points.",
    ],
    faq: [
      {
        question: "Which heights and ages are used?",
        answer:
          "The most recent values given by the author, meaning the post-timeskip ones for the characters concerned.",
      },
      {
        question: "Can two characters have the same value?",
        answer: "No, the five characters in a round always have different values: there is only one right order.",
      },
      SPOILER_FAQ,
    ],
  },
  "type-de-fruit": {
    metaTitle: "Fruit Type: Paramecia, Zoan or Logia?",
    metaDescription:
      "Ten One Piece Devil Fruits: give the type of each one, Paramecia, Zoan or Logia. A quick Devil Fruit quiz to test how well you really know your fruits.",
    intro: "A Devil Fruit comes up under its Japanese name. Just one question: is it a Paramecia, a Logia or a Zoan?",
    howTo: [
      "Read the fruit's name.",
      "Pick its type: Paramecia, Logia or Zoan.",
      "The answer gives the exact type, for example Ancient Zoan or Mythical Zoan.",
      "Ten fruits per game: your best score is saved.",
    ],
    faq: [
      {
        question: "What's the difference between Paramecia, Zoan and Logia?",
        answer:
          "A Paramecia grants a superhuman power or alters the body. A Zoan lets its user turn into an animal, sometimes an ancient or mythical one. A Logia lets its user create an element, control it and turn into it.",
      },
      {
        question: "Are SMILEs part of the game?",
        answer: "No. Artificial fruits, such as SMILEs, are left out: only real Devil Fruits are drawn.",
      },
      SPOILER_FAQ,
    ],
  },
  "qui-a-mange-ce-fruit": {
    metaTitle: "Who Ate This Fruit? The One Piece Devil Fruit quiz",
    metaDescription:
      "Who ate which Devil Fruit? Name the user of each One Piece fruit, or the fruit of each character. Ten questions, four answers each, three difficulty levels.",
    intro:
      "The quiz works both ways: a fruit comes up and you have to say who ate it, or a character comes up and you have to name their fruit.",
    howTo: [
      "Choose a difficulty level.",
      "For each question, pick the right answer out of four.",
      "The right answer is shown straight away.",
      "Ten questions per game: your best is saved for each level.",
    ],
    faq: [
      {
        question: "What happens when a fruit has had several users?",
        answer:
          "Only one of the answers on offer is right: the other users of the same fruit are never offered as wrong answers.",
      },
      {
        question: "Which names are used for the fruits?",
        answer:
          "Their Japanese names, such as Gomu Gomu no Mi: the ones most anime fans use. When the romanized Japanese name is written differently, it is shown as well.",
      },
      SPOILER_FAQ,
    ],
  },
  "trouve-les-tous": {
    metaTitle: "Find Them All: name every member of a One Piece group",
    metaDescription:
      "The Straw Hats, the Warlords of the Sea, the Supernovas, Whitebeard's commanders: can you name every member of a One Piece group before the timer runs out?",
    intro:
      "Pick a group, start the timer and type the names as they come to you. Each name is filled in as soon as it's recognized: no need to submit.",
    howTo: [
      "Pick a group: a crew, an organization or a generation of pirates.",
      "Type the names one after another. A single name is enough when it only fits one member.",
      "The timer gives you twelve seconds per character, with a minimum of one minute.",
      "At the end, the members you forgot are shown in red.",
    ],
    faq: [
      {
        question: "Do I have to spell the names perfectly?",
        answer:
          "Accents, capital letters and punctuation are ignored, and the names from the French edition are accepted as well as the English ones. Everything else has to be right.",
      },
      {
        question: "Why are some groups missing?",
        answer:
          "In anime mode, a group is only offered if all its members have already appeared in the anime and its lineup has been revealed there.",
      },
      SPOILER_FAQ,
    ],
  },
  memo: {
    metaTitle: "One Piece Memory: match each character to their Devil Fruit",
    metaDescription:
      "A One Piece memory game: sixteen face-down cards, eight pairs. Match each character to their Devil Fruit by flipping as few cards as you can.",
    intro:
      "Sixteen cards face down. Eight show a character, eight show a Devil Fruit. It's up to you to rebuild the pairs, from memory.",
    howTo: [
      "Flip two cards: if the character did eat that fruit, the pair stays face up.",
      "If not, both cards flip back after one second: remember where they are.",
      "The game ends when all eight pairs are found. The fewer moves you make, the more you score.",
    ],
    faq: [
      {
        question: "How is the score worked out?",
        answer:
          "A game with no mistakes takes 8 moves and is worth 16 points. Each extra move takes off one point, with a minimum of one point.",
      },
      {
        question: "Can two characters have the same fruit in one game?",
        answer:
          "No. When a fruit has had several users, only one of them is drawn: each card has only one matching card.",
      },
      SPOILER_FAQ,
    ],
  },
  wordle: {
    metaTitle: "One Piece Wordle: guess the character's name in six tries",
    metaDescription:
      "One Piece Wordle: guess a character's name in six tries. Letters in the right spot turn green, letters in the wrong spot turn orange, the rest turn gray.",
    intro:
      "A character's name is hiding behind the tiles. Enter a word of the right length: the colors tell you which letters are in the right spot.",
    howTo: [
      "Type a word with the number of letters shown and submit it.",
      "Green: the letter is in the right spot. Orange: it's in the name, but somewhere else. Gray: it isn't in the name.",
      "You get six tries. From the fourth one on, the character's affiliation is given as a hint.",
    ],
    faq: [
      {
        question: "Do I have to enter a real character name?",
        answer: "No. Any string of letters of the right length is accepted, which lets you test letters.",
      },
      {
        question: "Which names can come up?",
        answer:
          "Single-word names of 4 to 8 letters, written without accents. The difficulty you choose sets how well known the characters are.",
      },
      SPOILER_FAQ,
    ],
  },
  anagramme: {
    metaTitle: "One Piece Anagram: unscramble the character's name",
    metaDescription:
      "A One Piece anagram game: eight character names with their letters scrambled. Unscramble each name, with the character's affiliation as your only hint.",
    intro: "The letters of a character's name have been scrambled. It's up to you to put it back together.",
    howTo: [
      "Look at the scrambled letters and the affiliation given as a hint.",
      "Type the name and submit. If you're wrong, you can try again as many times as you like.",
      "If you're stuck, skip: the answer is shown and you don't score the point. Eight names per game.",
    ],
    faq: [
      {
        question: "Do accents matter?",
        answer: "No. Accents and capital letters are ignored: only the order of the letters matters.",
      },
      {
        question: "Which names get scrambled?",
        answer: "Single-word names of 5 to 10 letters. The higher the difficulty, the less well known the characters.",
      },
      SPOILER_FAQ,
    ],
  },
  "les-indices": {
    metaTitle: "Clues: guess the One Piece character with the fewest clues",
    metaDescription:
      "Guess a One Piece character from clues that get more and more precise: arc, origin, fruit, Haki, affiliation, bounty. The fewer you use, the more you score.",
    intro:
      "The first clue is vague, the last one almost gives the answer away. It's up to you to find the character as early as possible.",
    howTo: [
      "Read the first clue and guess a character.",
      "Each wrong guess reveals the next clue; you can also ask for one without guessing a name.",
      "A round is worth 10 points with a single clue, then one point less for each clue revealed, never dropping below 5. Once the initial is shown, it's only worth 2. Five rounds per game.",
    ],
    faq: [
      {
        question: "What order do the clues come in?",
        answer:
          "The arc of first appearance, the origin, the Devil Fruit type, the Haki, the affiliation, the bounty, then the initial of the name.",
      },
      {
        question: "What happens if I get it wrong on the last clue?",
        answer:
          "The round is lost and the answer is shown. You can also skip a round at any time, without scoring any points.",
      },
      SPOILER_FAQ,
    ],
  },
  surnoms: {
    metaTitle: "One Piece Epithets: who is the “Surgeon of Death”?",
    metaDescription:
      "A One Piece epithet quiz: ten epithets, four characters to choose from each time. Work out who goes by “Cat Burglar” or “Knight of the Sea”.",
    intro:
      "Every famous pirate has an epithet, printed on their wanted poster. Can you give each one back to its owner?",
    howTo: [
      "Read the epithet on screen.",
      "Pick the character who goes by it out of the four on offer.",
      "The right answer is shown straight away. Ten epithets per game.",
    ],
    faq: [
      {
        question: "Are the epithets given in English?",
        answer:
          "Yes, as far as possible: the epithets are given in English. Code names, like those of the Baroque Works agents or the admirals, are included.",
      },
      {
        question: "Does every character have an epithet?",
        answer: "No. The game covers about seventy characters whose epithet is well established.",
      },
      SPOILER_FAQ,
    ],
  },
  orthographe: {
    metaTitle: "One Piece Spelling: can you spell the characters' names?",
    metaDescription:
      "Donquixote or Don Quixote? A One Piece spelling quiz: ten characters, four spellings of each name. Only one is right, and the others are just one letter off.",
    intro:
      "One Piece names are full of traps. The portrait tells you who it is: it's up to you to pick the right spelling out of four.",
    howTo: [
      "Look at the portrait and the affiliation: they tell you which character it is.",
      "Pick the correct spelling of their name out of the four on offer.",
      "The other three are only one letter off: read carefully. Ten names per game.",
    ],
    faq: [
      {
        question: "Which spelling is the reference?",
        answer:
          "The one used by the English-language One Piece wiki, which can differ from the anime subtitles for a few characters.",
      },
      {
        question: "What kind of mistakes are slipped into the wrong answers?",
        answer:
          "Two swapped letters, a consonant doubled or undoubled, a vowel replaced by a similar one: subtle mistakes, never on the first letter.",
      },
      SPOILER_FAQ,
    ],
  },
  emojis: {
    metaTitle: "One Piece Emojis: guess the character from a few emojis",
    metaDescription:
      "A straw hat, some meat, a pirate flag: who is it? Guess five One Piece characters from just a few emojis. Each wrong guess reveals a clue.",
    intro: "A few emojis sum up a character: their looks, their power, their quirks. It's up to you to recognize them.",
    howTo: [
      "Look at the emojis and guess a character.",
      "Each wrong guess reveals a clue: the home sea, the affiliation, the arc of first appearance, then the initial.",
      "A round is worth 5 points with no clues, then one point less per clue. Five rounds per game.",
    ],
    faq: [
      {
        question: "How many characters have an emoji riddle?",
        answer: "About sixty for now, among the best known in the series.",
      },
      {
        question: "The emojis don't display properly on my device. What can I do?",
        answer:
          "Some recent emojis aren't drawn by every system. The clues that follow still let you find the character.",
      },
      SPOILER_FAQ,
    ],
  },
  "devine-la-prime": {
    metaTitle: "Guess the Bounty: estimate One Piece pirates' bounties",
    metaDescription:
      "Eight One Piece characters with a bounty: estimate each one with the slider. The closer you get to the real value, the more points you score.",
    intro:
      "One character, one slider: it's up to you to estimate their bounty. No need to hit it exactly, you just have to be close.",
    howTo: [
      "Move the slider to the bounty you have in mind, then submit.",
      "You score 5 points if you're within 10%, then fewer and fewer: 1 point as long as you're not off by more than a factor of three.",
      "Eight characters per game, for a maximum of 40 points.",
    ],
    faq: [
      {
        question: "Why does the slider move so fast toward the big bounties?",
        answer:
          "Bounties range from one million to several billion: the slider follows a scale that gives every order of magnitude the same amount of room.",
      },
      {
        question: "Which bounty is used?",
        answer: "The character's latest known bounty, in the manga or in the anime depending on your mode.",
      },
      SPOILER_FAQ,
    ],
  },
  "grand-ou-vieux": {
    metaTitle: "Taller or Older: which One Piece character is taller, or older?",
    metaDescription:
      "Ten head-to-head duels between One Piece characters: who is taller? Who is older? The official heights have a few surprises in store for you.",
    intro: "Two characters face to face. A question that only looks simple: who is taller, or older?",
    howTo: [
      "Read the question: it's about height or age.",
      "Pick one of the two characters.",
      "The answer gives both values. Ten duels per game.",
    ],
    faq: [
      {
        question: "Where do the heights and ages come from?",
        answer:
          "From the official profiles published by the author. For the characters concerned, these are the post-timeskip values.",
      },
      {
        question: "Can two characters be the same height?",
        answer: "No, the two characters in a duel always have different values.",
      },
      SPOILER_FAQ,
    ],
  },
  "premiere-apparition": {
    metaTitle: "First Appearance: guess each One Piece character's debut chapter",
    metaDescription:
      "Eight One Piece characters: estimate the chapter, or the episode, of their first appearance. The closer you get, the more points you score.",
    intro:
      "You remember the arc, but the number? Set the slider to the chapter or episode where the character first appears.",
    howTo: [
      "Move the slider to the number you have in mind, then submit.",
      "You score 5 points if you're within ten chapters or so, then fewer and fewer as the gap widens.",
      "Eight characters per game, for a maximum of 40 points.",
    ],
    faq: [
      {
        question: "Chapters or episodes?",
        answer: "Episodes if you play in anime mode, chapters if you play in manga mode.",
      },
      {
        question: "Does a flashback appearance count?",
        answer: "Yes: it's the character's very first appearance that counts, even in a flashback or as a silhouette.",
      },
      SPOILER_FAQ,
    ],
  },
  "prime-d-equipage": {
    metaTitle: "Crew Bounty: estimate a One Piece crew's total bounty",
    metaDescription:
      "How much are the Straw Hat Pirates worth? The Blackbeard Pirates? The Beasts Pirates? Estimate the total of each One Piece crew's known bounties.",
    intro:
      "Add up a whole crew's bounties in your head, then set the slider. The closer you get to the total, the more you score.",
    howTo: [
      "Read the crew's name and how many of its members have a bounty.",
      "Move the slider to the total you have in mind, then submit.",
      "Eight crews per game, for a maximum of 40 points.",
    ],
    faq: [
      {
        question: "Which bounties are added up?",
        answer:
          "The latest known bounties of the crew members who are in the game. So the total can be lower than the official figure when a member is missing.",
      },
      {
        question: "Which crews can come up?",
        answer: "Those with at least three members who have a bounty.",
      },
      SPOILER_FAQ,
    ],
  },
  equipage: {
    metaTitle: "Crew: which organization does this One Piece character belong to?",
    metaDescription:
      "Which crew are they in? Ten One Piece characters to match with their crew or organization: pirates, Marines, revolutionaries, kingdoms. Four choices each time.",
    intro: "Pirate, Marine, revolutionary? Work out each character's crew or organization.",
    howTo: [
      "Read the character's name, and look at their portrait when there is one.",
      "Pick their organization out of the four on offer.",
      "The right answer is shown straight away. Ten characters per game.",
    ],
    faq: [
      {
        question: "Which affiliation is used when a character has had several?",
        answer: "Their current affiliation, or the last known one for a character who has died.",
      },
      {
        question: "What does the difficulty change?",
        answer: "Easy sticks to major characters. Expert adds supporting characters and extras.",
      },
      SPOILER_FAQ,
    ],
  },
  haki: {
    metaTitle: "Haki: which types of Haki does this One Piece character use?",
    metaDescription:
      "Observation, Armament, Conqueror's Haki: ten One Piece characters, and for each one the right combination of Haki types to pick out of four.",
    intro: "Some have none, others have all three. Work out each character's Haki.",
    howTo: [
      "Read the character's name.",
      "Pick the right combination: no Haki, just one type, two, or all three.",
      "The right answer is shown straight away. Ten characters per game.",
    ],
    faq: [
      {
        question: "What are the three types of Haki?",
        answer:
          "Observation Haki, which senses presences and anticipates attacks; Armament Haki, which hardens the body; and Conqueror's Haki, which only a chosen few possess.",
      },
      {
        question: "Does Haki used only in a movie count?",
        answer: "No. Only Haki shown in the manga is counted.",
      },
      SPOILER_FAQ,
    ],
  },
  techniques: {
    metaTitle: "One Piece Techniques: whose attack is this?",
    metaDescription:
      "Gomu Gomu no Pistol, Room, Diable Jambe: a One Piece attack quiz with ten techniques and four characters to choose from each time. Who uses what?",
    intro: "The name of an attack comes up. It's up to you to find the character who shouts it in battle.",
    howTo: [
      "Read the name of the technique.",
      "Pick the character who uses it out of the four on offer.",
      "The right answer is shown straight away. Ten techniques per game.",
    ],
    faq: [
      {
        question: "What language are the technique names in?",
        answer: "In their original form, as you hear them in the anime in Japanese.",
      },
      {
        question: "Can a technique shared by several characters come up?",
        answer: "No. Only techniques that belong to a single character are used.",
      },
      SPOILER_FAQ,
    ],
  },
  "armes-et-sabres": {
    metaTitle: "One Piece Weapons and Swords: who wields Yoru, Shigure, Kikoku?",
    metaDescription:
      "A One Piece sword and weapon quiz: ten famous weapons, legendary swords first and foremost. Find the character who wields each one out of four choices.",
    intro: "Legendary swords, a weather staff, a trident: every weapon has its wielder. Can you match them up?",
    howTo: [
      "Read the weapon's name and what kind of weapon it is.",
      "Pick the character who wields it out of the four on offer.",
      "The right answer is shown straight away. Ten weapons per game.",
    ],
    faq: [
      {
        question: "Which wielder is used when a weapon has changed hands?",
        answer: "The best-known wielder. Weapons whose ownership is open to debate aren't used.",
      },
      {
        question: "Is it only swords?",
        answer: "No: you'll also find a club, a trident, a giant slingshot or a weather staff.",
      },
      SPOILER_FAQ,
    ],
  },
  navires: {
    metaTitle: "One Piece Ships: which crew does this ship belong to?",
    metaDescription:
      "Going Merry, Moby Dick, Oro Jackson, Polar Tang: a One Piece ship quiz with ten ships to return to their crew, and four choices each time.",
    intro: "A ship's name comes up. Which crew does it belong to?",
    howTo: [
      "Read the ship's name.",
      "Pick its crew out of the four on offer.",
      "The right answer is shown straight away. Ten ships per game.",
    ],
    faq: [
      {
        question: "How many ships are in the game?",
        answer: "Twenty-six for now, among the best known in the series.",
      },
      {
        question: "Why is there no difficulty level?",
        answer: "Because there aren't many named ships: any of them can come up in the same game.",
      },
      SPOILER_FAQ,
    ],
  },
  "origine-et-race": {
    metaTitle: "Origin and Race: where do One Piece characters come from?",
    metaDescription:
      "East Blue, Grand Line, Sky Islands? Human, Fish-Man, Mink, Giant? Ten questions on the home sea and the race of One Piece characters.",
    intro: "Every other question is about the home sea, the rest about race. Ten characters to place.",
    howTo: [
      "Read the question: the character's home sea or race.",
      "Pick the right answer out of the four on offer.",
      "The right answer is shown straight away. Ten questions per game.",
    ],
    faq: [
      {
        question: "What is the answer for a mixed-race character?",
        answer:
          "The character's non-human race is the right answer, and their other race is never offered as a wrong answer.",
      },
      {
        question: "Are the Grand Line and the New World counted separately?",
        answer: "No. The New World is the second half of the Grand Line: both are grouped under Grand Line.",
      },
      SPOILER_FAQ,
    ],
  },
  chronologie: {
    metaTitle: "One Piece Timeline: put the arcs back in order",
    metaDescription:
      "Do you know the order of the One Piece arcs? Five arcs, or five characters, to put back in story order. Five rounds, one point for every item in the right spot.",
    intro: "Before or after Alabasta? Put the arcs, then the characters, back in the order they come up in the story.",
    howTo: [
      "Read the instruction: you're ordering either arcs, or characters by order of appearance.",
      "Move the items with the arrows, with the earliest at the top.",
      "Submit: each item in the right spot earns a point. Five rounds per game.",
    ],
    faq: [
      {
        question: "Which order is used for the characters?",
        answer:
          "The order of their first appearance in the manga. The five characters in a round always come from five different arcs.",
      },
      {
        question: "Are anime-only arcs included?",
        answer: "No, only manga arcs are used.",
      },
      SPOILER_FAQ,
    ],
  },
  "dans-quel-arc": {
    metaTitle: "Which Arc? The first appearance of One Piece characters",
    metaDescription:
      "Ten One Piece characters: in which arc does each one first appear? Four arcs to choose from for every question, and flashback appearances count.",
    intro: "You know the character, but do you remember the arc where they make their entrance?",
    howTo: [
      "Read the character's name, and look at their portrait when there is one.",
      "Pick the arc of their first appearance out of the four on offer.",
      "The right answer is shown straight away. Ten characters per game.",
    ],
    faq: [
      {
        question: "Does a flashback appearance count?",
        answer:
          "Yes. It's the arc where the character is seen for the very first time that counts, even if they play no part in it.",
      },
      {
        question: "Which arcs are offered?",
        answer: "The manga arcs, up to the last one you know according to your mode.",
      },
      SPOILER_FAQ,
    ],
  },
  "vrai-ou-faux": {
    metaTitle: "One Piece True or False: ten statements to settle",
    metaDescription:
      "Ten statements about One Piece characters: Devil Fruit, bounty, Haki, origin, affiliation. True or false? A quick quiz to play again and again.",
    intro: "One statement, two buttons. Ten times in a row, without overthinking it.",
    howTo: [
      "Read the statement.",
      "Answer true or false.",
      "The answer sets the record straight. Ten statements per game.",
    ],
    faq: [
      {
        question: "What are the statements about?",
        answer:
          "The Devil Fruit type, the affiliation, a comparison of two bounties, Conqueror's Haki, the arc of first appearance and the home sea.",
      },
      {
        question: "Is there as much true as false?",
        answer: "On average, yes: each statement has a one-in-two chance of being true.",
      },
      SPOILER_FAQ,
    ],
  },
  "mode-aleatoire": {
    metaTitle: "Random Mode: ten One Piece questions drawn from every quiz",
    metaDescription:
      "A One Piece quiz that draws from all the others: crews, Haki, techniques, epithets, ships, arcs. Ten questions, never the same ones.",
    intro: "Not sure what to play? This mode draws its questions from all of the site's quizzes.",
    howTo: [
      "Choose a difficulty level.",
      "Answer the ten questions: each one comes from a quiz picked at random, with its own instruction.",
      "The right answer is shown after each answer.",
    ],
    faq: [
      {
        question: "Which games are the questions drawn from?",
        answer:
          "Crew, Ships, Origin and Race, Which Arc?, True or False, Techniques, Weapons and Swords, Epithets, Spelling, Taller or Older and Haki.",
      },
      {
        question: "Can the same question come up twice?",
        answer: "Not in the same game.",
      },
      SPOILER_FAQ,
    ],
  },
  "duo-carre-cash": {
    metaTitle: "Duo, Quad or Cash: the One Piece quiz where you pick your risk",
    metaDescription:
      "A One Piece quiz in Duo, Quad or Cash: two choices for 1 point, four for 3 points, none for 5 points. Ten questions on crews, techniques, epithets and arcs.",
    intro:
      "Before every answer, you pick your risk. Duo: two choices, 1 point. Quad: four choices, 3 points. Cash: no choices, you type the answer, and it's worth 5 points.",
    howTo: [
      "Choose a difficulty level.",
      "Read the question, then choose Duo, Quad or Cash. Once the choices are on screen, you can't change your mind.",
      "In Cash, type your answer: capitalization, accents and a small typo don't matter.",
      "The right answer is shown after each answer. The maximum score is 50 points.",
    ],
    faq: [
      {
        question: "How is a Cash answer judged?",
        answer:
          "It's compared with the right answer ignoring capital letters, accents and punctuation, and one typo is allowed. For a character, the name they usually go by is enough: “Luffy” counts as “Monkey D. Luffy”. For a crew, “Straw Hat” counts as “Straw Hat Pirates”.",
      },
      {
        question: "What are the questions about?",
        answer: "Crews, ships, home seas and races, arcs, techniques, weapons and epithets.",
      },
      {
        question: "Can I play quizzes written by other players?",
        answer:
          "Yes. The “Community quizzes” page gathers the quizzes made by players, which are also played in Duo, Quad or Cash. With an account, you can create your own.",
      },
      SPOILER_FAQ,
    ],
  },
  rires: {
    metaTitle: "One Piece Laughs: whose laugh is this?",
    metaDescription:
      "Shishishi, Zehahaha, Kishishishi: ten One Piece laughs written out as in the manga. Each time, find the character who laughs that way.",
    intro:
      "In One Piece, almost every character has a laugh of their own. Ten laughs, written out as in the manga: it's up to you to give each one back to its owner.",
    howTo: [
      "Read the laugh on screen.",
      "Out of four characters, pick the one who laughs that way.",
      "The right answer is shown after each answer. Ten questions per game.",
    ],
    faq: [
      {
        question: "Can I listen to the laughs?",
        answer: "Not for now: the laughs are written out, as in the manga.",
      },
      {
        question: "Can the same laugh point to two characters?",
        answer:
          "No: each laugh on the list belongs to just one character. Those shared by several characters have been left out.",
      },
      SPOILER_FAQ,
    ],
  },
  connexions: {
    metaTitle: "One Piece Connections: sixteen characters, four hidden groups",
    metaDescription:
      "One Piece Connections: sixteen characters to sort into four hidden groups of four. A crew, a home sea, a fruit type, an arc? Four mistakes allowed.",
    intro:
      "Sixteen characters, four groups of four. What links them isn't stated: a crew, a home sea, a fruit type, an arc. It's up to you to find the four groups.",
    howTo: [
      "Select four characters you think are linked, then submit.",
      "If they form a group, it's revealed along with its name. If not, you lose one of your four allowed mistakes.",
      "The game lets you know when just one of the four is out of place.",
      "One point for each group found.",
    ],
    faq: [
      {
        question: "Can a character belong to two groups?",
        answer: "No: in every grid, each character fits only one of the four groups.",
      },
      {
        question: "What are the groups based on?",
        answer:
          "An affiliation, a famous lineup (Supernovas, Warlords of the Sea…), a home sea, a race, a fruit type, Conqueror's Haki, a bounty of one billion or an arc of first appearance.",
      },
      SPOILER_FAQ,
    ],
  },
  grille: {
    metaTitle: "One Piece 3×3 Grid: cross two criteria in every square",
    metaDescription:
      "A nine-square grid to fill with One Piece characters: every square crosses two criteria, such as a crew and a fruit type. One guess per square.",
    intro:
      "Three criteria across the rows, three down the columns. Each square needs a character who meets both at once: a Marine who ate a Logia fruit, for example.",
    howTo: [
      "Click a square, then type the name of a character who meets both its criteria.",
      "You only get one guess per square, and a character can only be used once.",
      "At the end, the squares you missed show a possible answer. One point per correct square.",
    ],
    faq: [
      {
        question: "Is there only one right answer per square?",
        answer:
          "No: any answer that meets both criteria is accepted. On Easy, every square has several well-known answers; on Expert, sometimes just one.",
      },
      {
        question: "Which criteria can come up?",
        answer:
          "For the rows, an affiliation, a group, a home sea or an arc. For the columns, a fruit type, Haki, a bounty, a gender, a race, a height or an age.",
      },
      SPOILER_FAQ,
    ],
  },
  "recrute-ton-equipage": {
    metaTitle: "Recruit Your Crew: rank ten One Piece bounties blind",
    metaDescription:
      "Ten One Piece characters drawn one by one, ten posts from captain to cabin boy: place each one without knowing who comes next, from highest bounty to lowest.",
    intro:
      "Ten characters show up one by one. You give each of them a post, from captain to cabin boy, without knowing who is coming next. The ideal crew ranks the bounties from highest to lowest.",
    howTo: [
      "Look at the character drawn, then click the post you're giving them: the captain should have the highest bounty, the cabin boy the lowest.",
      "Once a post is given, you can't take it back.",
      "At the end, the bounties are revealed: 5 points for a character in the right post, one less for each post they're off by. Maximum: 50 points.",
    ],
    faq: [
      {
        question: "Are the bounties shown during the game?",
        answer: "No, only at the end: it's your knowledge of bounties that makes the difference.",
      },
      {
        question: "How are the points counted?",
        answer:
          "The character with the highest bounty should be captain, the next one first mate, and so on. Each character earns 5 points in the right post, 4 when one post off, down to 0 when five posts off.",
      },
      SPOILER_FAQ,
    ],
  },
  "la-route-de-grand-line": {
    metaTitle: "The Grand Line Route: sail through One Piece arc by arc",
    metaDescription:
      "One island per arc, in story order, and one question per island. Three lives, a boss every five islands: how far will you get on the Grand Line route?",
    intro:
      "One island per arc, from Romance Dawn up to wherever you've got to. On each island, a question about the characters who appear there. Three lives to get as far as you can.",
    howTo: [
      "Answer the island's question: a right answer conquers it, a wrong one costs a life.",
      "Every five islands, a boss: failing it costs two lives, beating it gives one back.",
      "The voyage ends when you run out of lives, or at the end of the route. One point per island conquered.",
    ],
    faq: [
      {
        question: "How many islands are there on the route?",
        answer: "One per manga arc, or per arc already adapted if you play in anime mode: about thirty in all.",
      },
      {
        question: "What are the questions about?",
        answer:
          "The characters who first appear in the island's arc: their affiliation, their origin, their Haki, the spelling of their name.",
      },
      SPOILER_FAQ,
    ],
  },
  "den-den-devin": {
    metaTitle: "Den Den Oracle: the Transponder Snail guesses your One Piece character",
    metaDescription:
      "Think of a One Piece character without saying who: the Transponder Snail asks up to twenty questions about their crew, fruit or bounty, then guesses who it is.",
    intro:
      "Think of a character, without saying who. The Transponder Snail asks you questions (their crew, their fruit, their bounty, their origin) and ends up guessing a name.",
    howTo: [
      "Think of a One Piece character.",
      "Answer each question with Yes, No or I don't know.",
      "After twenty questions at most, the Transponder Snail guesses a name. If it gets it wrong three times, it admits defeat and shows you where your answers and its notes don't match.",
    ],
    faq: [
      {
        question: "Does this game earn Berries?",
        answer:
          "No: you're the one who says whether the Transponder Snail got it right, and the site can't check. It's played just for fun.",
      },
      {
        question: "Why does the Transponder Snail sometimes get it wrong?",
        answer:
          "All it knows about a character is their profile: affiliation, fruit, Haki, bounty, origin, height, age. It can't tell apart two minor characters with identical profiles: it then guesses the better-known one.",
      },
      SPOILER_FAQ,
    ],
  },
};
