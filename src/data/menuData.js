export const MENU = [
  { name: 'Original Cheesecake',                              category: 'Cheesecakes',    price: 75  },
  { name: 'Original Cheesecake w/ Whipped Cream & Strawberries', category: 'Cheesecakes', price: 85  },
  { name: 'Red Velvet Cheesecake',                            category: 'Cheesecakes',    price: 120 },
  { name: 'Red & Blue Velvet Cheesecake',                     category: 'Cheesecakes',    price: 120 },
  { name: 'Peach Cobbler Cheesecake',                         category: 'Cheesecakes',    price: 120 },
  { name: 'Cookies & Cream Cheesecake',                       category: 'Cheesecakes',    price: 120 },
  { name: 'Sweet Potato Cheesecake',                          category: 'Cheesecakes',    price: 120 },
  { name: 'Banana Pudding Cheesecake',                        category: 'Cheesecakes',    price: 120 },
  { name: 'Neapolitan Cheesecake',                            category: 'Cheesecakes',    price: 150 },
  { name: 'Strawberry Crunch Cheesecake',                     category: 'Cheesecakes',    price: 150 },
  { name: 'Strawberries & Cream',                             category: 'Specialty Cakes', price: 90 },
  { name: 'Circus Animal',                                    category: 'Specialty Cakes', price: 90 },
  { name: 'Red Velvet Strawberry Cheesecake Cake',            category: 'Specialty Cakes', price: 90 },
  { name: 'Peach Cobbler',                                    category: 'Specialty Cakes', price: 90 },
  { name: 'Banana Pudding',                                   category: 'Specialty Cakes', price: 90 },
  { name: 'Marble',                                           category: 'Specialty Cakes', price: 90 },
  { name: 'Red Velvet',                                       category: 'Cakes',           price: 70 },
  { name: 'Blue Velvet',                                      category: 'Cakes',           price: 80 },
  { name: 'German Chocolate',                                 category: 'Cakes',           price: 90 },
  { name: 'Vanilla w/ Vanilla',                               category: 'Cakes',           price: 70 },
  { name: 'Vanilla w/ Strawberries',                          category: 'Cakes',           price: 90 },
  { name: 'Yellow w/ Vanilla',                                category: 'Cakes',           price: 70 },
  { name: 'Yellow w/ Chocolate',                              category: 'Cakes',           price: 70 },
  { name: 'Chocolate',                                        category: 'Cakes',           price: 90 },
  { name: 'Carrot',                                           category: 'Cakes',           price: 80 },
  { name: 'Chocolate Chip',                                   category: 'Cookies',         price: 36 },
  { name: 'Chocolate Chip Pecan',                             category: 'Cookies',         price: 42 },
  { name: 'Chocolate Chip Toffee Pecan',                      category: 'Cookies',         price: 48 },
  { name: 'Chocolate Chip Toffee',                            category: 'Cookies',         price: 42 },
  { name: 'Oatmeal Raisin',                                   category: 'Cookies',         price: 36 },
  { name: 'Oatmeal Raisin Pecan',                             category: 'Cookies',         price: 42 },
  { name: '7-UP Pound Cake',                                  category: 'Pound Cakes',     price: 50 },
  { name: 'Lemon Pound Cake',                                 category: 'Pound Cakes',     price: 60 },
  { name: 'Sock-it-to-me Pound Cake',                         category: 'Pound Cakes',     price: 65 },
  { name: 'Rum Pound Cake',                                   category: 'Pound Cakes',     price: 70 },
  { name: 'Butter Pecan Pound Cake',                          category: 'Pound Cakes',     price: 70 },
  { name: 'Cream Cheese Pound Cake',                          category: 'Pound Cakes',     price: 60 },
  { name: 'Chocolate Chip Cream Cheese Pound Cake',           category: 'Pound Cakes',     price: 65 },
  { name: 'Peach Cobbler',                                    category: 'Delectables',     price: 75 },
  { name: 'Cinnamon Rolls',                                   category: 'Delectables',     price: 75 },
  { name: 'Sweet Potato Pie',                                 category: 'Delectables',     price: 45 },
  { name: 'Pecan Pie',                                        category: 'Delectables',     price: 45 },
  { name: 'Banana Pudding',                                   category: 'Delectables',     price: 75 },
  { name: 'Coffee Cake',                                      category: 'Delectables',     price: 45 },
  { name: 'Vegan Red Velvet Cake',                            category: 'Vegan Cakes',     price: 90 },
  { name: 'Vegan Blue Velvet Cake',                           category: 'Vegan Cakes',     price: 90 },
  { name: 'Vegan Chocolate Cake',                             category: 'Vegan Cakes',     price: 90 },
  { name: 'Vegan Carrot Cake',                                category: 'Vegan Cakes',     price: 90 },
  { name: 'Cupcakes (1 Dozen)',                               category: 'Cupcakes',        price: 42 },
]

