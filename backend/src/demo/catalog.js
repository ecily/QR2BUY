export const DEMO_PRODUCTS = Object.freeze([
  {
    key: 'bag',
    name: { de: 'Handgemachte Ledertasche', en: 'Handmade leather bag' },
    place: { de: 'Boutique · Kleinserie', en: 'Boutique · small collection' },
    description: {
      de: 'Eine handgefertigte Ledertasche aus einer kleinen lokalen Kollektion.',
      en: 'A handmade leather bag from a small local collection.'
    },
    price: 129,
    currency: 'EUR',
    color: 'clay',
    stock: 3,
    alternatives: { de: 'Weitere Taschenmodelle verfügbar', en: 'Other bag styles available' }
  },
  {
    key: 'book',
    name: { de: 'Roman „Stadtlichter“', en: 'Novel “City Lights”' },
    place: { de: 'Buchhandlung · Lagerware', en: 'Bookshop · stock item' },
    description: {
      de: 'Ein ausgewählter Roman aus der unabhängigen Buchhandlung nebenan.',
      en: 'A selected novel from the independent bookshop next door.'
    },
    price: 24.9,
    currency: 'EUR',
    color: 'sage',
    stock: 8,
    alternatives: { de: 'Weitere Exemplare verfügbar', en: 'More copies available' }
  },
  {
    key: 'print',
    name: { de: 'Gerahmter Kunstdruck', en: 'Framed art print' },
    place: { de: 'Galerie · limitiert', en: 'Gallery · limited' },
    description: {
      de: 'Ein gerahmter, limitierter Kunstdruck aus einer lokalen Edition.',
      en: 'A framed limited art print from a local edition.'
    },
    price: 390,
    currency: 'EUR',
    color: 'ink',
    stock: 1,
    alternatives: { de: 'Weitere Stadtbilder verfügbar', en: 'Other city prints available' }
  },
  {
    key: 'tree',
    name: { de: 'Nordmanntanne Nr. 17', en: 'Nordmann fir no. 17' },
    place: { de: 'Saisonaler Stand', en: 'Seasonal stand' },
    description: {
      de: 'Eine ausgewählte Nordmanntanne vom saisonalen Verkaufsstand.',
      en: 'A selected Nordmann fir from a seasonal sales stand.'
    },
    price: 59,
    currency: 'EUR',
    color: 'pine',
    stock: 1,
    alternatives: { de: 'Weitere Tannen verfügbar', en: 'Other trees available' },
    unique: true
  }
]);

export function getDemoProduct(productKey) {
  return DEMO_PRODUCTS.find((product) => product.key === productKey) || null;
}

export function publicDemoProduct(product) {
  return {
    key: product.key,
    name: product.name,
    place: product.place,
    description: product.description,
    price: product.price,
    currency: product.currency,
    color: product.color,
    stock: product.stock ?? null,
    alternatives: product.alternatives || null,
    unique: product.unique === true
  };
}

export function isUniqueDemoProduct(productKey) {
  return getDemoProduct(productKey)?.unique === true;
}
