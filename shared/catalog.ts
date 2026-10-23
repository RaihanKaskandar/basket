import type { CategoryId } from './categories.ts'

/** A grocery the app knows out of the box, with its English and Dutch names. */
export interface CatalogEntry {
  key: string
  category: CategoryId
  en: string[]
  nl: string[]
}

// One product per line: English names = Dutch names. The first English name is the key.
// Plurals and diminutives are handled by the matcher, so only list irregular forms.
const DATA: Record<CategoryId, string> = {
  produce: `
    apple = appel
    banana = banaan
    pear = peer
    orange = sinaasappel
    mandarin, clementine, tangerine = mandarijn
    lemon = citroen
    lime = limoen
    grapes, grape = druiven, druif
    strawberry = aardbei
    raspberry = framboos, frambozen
    blueberry = blauwe bes, bosbes
    kiwi = kiwi
    mango = mango
    pineapple = ananas
    melon = meloen
    watermelon = watermeloen
    avocado = avocado
    peach = perzik
    plum = pruim
    cherry = kers
    nectarine = nectarine
    pomegranate = granaatappel
    tomato = tomaat
    cherry tomatoes = cherrytomaat, snoeptomaat
    cucumber = komkommer
    bell pepper, capsicum = paprika
    chili pepper, chilli = rode peper, chilipeper
    onion = ui
    red onion = rode ui
    spring onion, scallion = lente-ui, bosui
    shallot = sjalot
    garlic = knoflook
    ginger = gember
    potato = aardappel, pieper
    baby potatoes = krieltjes, kriel
    sweet potato = zoete aardappel
    carrot = wortel, peen
    broccoli = broccoli
    cauliflower = bloemkool
    lettuce = sla, kropsla
    iceberg lettuce = ijsbergsla
    spinach = spinazie
    rocket, arugula = rucola
    lamb's lettuce = veldsla
    kale = boerenkool
    cabbage = kool
    red cabbage = rode kool
    pointed cabbage = spitskool
    brussels sprouts = spruitjes, spruiten
    green beans = sperziebonen, boontjes
    leek = prei
    zucchini, courgette = courgette
    eggplant, aubergine = aubergine
    mushroom = champignon, paddenstoel
    celery = selderij, bleekselderij
    asparagus = asperge
    sweet corn, corn on the cob = maïs, maiskolf
    peas = doperwten, erwten
    endive = andijvie
    chicory = witlof
    beetroot = rode biet, biet
    radish = radijs, radijsjes
    pumpkin, butternut = pompoen
    fennel = venkel
    parsley = peterselie
    basil = basilicum
    coriander, cilantro = koriander
    mint = munt, verse munt
    dill = dille
    chives = bieslook
    salad, salad mix = salade, salademix
    stir-fry vegetables = wokgroente, roerbakgroente
    soup vegetables = soepgroente
  `,
  bakery: `
    bread, loaf = brood
    whole wheat bread, wholemeal bread = volkorenbrood, volkoren brood
    white bread = witbrood, wit brood
    multigrain bread = meergranenbrood
    bread rolls, rolls, buns = broodjes, bolletjes, puntjes
    croissant = croissant
    baguette, french bread = stokbrood
    pita bread = pitabroodje, pita
    wraps, tortillas = wraps, tortilla's
    crackers = crackers, knäckebröd
    rusks = beschuit
    gingerbread, spiced cake = ontbijtkoek
    currant buns = krentenbollen
    cake = cake, taart
    pancakes = pannenkoeken
    naan = naanbrood
  `,
  dairy: `
    milk = melk
    whole milk = volle melk
    semi-skimmed milk = halfvolle melk
    skimmed milk = magere melk
    buttermilk = karnemelk
    chocolate milk = chocolademelk, chocomel
    oat milk = havermelk, haverdrank
    soy milk = sojamelk, sojadrink
    almond milk = amandelmelk
    butter = boter, roomboter
    margarine = margarine, halvarine
    cheese = kaas
    grated cheese, shredded cheese = geraspte kaas
    mozzarella = mozzarella
    parmesan = parmezaan, parmezaanse kaas
    feta = feta
    cream cheese = roomkaas
    goat cheese = geitenkaas
    cottage cheese = hüttenkäse
    yogurt, yoghurt = yoghurt
    greek yogurt = griekse yoghurt
    quark = kwark
    custard = vla
    whipping cream, cream = slagroom
    cooking cream = kookroom
    sour cream, creme fraiche = zure room, crème fraîche
    eggs, egg = eieren, ei
  `,
  meat: `
    chicken = kip
    chicken breast = kipfilet
    chicken thighs = kippendijen, kippendijfilet
    chicken drumsticks = drumsticks, kippenpootjes
    minced meat, ground beef, mince = gehakt, rundergehakt
    beef = rundvlees
    steak = biefstuk, steak
    stewing beef = stoofvlees, runderlappen
    pork = varkensvlees
    pork chops = karbonade, karbonades
    pork tenderloin = varkenshaas
    bacon = spek, spekjes, ontbijtspek
    ham = ham
    sausage = worst, worstjes
    smoked sausage = rookworst
    salami = salami
    cold cuts, sliced meat = vleeswaren, broodbeleg
    hamburger, burger = hamburger
    meatballs = gehaktballen
    shawarma = shoarma
    salmon = zalm
    tuna = tonijn
    shrimp, prawns = garnalen
    cod = kabeljauw
    white fish = witvis
    herring = haring
    mussels = mosselen
    smoked mackerel, mackerel = makreel
    tofu = tofu
    tempeh = tempeh
    vegetarian mince = vegetarisch gehakt, vega gehakt
    vegetarian burger, veggie burger = vegaburger
    falafel = falafel
  `,
  breakfast: `
    cereal = ontbijtgranen, cornflakes
    muesli = muesli
    granola = granola, cruesli
    oats, oatmeal, porridge = havermout
    peanut butter = pindakaas
    jam = jam
    chocolate spread = chocoladepasta, choco, nutella
    chocolate sprinkles = hagelslag
    fruit sprinkles = vruchtenhagel
    aniseed sprinkles = muisjes
    honey = honing
    syrup = stroop
    apple syrup = appelstroop
    coffee = koffie
    coffee beans = koffiebonen
    ground coffee = gemalen koffie, filterkoffie
    coffee pads = koffiepads, senseo pads
    coffee capsules, coffee pods = koffiecups, koffiecapsules
    tea = thee
    green tea = groene thee
    cocoa = cacao, cacaopoeder
  `,
  pantry: `
    rice = rijst
    basmati rice = basmatirijst
    pasta = pasta
    spaghetti = spaghetti
    penne = penne
    macaroni = macaroni
    lasagne sheets = lasagnebladen
    noodles = noedels, mie
    couscous = couscous
    quinoa = quinoa
    flour = bloem, meel
    sugar = suiker
    brown sugar = basterdsuiker, bruine suiker
    salt = zout
    pepper, black pepper = peper, zwarte peper
    olive oil = olijfolie
    oil, cooking oil, sunflower oil = olie, zonnebloemolie
    vinegar = azijn
    soy sauce = sojasaus, ketjap
    ketchup = ketchup
    mayonnaise, mayo = mayonaise, mayo
    mustard = mosterd
    pasta sauce, tomato sauce = pastasaus, tomatensaus
    tomato paste, tomato puree = tomatenpuree
    canned tomatoes, chopped tomatoes = tomatenblokjes, gepelde tomaten
    coconut milk = kokosmelk
    stock cubes, bouillon = bouillonblokjes, bouillon
    beans = bonen
    kidney beans = kidneybonen, bruine bonen
    chickpeas = kikkererwten
    lentils = linzen
    canned corn = maïs in blik
    soup = soep
    curry paste = currypasta
    herbs, spices = kruiden, specerijen
    paprika powder = paprikapoeder
    cinnamon = kaneel
    cumin = komijn
    oregano = oregano
    baking powder = bakpoeder
    yeast = gist
    nuts = noten
    peanuts = pinda's, pinda
    almonds = amandelen
    walnuts = walnoten
    cashews = cashewnoten
    raisins = rozijnen
    sambal = sambal
    peanut sauce, satay sauce = satésaus, pindasaus
    pesto = pesto
    breadcrumbs = paneermeel
    gravy = jus
    dates = dadels
  `,
  frozen: `
    frozen vegetables = diepvriesgroente
    frozen pizza, pizza = diepvriespizza, pizza
    ice cream = ijs, roomijs
    fries, french fries = friet, patat, frites
    frozen fruit, frozen berries = diepvriesfruit
    fish fingers, fish sticks = vissticks
    ice cubes = ijsblokjes
    croquettes = kroketten
    spring rolls = loempia's, loempia
  `,
  snacks: `
    crisps, potato chips = chips
    tortilla chips = tortillachips, nacho's
    chocolate = chocolade, chocola
    candy, sweets = snoep
    licorice, liquorice = drop
    popcorn = popcorn
    cookies, biscuits = koekjes, koek
    stroopwafels, syrup waffles = stroopwafels
    party nuts, mixed nuts = borrelnootjes, studentenhaver
    dip = dipsaus
    chewing gum, gum = kauwgom
    mints = pepermunt
    cereal bars = mueslirepen
  `,
  drinks: `
    water = water
    sparkling water = bruisend water, spa rood
    orange juice = sinaasappelsap, jus d'orange
    apple juice = appelsap
    juice = sap, vruchtensap
    cola, coke = cola
    soft drinks, soda = frisdrank
    lemonade, squash, cordial = limonade, ranja, siroop
    iced tea = ijsthee
    energy drink = energiedrank
    beer = bier
    alcohol-free beer = alcoholvrij bier, 0.0 bier
    wine = wijn
    red wine = rode wijn
    white wine = witte wijn
    rosé = rosé
  `,
  household: `
    toilet paper = wc-papier, toiletpapier, wc papier
    kitchen roll, paper towels = keukenpapier, keukenrol
    tissues = tissues, zakdoekjes
    washing-up liquid, dish soap = afwasmiddel
    dishwasher tablets = vaatwastabletten
    laundry detergent = wasmiddel
    fabric softener = wasverzachter
    bin bags, trash bags = vuilniszakken, afvalzakken
    aluminium foil = aluminiumfolie, alufolie
    cling film = vershoudfolie
    baking paper = bakpapier
    freezer bags = diepvrieszakjes
    sponges = sponsjes
    all-purpose cleaner, cleaning spray = allesreiniger
    bleach = bleek, chloor
    batteries = batterijen
    light bulbs = lampen, gloeilampen
    candles = kaarsen
    matches = lucifers
  `,
  care: `
    shampoo = shampoo
    conditioner = conditioner, crèmespoeling
    shower gel = douchegel, douchezeep
    soap = zeep
    hand soap = handzeep
    toothpaste = tandpasta
    toothbrush = tandenborstel
    floss = flosdraad
    deodorant = deodorant, deo
    razors = scheermesjes
    shaving foam = scheerschuim
    cotton pads = wattenschijfjes
    cotton buds = wattenstaafjes
    sanitary pads = maandverband
    tampons = tampons
    sunscreen = zonnebrand, zonnebrandcrème
    body lotion = bodylotion
    hand cream = handcrème
    lip balm = lippenbalsem
    painkillers, paracetamol = paracetamol, pijnstillers
    plasters, band-aids = pleisters
  `,
  other: `
    nappies, diapers = luiers
    baby wipes, wet wipes = billendoekjes
    cat food = kattenvoer
    dog food = hondenvoer
    cat litter = kattenbakvulling
    flowers = bloemen
  `,
}

const split = (names: string | undefined) =>
  (names ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)

export const CATALOG: CatalogEntry[] = Object.entries(DATA).flatMap(([category, block]) =>
  block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [en, nl] = line.split('=')
      const english = split(en)
      return { key: english[0], category: category as CategoryId, en: english, nl: split(nl) }
    }),
)

const byKey = new Map(CATALOG.map((entry) => [entry.key, entry]))

export const catalogEntry = (key: string | null | undefined) => (key ? byKey.get(key) : undefined)
