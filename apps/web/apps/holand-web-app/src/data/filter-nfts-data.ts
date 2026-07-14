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
      '/brand/brand-mark-4x.svg',
    username: '@jamo254',
    avatar2:
      '/brand/brand-mark-4x.svg',
    username2: 'Renya',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/brand/brand-mark-4x.svg',
    endsAt: generateCountdownDate(9, 9),
  },
  {
    name: 'CodeCrafted',
    avatar:
      '/brand/brand-mark-4x.svg',
    username: '@jamo254',
    avatar2:
      '/brand/brand-mark-4x.svg',
    username2: 'Renya',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/brand/brand-mark-4x.svg',
    endsAt: generateCountdownDate(15, 5),
  },
  {
    name: 'Chronicles',
    avatar:
      '/brand/brand-mark-4x.svg',
    username: '@jamo254',
    avatar2:
      '/brand/brand-mark-4x.svg',
    username2: 'Renya',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/brand/brand-mark-4x.svg',
    endsAt: generateCountdownDate(5, 9),
  },
  {
    name: 'CyberSculpture ',
    avatar:
      '/brand/brand-mark-4x.svg',
    username: '@jamo254',
    avatar2:
      '/brand/brand-mark-4x.svg',
    username2: 'Renya',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/brand/brand-mark-4x.svg',
    endsAt: generateCountdownDate(7, 8),
  },
  {
    name: 'Quantum Pixel',
    avatar:
      '/brand/brand-mark-4x.svg',
    username: '@alex2001',
    avatar2:
      '/brand/brand-mark-4x.svg',
    username2: 'Benjamin',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/brand/brand-mark-4x.svg',
    endsAt: generateCountdownDate(7, 25),
  },
  {
    name: 'Gemstone Glyphs',
    avatar:
      '/brand/brand-mark-4x.svg',
    username: '@lily648',
    avatar2:
      '/brand/brand-mark-4x.svg',
    username2: 'Lily',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/brand/brand-mark-4x.svg',
    endsAt: generateCountdownDate(9, 21),
  },
  {
    name: 'Digital Dreamscapes',
    avatar:
      '/brand/brand-mark-4x.svg',
    username: '@emma1102',
    avatar2:
      '/brand/brand-mark-4x.svg',
    username2: 'William',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/brand/brand-mark-4x.svg',
    endsAt: generateCountdownDate(11, 25),
  },
  {
    name: 'Enigma Art',
    avatar:
      '/brand/brand-mark-4x.svg',
    username: '@jack',
    avatar2:
      '/brand/brand-mark-4x.svg',
    username2: 'Zoe',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/brand/brand-mark-4x.svg',
    endsAt: generateCountdownDate(13, 25),
  },
  {
    name: 'EtherLuxe Landscapes',
    avatar:
      '/brand/brand-mark-4x.svg',
    username: '@grace',
    avatar2:
      '/brand/brand-mark-4x.svg',
    username2: 'Jackson',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/brand/brand-mark-4x.svg',
    endsAt: generateCountdownDate(14, 25),
  },
  {
    name: 'CyberSculptures',
    avatar:
      '/brand/brand-mark-4x.svg',
    username: '@ethan',
    avatar2:
      '/brand/brand-mark-4x.svg',
    username2: 'Henry',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/brand/brand-mark-4x.svg',
    endsAt: generateCountdownDate(12, 25),
  },
  {
    name: 'Masterpieces',
    avatar:
      '/brand/brand-mark-4x.svg',
    username: '@sophia',
    avatar2:
      '/brand/brand-mark-4x.svg',
    username2: 'Elijah',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/brand/brand-mark-4x.svg',
    endsAt: generateCountdownDate(15, 25),
  },
  {
    name: 'Nebula Novelties',
    avatar:
      '/brand/brand-mark-4x.svg',
    username: '@luke056',
    avatar2:
      '/brand/brand-mark-4x.svg',
    username2: 'Charlotte',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/brand/brand-mark-4x.svg',
    endsAt: generateCountdownDate(16, 25),
  },
  {
    name: 'CryptoChroma Collection',
    avatar:
      '/brand/brand-mark-4x.svg',
    username: '@ruby945',
    avatar2:
      '/brand/brand-mark-4x.svg',
    username2: 'Samuel',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/brand/brand-mark-4x.svg',
    endsAt: generateCountdownDate(10, 25),
  },
  {
    name: 'Vortex Visions',
    avatar:
      '/brand/brand-mark-4x.svg',
    username: '@owen',
    avatar2:
      '/brand/brand-mark-4x.svg',
    username2: 'Andrew',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/brand/brand-mark-4x.svg',
    endsAt: generateCountdownDate(8, 25),
  },
  {
    name: 'Nature Wonders',
    avatar:
      '/brand/brand-mark-4x.svg',
    username: '@leo946',
    avatar2:
      '/brand/brand-mark-4x.svg',
    username2: 'Ava',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/brand/brand-mark-4x.svg',
    endsAt: generateCountdownDate(7, 25),
  },
  {
    name: 'Crystal Creations',
    avatar:
      '/brand/brand-mark-4x.svg',
    username: '@anna',
    avatar2:
      '/brand/brand-mark-4x.svg',
    username2: 'Abigail',
    currentBid: true,
    endsIn: '2023-12-31T23:59:59',
    thumbnail:
      '/brand/brand-mark-4x.svg',
    endsAt: generateCountdownDate(3, 25),
  },
];

