export type CrmStatType = {
  title: string;
  customer: number;
  increased: boolean;
  percentage: number;
  lastMonth: number;
};

export const crmStatData: CrmStatType[] = [
  {
    title: 'Total Customers',
    customer: 12786,
    increased: true,
    percentage: 25.2,
    lastMonth: 10258,
  },
  {
    title: 'New Customers',
    customer: 8785,
    increased: false,
    percentage: 18.2,
    lastMonth: 10587,
  },
  {
    title: 'Repeated Customers',
    customer: 4250,
    increased: true,
    percentage: 25.2,
    lastMonth: 3987,
  },
  {
    title: 'Premium Customers',
    customer: 2777,
    increased: false,
    percentage: 25.2,
    lastMonth: 2846,
  },
];

export const revenueSummaryData = [
  {
    day: 'Jan',
    revenue: 5000,
  },
  {
    day: 'Feb',
    revenue: 8500,
  },
  {
    day: 'Mar',
    revenue: 7000,
  },
  {
    day: 'Apr',
    revenue: 3908,
  },
  {
    day: 'May',
    revenue: 4890,
  },
  {
    day: 'Jun',
    revenue: 8000,
  },
  {
    day: 'Jul',
    revenue: 8500,
  },
  {
    day: 'Aug',
    revenue: 7000,
  },
  {
    day: 'Sep',
    revenue: 3908,
  },
  {
    day: 'Oct',
    revenue: 4890,
  },
  {
    day: 'Nov',
    revenue: 8000,
  },
  {
    day: 'Dec',
    revenue: 8500,
  },
];

export const customerListData = [
  {
    id: 1,
    image:
      '/logo.png',
    customerName: 'Gina Vanleuven',
    salesRepresentative: 'Gina Vanleuven',
    type: 'Platinum',
    projectValue: '$1.87M',
    rating: 5,
  },
  {
    id: 2,
    image:
      '/logo.png',
    customerName: 'Gina Vanleuven',
    salesRepresentative: 'Gina Vanleuven',
    type: 'Platinum',
    projectValue: '$1.87M',
    rating: 4,
  },
  {
    id: 3,
    image:
      '/logo.png',
    customerName: 'Gina Vanleuven',
    salesRepresentative: 'Gina Vanleuven',
    type: 'Platinum',
    projectValue: '$1.87M',
    rating: 3,
  },
  {
    id: 4,
    image:
      '/logo.png',
    customerName: 'Gina Vanleuven',
    salesRepresentative: 'Gina Vanleuven',
    type: 'Platinum',
    projectValue: '$1.87M',
    rating: 2,
  },
  {
    id: 5,
    image:
      '/logo.png',
    customerName: 'Gina Vanleuven',
    salesRepresentative: 'Gina Vanleuven',
    type: 'Platinum',
    projectValue: '$1.87M',
    rating: 1,
  },
  {
    id: 6,
    image:
      '/logo.png',
    customerName: 'Gina Vanleuven',
    salesRepresentative: 'Gina Vanleuven',
    type: 'Platinum',
    projectValue: '$1.87M',
    rating: 5,
  },
  {
    id: 7,
    image:
      '/logo.png',
    customerName: 'Gina Vanleuven',
    salesRepresentative: 'Gina Vanleuven',
    type: 'Platinum',
    projectValue: '$1.87M',
    rating: 4,
  },
  {
    id: 8,
    image:
      '/logo.png',
    customerName: 'Gina Vanleuven',
    salesRepresentative: 'Gina Vanleuven',
    type: 'Platinum',
    projectValue: '$1.87M',
    rating: 3,
  },
  {
    id: 9,
    image:
      '/logo.png',
    customerName: 'Gina Vanleuven',
    salesRepresentative: 'Gina Vanleuven',
    type: 'Platinum',
    projectValue: '$1.87M',
    rating: 2,
  },
  {
    id: 10,
    image:
      '/logo.png',
    customerName: 'Gina Vanleuven',
    salesRepresentative: 'Gina Vanleuven',
    type: 'Platinum',
    projectValue: '$1.87M',
    rating: 1,
  },
  {
    id: 11,
    image:
      '/logo.png',
    customerName: 'Gina Vanleuven',
    salesRepresentative: 'Gina Vanleuven',
    type: 'Platinum',
    projectValue: '$1.87M',
    rating: 5,
  },
  {
    id: 12,
    image:
      '/logo.png',
    customerName: 'Gina Vanleuven',
    salesRepresentative: 'Gina Vanleuven',
    type: 'Platinum',
    projectValue: '$1.87M',
    rating: 4,
  },
];

export const customerByCountryData = [
  {
    country: 'ca',
    name: 'Canada',
    value: 9,
    count: 102000,
  },
  {
    country: 'us',
    name: 'USA',
    value: 8,
    count: 86000,
  },
  {
    country: 'au',
    name: 'Australia',
    value: 6,
    count: 62000,
  },
  {
    country: 'ru',
    name: 'Russia',
    value: 4,
    count: 48000,
  },
];

export const reportAnalyticsData = [
  {
    id: 1,
    image:
      '/logo.png',
    name: 'Tasty Metal Shirt',
    soldAmount: 145.25,
    unitPrice: 125.22,
    revenue: 1870000,
    rating: 5,
  },
  {
    id: 2,
    image:
      '/logo.png',
    name: 'Modern Gloves',
    soldAmount: 245.25,
    unitPrice: 222.59,
    revenue: 1870000,
    rating: 4,
  },
  {
    id: 3,
    image:
      '/logo.png',
    name: 'Rustic Watch',
    soldAmount: 156.25,
    unitPrice: 110.25,
    revenue: 1870000,
    rating: 4,
  },
  {
    id: 4,
    image:
      '/logo.png',
    name: 'Cheese Perfume',
    soldAmount: 145.25,
    unitPrice: 110.89,
    revenue: 1870000,
    rating: 3,
  },
];
