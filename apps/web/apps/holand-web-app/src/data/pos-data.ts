import { cloneDeep } from 'lodash';

export const posProducts = [
  {
    id: 1,
    name: 'Chicken curry',
    description: 'South Asian dish',
    image:
      '/logo.png',
    price: 320,
    salePrice: 295,
    quantity: 10,
    size: 50,
    discount: 15,
  },
  {
    id: 2,
    name: 'Iced tea with rose syrup',
    description: 'Cold Drinks',
    image:
      '/logo.png',
    price: 320,
    salePrice: 295,
    quantity: 10,
    size: 50,
    discount: 15,
  },
  {
    id: 3,
    name: 'Strawberry cocktail drinks',
    description: 'Cold Coffee',
    image:
      '/logo.png',
    price: 320,
    salePrice: 295,
    quantity: 10,
    size: 50,
    discount: 15,
  },
  {
    id: 4,
    name: 'Iced tea with rose syrup',
    description: 'Soft Drinks',
    image:
      '/logo.png',
    price: 320,
    salePrice: 295,
    quantity: 10,
    size: 50,
    discount: 15,
  },
  {
    id: 5,
    name: 'CocaCola wit zero diet',
    description: 'Soft Drinks',
    image:
      '/logo.png',
    price: 320,
    salePrice: 295,
    quantity: 10,
    size: 50,
    discount: 15,
  },
  {
    id: 6,
    name: 'Hawaiian Chicken PizzaSmoked',
    description: 'Fast Food Items',
    image:
      '/logo.png',
    price: 320,
    salePrice: 295,
    quantity: 10,
    size: 50,
  },
  {
    id: 7,
    name: 'Pepsi with zero diet',
    description: 'Soft Drinks',
    image:
      '/logo.png',
    price: 320,
    salePrice: 295,
    quantity: 10,
    size: 50,
  },
  {
    id: 8,
    name: 'Jimmy Willy Pizza with cheese',
    description: 'Fast Food Items',
    image:
      '/logo.png',
    price: 320,
    salePrice: 295,
    quantity: 10,
    size: 50,
  },
  {
    id: 9,
    name: 'Hawaiian Chicken PizzaSmoked',
    description: 'Fast Food Items',
    image:
      '/logo.png',
    price: 320,
    salePrice: 295,
    quantity: 10,
    size: 50,
  },
  {
    id: 10,
    name: 'Strawberry cocktail drinks',
    description: 'Cold Coffee',
    image:
      '/logo.png',
    price: 320,
    salePrice: 295,
    quantity: 10,
    size: 50,
  },
  {
    id: 11,
    name: 'Pepsi with zero diet',
    description: 'Soft Drinks',
    image:
      '/logo.png',
    price: 320,
    salePrice: 295,
    quantity: 10,
    size: 50,
    discount: 15,
  },
  {
    id: 12,
    name: 'Apricot ice cream balls',
    description: 'Ice Cream Items',
    image:
      '/logo.png',
    price: 320,
    salePrice: 295,
    quantity: 10,
    size: 50,
  },
  {
    id: 13,
    name: 'CocaCola with zero diet',
    description: 'Soft Drinks',
    image:
      '/logo.png',
    price: 320,
    salePrice: 295,
    quantity: 10,
    size: 50,
    discount: 15,
  },
  {
    id: 14,
    name: 'Strawberry cocktail drinks',
    description: 'Cold Coffee',
    image:
      '/logo.png',
    price: 320,
    salePrice: 295,
    quantity: 10,
    size: 50,
  },
  {
    id: 15,
    name: 'Hawaiian Chicken PizzaSmoked',
    description: 'Fast Food Items',
    image:
      '/logo.png',
    price: 320,
    salePrice: 295,
    quantity: 10,
    size: 50,
  },
  {
    id: 16,
    name: 'Apricot ice cream balls',
    description: 'Ice Cream Items',
    image:
      '/logo.png',
    price: 320,
    salePrice: 295,
    quantity: 10,
    size: 50,
  },
];

export const posData = cloneDeep(posProducts).map((product) => {
  return {
    ...product,
    id: product.id + posProducts.length,
  };
});