export const CUPCAKE_FLAVORS = [
  "Variety (Baker's Choice)", 'Red Velvet', 'Red Velvet Strawberry Cheesecake',
  'Blue Velvet', 'Carrot', '7-Up', 'Vanilla', 'Confetti', 'Chocolate',
  'Chocolate Salted Caramel', 'Peach Cobbler', 'Cookies & Cream',
  'Circus Animal', "Strawberries n' Cream", 'Banana Pudding',
  '"SRP" - Toffee Chocolate Chip Cookie',
]

export const CATEGORIES = [
  'Cakes', 'Specialty Cakes', 'Cheesecakes', 'Cupcakes',
  'Vegan Cakes', 'Pound Cakes', 'Delectables', 'Cookies',
]

// Categories that support size + full add-ons
export const CAKE_CATEGORIES = ['Cakes', 'Specialty Cakes', 'Vegan Cakes']

// Size options — price modifiers applied to base price
export const SIZES = [
  { id: 'round',  label: '9" Round',   mod: (base) => base },
  { id: 'heart',  label: '9" Heart',   mod: (base) => base + 30 },
  { id: 'square', label: '12" Square', mod: (base) => Math.round(base * 2.5) },
]

// Add-ons with variable pricing noted
// priceOptions: if present, employee picks between values
export const CAKE_ADDONS = [
  { id: 'frostingColor',   label: 'Frosting Color',      price: 10,      type: 'toggle+note', notePlaceholder: 'e.g. Blush pink, White' },
  { id: 'cakeColor',       label: 'Cake Color',          price: 10,      type: 'toggle+note', notePlaceholder: 'e.g. Red, Blue velvet' },
  { id: 'coveredRosettes', label: 'Covered Rosettes',    price: 60,      type: 'toggle' },
  { id: 'buttercreamRoses',label: 'Buttercream Roses',   price: 20,      type: 'toggle' },
  { id: 'fancyPiping',     label: 'Fancy Piping',        price: 20,      type: 'toggle' },
  { id: 'fancySprinkles',  label: 'Fancy Sprinkles',     price: null,    type: 'toggle+price', priceOptions: [10, 20], pricePlaceholder: '$10 or $20' },
  { id: 'fruitOnTop',      label: 'Fruit on Top',        price: null,    type: 'toggle+price', priceOptions: [10, 20], pricePlaceholder: '$10 or $20' },
  { id: 'fruitJamFilling', label: 'Fruit/Jam Filling',   price: null,    type: 'toggle+price', priceOptions: [10, 20], pricePlaceholder: '$10 or $20' },
  { id: 'additionalLayer', label: 'Additional Layer',    price: null,    type: 'toggle+layer' },
  { id: 'printedImage',    label: 'Printed Image',       price: 25,      type: 'toggle', note: 'Customer provides image separately. +$25 per sheet.' },
  { id: 'writingOnCake',   label: 'Writing on Cake',     price: 0,       type: 'text', placeholder: 'e.g. Happy Birthday Sarah!' },
]

export const CHEESECAKE_ADDONS = [
  { id: 'printedImage',  label: 'Printed Image',   price: 25, type: 'toggle', note: 'Customer provides image separately. +$25 per sheet.' },
  { id: 'writingOnCake', label: 'Writing on Cake', price: 0,  type: 'text',   placeholder: 'e.g. Happy Birthday Sarah!' },
]

// Layer price by size
export const LAYER_PRICE = { round: 25, heart: 35, square: 60 }
