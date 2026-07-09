import { getRandomArrayElement } from '@core/utils/get-random-array-element';

const reviewStatus = ['Approved', 'Rejected', 'Pending'];

import { avatarIds } from '@core/utils/get-avatar';

export type Review = {
  id: string;
  product: {
    name: string;
    category: string;
    image: string;
  };
  review: string;
  customer: number;
  status: string;
  rating: number;
  createdAt: Date;
};

export const productReviews = [
  {
    id: '13803',
    product: {
      name: 'Modern Frozen Sausages',
      category: 'Books',
      image:
        '/logo.png',
    },
    review:
      'The Apollotech B340 is an affordable wireless mouse with reliable connectivity, 12 months battery life and modern design',
    customer: {
      name: 'Karen Russel',
      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 4,
    createdAt: new Date('2022-11-12T13:43:07.334Z'),
  },
  {
    id: '60586',
    product: {
      name: 'Unbranded Fresh Shirt',
      category: 'Garden',

      image:
        '/logo.png',
    },
    review:
      'Andy shoes are designed to keeping in mind durability as well as trends, the most stylish range of shoes & sandals',
    customer: {
      name: 'Irvin Ledner',
      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 3,
    createdAt: new Date('2023-03-09T20:11:21.277Z'),
  },
  {
    id: '48211',
    product: {
      name: 'Modern Metal Fish',
      category: 'Games',
      image:
        '/logo.png',
    },
    review:
      "Boston's most advanced compression wear technology increases muscle oxygenation, stabilizes active muscles",
    customer: {
      name: 'Opal Brakus Sr.',
      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 5,
    createdAt: new Date('2023-08-05T22:34:06.843Z'),
  },
  {
    id: '40681',
    product: {
      name: 'Sleek Rubber Tuna',
      category: 'Electronics',
      image:
        '/logo.png',
    },
    review:
      'Ergonomic executive chair upholstered in bonded black leather and PVC padded seat and back for all-day comfort and support',
    customer: {
      name: 'Kara Reilly IV',

      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 4,
    createdAt: new Date('2023-04-29T23:36:04.580Z'),
  },
  {
    id: '64606',
    product: {
      name: 'Awesome Bronze Gloves',
      category: 'Industrial',
      image:
        '/logo.png',
    },
    review:
      'Andy shoes are designed to keeping in mind durability as well as trends, the most stylish range of shoes & sandals',
    customer: {
      name: 'Essie Bernier',
      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 3,
    createdAt: new Date('2023-04-25T02:18:32.327Z'),
  },
  {
    id: '46379',
    product: {
      name: 'Unbranded Frozen Cheese',
      category: 'Games',
      image:
        '/logo.png',
    },
    review:
      'The beautiful range of Apple Naturalé that has an exciting mix of natural ingredients. With the Goodness of 100% Natural Ingredients',
    customer: {
      name: 'Jamie Pfannerstill',

      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 2,
    createdAt: new Date('2022-11-26T06:55:37.822Z'),
  },
  {
    id: '42080',
    product: {
      name: 'Intelligent Bronze Salad',
      category: 'Music',
      image:
        '/logo.png',
    },
    review:
      'New range of formal shirts are designed keeping you in mind. With fits and styling that will make you stand apart',
    customer: {
      name: 'Jordan Smitham',

      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 4,
    createdAt: new Date('2022-09-08T07:29:49.952Z'),
  },
  {
    id: '11926',
    product: {
      name: 'Refined Fresh Computer',
      category: 'Games',
      image:
        '/logo.png',
    },
    review: 'The Football Is Good For Training And Recreational Purposes',
    customer: {
      name: 'Ray Breitenberg',
      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 2,
    createdAt: new Date('2023-02-02T14:34:50.655Z'),
  },
  {
    id: '99629',
    product: {
      name: 'Elegant Plastic Chicken',
      category: 'Beauty',
      image:
        '/logo.png',
    },
    review:
      'Andy shoes are designed to keeping in mind durability as well as trends, the most stylish range of shoes & sandals',
    customer: {
      name: 'Blanca Kuhic',
      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 5,
    createdAt: new Date('2023-08-14T05:10:13.336Z'),
  },
  {
    id: '86933',
    product: {
      name: 'Unbranded Soft Shoes',
      category: 'Music',
      image:
        '/logo.png',
    },
    review:
      'The slim & simple Maple Gaming Keyboard from Dev Byte comes with a sleek body and 7- Color RGB LED Back-lighting for smart functionality',
    customer: {
      name: 'Cesar Reinger',
      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 5,
    createdAt: new Date('2023-08-16T12:17:10.416Z'),
  },
  {
    id: '75429',
    product: {
      name: 'Fantastic Concrete Car',
      category: 'Music',
      image:
        '/logo.png',
    },
    review:
      'The automobile layout consists of a front-engine design, with transaxle-type transmissions mounted at the rear of the engine and four wheel drive',
    customer: {
      name: 'Philip Kub',
      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 2,
    createdAt: new Date('2023-01-09T20:30:19.472Z'),
  },
  {
    id: '07643',
    product: {
      name: 'Licensed Granite Keyboard',
      category: 'Jewelery',
      image:
        '/logo.png',
    },
    review:
      'The beautiful range of Apple Naturalé that has an exciting mix of natural ingredients. With the Goodness of 100% Natural Ingredients',
    customer: {
      name: 'Doreen Reilly IV',
      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 3,
    createdAt: new Date('2023-02-07T18:07:53.234Z'),
  },
  {
    id: '61950',
    product: {
      name: 'Incredible Concrete Computer',
      category: 'Sports',
      image:
        '/logo.png',
    },
    review:
      'New ABC 13 9370, 13.3, 5th Gen CoreA5-8250U, 8GB RAM, 256GB SSD, power UHD Graphics, OS 10 Home, OS Office A & J 2016',
    customer: {
      name: 'Ada Hartmann',

      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 5,
    createdAt: new Date('2023-08-14T05:48:39.101Z'),
  },
  {
    id: '07857',
    product: {
      name: 'Unbranded Steel Gloves',
      category: 'Outdoors',
      image:
        '/logo.png',
    },
    review:
      'New range of formal shirts are designed keeping you in mind. With fits and styling that will make you stand apart',
    customer: {
      name: 'Dave Corkery',
      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 3,
    createdAt: new Date('2022-11-28T22:54:11.147Z'),
  },
  {
    id: '79280',
    product: {
      name: 'Modern Metal Cheese',
      category: 'Health',
      image:
        '/logo.png',
    },
    review:
      'Carbonite web goalkeeper gloves are ergonomically designed to give easy fit',
    customer: {
      name: 'Jerald Moore Jr.',

      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 5,
    createdAt: new Date('2022-11-01T01:05:24.896Z'),
  },
  {
    id: '72211',
    product: {
      name: 'Tasty Bronze Gloves',
      category: 'Outdoors',
      image:
        '/logo.png',
    },
    review:
      'Carbonite web goalkeeper gloves are ergonomically designed to give easy fit',
    customer: {
      name: 'Ruben Kub',

      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 5,
    createdAt: new Date('2023-07-25T09:53:52.751Z'),
  },
  {
    id: '30855',
    product: {
      name: 'Small Rubber Chair',
      category: 'Electronics',

      image:
        '/logo.png',
    },
    review:
      'The automobile layout consists of a front-engine design, with transaxle-type transmissions mounted at the rear of the engine and four wheel drive',
    customer: {
      name: 'Ms. Nicole Jakubowski',
      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 3,
    createdAt: new Date('2023-01-16T21:53:25.463Z'),
  },
  {
    id: '18914',
    product: {
      name: 'Tasty Granite Hat',
      category: 'Kids',
      image:
        '/logo.png',
    },
    review:
      'New ABC 13 9370, 13.3, 5th Gen CoreA5-8250U, 8GB RAM, 256GB SSD, power UHD Graphics, OS 10 Home, OS Office A & J 2016',
    customer: {
      name: 'Marie Tillman',
      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 2,
    createdAt: new Date('2023-01-16T23:50:33.073Z'),
  },
  {
    id: '31051',
    product: {
      name: 'Recycled Bronze Shirt',
      category: 'Movies',
      image:
        '/logo.png',
    },
    review:
      "Boston's most advanced compression wear technology increases muscle oxygenation, stabilizes active muscles",
    customer: {
      name: 'Frank Lynch',

      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 5,
    createdAt: new Date('2023-01-15T00:41:20.987Z'),
  },
  {
    id: '40238',
    product: {
      name: 'Gorgeous Wooden Ball',
      category: 'Computers',
      image:
        '/logo.png',
    },
    review:
      'The Nagasaki Lander is the trademarked name of several series of Nagasaki sport bikes, that started with the 1984 ABC800J',
    customer: {
      name: 'Jackie Mohr',

      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 5,
    createdAt: new Date('2023-07-08T14:40:13.878Z'),
  },
  {
    id: '42822',
    product: {
      name: 'Ergonomic Granite Soap',
      category: 'Outdoors',
      image:
        '/logo.png',
    },
    review: 'The Football Is Good For Training And Recreational Purposes',
    customer: {
      name: 'Mrs. Claire Berge',

      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 5,
    createdAt: new Date('2023-01-06T15:28:20.645Z'),
  },
  {
    id: '64537',
    product: {
      name: 'Handmade Steel Towels',
      category: 'Beauty',
      image:
        '/logo.png',
    },
    review:
      'Andy shoes are designed to keeping in mind durability as well as trends, the most stylish range of shoes & sandals',
    customer: {
      name: 'Mr. Bradford Sauer',

      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 5,
    createdAt: new Date('2022-09-01T22:39:24.001Z'),
  },
  {
    id: '34101',
    product: {
      name: 'Tasty Frozen Chicken',
      category: 'Music',
      image:
        '/logo.png',
    },
    review:
      'The slim & simple Maple Gaming Keyboard from Dev Byte comes with a sleek body and 7- Color RGB LED Back-lighting for smart functionality',
    customer: {
      name: 'Mrs. Connie Schaden',
      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 5,
    createdAt: new Date('2022-11-09T13:51:57.982Z'),
  },
  {
    id: '24043',
    product: {
      name: 'Ergonomic Concrete Tuna',
      category: 'Grocery',
      image:
        '/logo.png',
    },
    review:
      'The Apollotech B340 is an affordable wireless mouse with reliable connectivity, 12 months battery life and modern design',
    customer: {
      name: 'Freddie VonRueden',
      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 3,
    createdAt: new Date('2023-02-11T12:10:59.935Z'),
  },
  {
    id: '80797',
    product: {
      name: 'Modern Bronze Ball',
      category: 'Sports',
      image:
        '/logo.png',
    },
    review:
      'The Apollotech B340 is an affordable wireless mouse with reliable connectivity, 12 months battery life and modern design',
    customer: {
      name: 'Dr. Lindsay Shanahan',
      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 4,
    createdAt: new Date('2023-04-30T22:32:51.750Z'),
  },
  {
    id: '98504',
    product: {
      name: 'Fantastic Soft Fish',
      category: 'Electronics',
      image:
        '/logo.png',
    },
    review:
      "Boston's most advanced compression wear technology increases muscle oxygenation, stabilizes active muscles",
    customer: {
      name: 'Winifred Keeling',
      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 3,
    createdAt: new Date('2023-03-26T16:53:07.336Z'),
  },
  {
    id: '23650',
    product: {
      name: 'Tasty Granite Gloves',
      category: 'Toys',
      image:
        '/logo.png',
    },
    review: 'The Football Is Good For Training And Recreational Purposes',
    customer: {
      name: 'Kara Huels',

      avatar: `/logo.png
        avatarIds
      )}.webp`,
    },
    status: getRandomArrayElement(reviewStatus),
    rating: 2,
    createdAt: new Date('2023-06-21T15:55:13.465Z'),
  },
];
