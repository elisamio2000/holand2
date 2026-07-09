function generateCountdownDate(hour: number = 5, minute: number = 10) {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(date.getHours() - hour);
  date.setMinutes(date.getMinutes() - minute);
  return date;
}

export const filterNftsData = [
  {
    name: 'Ingrid Swril',
    avatar:
      '/logo.png',
    username: '@jamo254',
    avatar2:
      '/logo.png',
    username2: 'Renya',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/logo.png',
    endsAt: generateCountdownDate(9, 9),
  },
  {
    name: 'CodeCrafted',
    avatar:
      '/logo.png',
    username: '@jamo254',
    avatar2:
      '/logo.png',
    username2: 'Renya',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/logo.png',
    endsAt: generateCountdownDate(15, 5),
  },
  {
    name: 'Chronicles',
    avatar:
      '/logo.png',
    username: '@jamo254',
    avatar2:
      '/logo.png',
    username2: 'Renya',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/logo.png',
    endsAt: generateCountdownDate(5, 9),
  },
  {
    name: 'CyberSculpture ',
    avatar:
      '/logo.png',
    username: '@jamo254',
    avatar2:
      '/logo.png',
    username2: 'Renya',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/logo.png',
    endsAt: generateCountdownDate(7, 8),
  },
  {
    name: 'Quantum Pixel',
    avatar:
      '/logo.png',
    username: '@alex2001',
    avatar2:
      '/logo.png',
    username2: 'Benjamin',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/logo.png',
    endsAt: generateCountdownDate(7, 25),
  },
  {
    name: 'Gemstone Glyphs',
    avatar:
      '/logo.png',
    username: '@lily648',
    avatar2:
      '/logo.png',
    username2: 'Lily',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/logo.png',
    endsAt: generateCountdownDate(9, 21),
  },
  {
    name: 'Digital Dreamscapes',
    avatar:
      '/logo.png',
    username: '@emma1102',
    avatar2:
      '/logo.png',
    username2: 'William',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/logo.png',
    endsAt: generateCountdownDate(11, 25),
  },
  {
    name: 'Enigma Art',
    avatar:
      '/logo.png',
    username: '@jack',
    avatar2:
      '/logo.png',
    username2: 'Zoe',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/logo.png',
    endsAt: generateCountdownDate(13, 25),
  },
  {
    name: 'EtherLuxe Landscapes',
    avatar:
      '/logo.png',
    username: '@grace',
    avatar2:
      '/logo.png',
    username2: 'Jackson',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/logo.png',
    endsAt: generateCountdownDate(14, 25),
  },
  {
    name: 'CyberSculptures',
    avatar:
      '/logo.png',
    username: '@ethan',
    avatar2:
      '/logo.png',
    username2: 'Henry',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/logo.png',
    endsAt: generateCountdownDate(12, 25),
  },
  {
    name: 'Masterpieces',
    avatar:
      '/logo.png',
    username: '@sophia',
    avatar2:
      '/logo.png',
    username2: 'Elijah',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/logo.png',
    endsAt: generateCountdownDate(15, 25),
  },
  {
    name: 'Nebula Novelties',
    avatar:
      '/logo.png',
    username: '@luke056',
    avatar2:
      '/logo.png',
    username2: 'Charlotte',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/logo.png',
    endsAt: generateCountdownDate(16, 25),
  },
  {
    name: 'CryptoChroma Collection',
    avatar:
      '/logo.png',
    username: '@ruby945',
    avatar2:
      '/logo.png',
    username2: 'Samuel',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/logo.png',
    endsAt: generateCountdownDate(10, 25),
  },
  {
    name: 'Vortex Visions',
    avatar:
      '/logo.png',
    username: '@owen',
    avatar2:
      '/logo.png',
    username2: 'Andrew',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/logo.png',
    endsAt: generateCountdownDate(8, 25),
  },
  {
    name: 'Nature Wonders',
    avatar:
      '/logo.png',
    username: '@leo946',
    avatar2:
      '/logo.png',
    username2: 'Ava',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/logo.png',
    endsAt: generateCountdownDate(7, 25),
  },
  {
    name: 'Crystal Creations',
    avatar:
      '/logo.png',
    username: '@anna',
    avatar2:
      '/logo.png',
    username2: 'Abigail',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/logo.png',
    endsAt: generateCountdownDate(3, 25),
  },
];
