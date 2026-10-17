// Pregnancy guide: what to eat, what to avoid, healthy habits.
// Every item cites the public source it is drawn from. Wording is kept general
// on purpose: the app informs and redirects to the care team, it never prescribes.

import { txt, type Text } from '../i18n/text'

export type GuideCategory = 'eat' | 'avoid' | 'habits'

export interface Source {
  label: Text
  url: string
}

export interface GuideItem {
  id: string
  category: GuideCategory
  title: Text
  short: Text // one line, used in push notifications and the phone app
  why: Text
  source: Source
}

export const SOURCES = {
  nhsFoods: {
    label: txt('NHS · Foods to avoid in pregnancy', 'NHS · Aliments à éviter pendant la grossesse'),
    url: 'https://www.nhs.uk/pregnancy/keeping-well/foods-to-avoid/',
  },
  whoAnc: {
    label: txt(
      'WHO (2016) · Antenatal care for a positive pregnancy experience',
      'OMS (2016) · Soins prénatals pour une expérience positive de la grossesse',
    ),
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK409108/',
  },
  mrc: {
    label: txt('MRC Vitamin Study, The Lancet (1991)', 'MRC Vitamin Study, The Lancet (1991)'),
    url: 'https://pubmed.ncbi.nlm.nih.gov/1677062/',
  },
  marshall: {
    label: txt('Marshall et al., AJOG (2022)', 'Marshall et al., AJOG (2022)'),
    url: 'https://doi.org/10.1016/j.ajog.2021.12.035',
  },
  koletzko: {
    label: txt('Koletzko et al., Ann Nutr Metab (2019)', 'Koletzko et al., Ann Nutr Metab (2019)'),
    url: 'https://doi.org/10.1159/000496471',
  },
} satisfies Record<string, Source>

export const GUIDE: GuideItem[] = [
  // ---------- Eat well ----------
  {
    id: 'folic',
    category: 'eat',
    title: txt('Folic acid, from before conception to week 12', 'Acide folique, d’avant la conception à 12 semaines'),
    short: txt('Take your folic acid every day until week 12.', 'Prenez votre acide folique chaque jour jusqu’à 12 semaines.'),
    why: txt(
      'Folic acid taken around conception strongly reduces the risk of neural tube defects such as spina bifida. Ask your doctor for the right dose for you.',
      'Pris autour de la conception, l’acide folique réduit fortement le risque d’anomalies du tube neural comme le spina bifida. Demandez à votre médecin la dose adaptée.',
    ),
    source: SOURCES.mrc,
  },
  {
    id: 'quality',
    category: 'eat',
    title: txt('Eat better, not more', 'Manger mieux, pas plus'),
    short: txt(
      'Pregnancy is not “eating for two”: focus on quality.',
      'Enceinte, on ne « mange pas pour deux » : misez sur la qualité.',
    ),
    why: txt(
      'Diet quality before and during pregnancy shapes fetal growth and the child’s long-term health. Favour vegetables, fruit, whole grains, legumes and lean protein.',
      'La qualité de l’alimentation avant et pendant la grossesse influence la croissance du fœtus et la santé à long terme de l’enfant. Privilégiez légumes, fruits, céréales complètes, légumineuses et protéines maigres.',
    ),
    source: SOURCES.marshall,
  },
  {
    id: 'oily-fish',
    category: 'eat',
    title: txt('Oily fish, up to 2 portions a week', 'Poissons gras, jusqu’à 2 portions par semaine'),
    short: txt(
      'Salmon or mackerel: good for baby, max 2 portions a week.',
      'Saumon, maquereau : bons pour bébé, 2 portions par semaine maximum.',
    ),
    why: txt(
      'Oily fish brings omega-3 fats for the baby’s brain and eyes. Keep to 2 portions a week because of pollutants such as mercury.',
      'Les poissons gras apportent des oméga-3 pour le cerveau et les yeux du bébé. Limitez-vous à 2 portions par semaine à cause des polluants comme le mercure.',
    ),
    source: SOURCES.nhsFoods,
  },
  {
    id: 'iron',
    category: 'eat',
    title: txt('Iron and folate-rich foods', 'Aliments riches en fer et en folates'),
    short: txt('Iron-rich foods help prevent anaemia in pregnancy.', 'Les aliments riches en fer aident à prévenir l’anémie.'),
    why: txt(
      'Anaemia in pregnancy is common. WHO recommends iron and folic acid supplementation in antenatal care; your care team will check your levels.',
      'L’anémie est fréquente pendant la grossesse. L’OMS recommande une supplémentation en fer et en acide folique ; votre équipe soignante contrôlera vos taux.',
    ),
    source: SOURCES.whoAnc,
  },
  // ---------- Avoid ----------
  {
    id: 'alcohol',
    category: 'avoid',
    title: txt('No alcohol at all', 'Zéro alcool'),
    short: txt('No safe amount of alcohol in pregnancy.', 'Aucune quantité d’alcool n’est sans risque pendant la grossesse.'),
    why: txt(
      'Alcohol passes to the baby and can cause long-term harm. The safest choice is none.',
      'L’alcool passe chez le bébé et peut causer des dommages durables. Le choix le plus sûr : zéro alcool.',
    ),
    source: SOURCES.nhsFoods,
  },
  {
    id: 'cheese',
    category: 'avoid',
    title: txt('Unpasteurised dairy and soft, mould-ripened cheese', 'Laitages crus et fromages à croûte fleurie'),
    short: txt(
      'Brie, camembert, blue cheese: only when cooked until steaming hot.',
      'Brie, camembert, bleu : seulement bien cuits, jusqu’à être brûlants.',
    ),
    why: txt(
      'They may carry listeria, which can cause miscarriage, stillbirth or serious illness in the newborn.',
      'Ils peuvent contenir la listeria, qui peut provoquer une fausse couche, une mort fœtale ou une infection grave du nouveau-né.',
    ),
    source: SOURCES.nhsFoods,
  },
  {
    id: 'meat',
    category: 'avoid',
    title: txt('Raw or undercooked meat', 'Viande crue ou peu cuite'),
    short: txt(
      'Cook meat through: no rare steak, no cured raw meat.',
      'Viande bien cuite : pas de steak saignant ni de charcuterie crue.',
    ),
    why: txt(
      'Raw or undercooked meat can carry toxoplasmosis, an infection that can harm the baby.',
      'La viande crue ou peu cuite peut transmettre la toxoplasmose, une infection dangereuse pour le bébé.',
    ),
    source: SOURCES.nhsFoods,
  },
  {
    id: 'liver',
    category: 'avoid',
    title: txt('Liver and vitamin A supplements', 'Foie et compléments de vitamine A'),
    short: txt('Skip liver and liver pâté.', 'Évitez le foie et le pâté de foie.'),
    why: txt(
      'Liver is very high in vitamin A, and too much vitamin A can harm the baby’s development.',
      'Le foie est très riche en vitamine A, et un excès de vitamine A peut nuire au développement du bébé.',
    ),
    source: SOURCES.nhsFoods,
  },
  {
    id: 'fish',
    category: 'avoid',
    title: txt('Swordfish, shark, marlin and raw fish', 'Espadon, requin, marlin et poisson cru'),
    short: txt('Avoid swordfish, shark and marlin; limit tuna.', 'Évitez espadon, requin et marlin ; limitez le thon.'),
    why: txt(
      'These fish can hold high levels of mercury. Raw fish and shellfish can carry bacteria. Limit tuna to 4 cans or 2 steaks a week.',
      'Ces poissons peuvent contenir beaucoup de mercure. Le poisson et les fruits de mer crus peuvent transmettre des bactéries. Limitez le thon à 4 boîtes ou 2 steaks par semaine.',
    ),
    source: SOURCES.nhsFoods,
  },
  {
    id: 'caffeine',
    category: 'avoid',
    title: txt('More than 200 mg of caffeine a day', 'Plus de 200 mg de caféine par jour'),
    short: txt(
      'Max 200 mg caffeine a day (about 2 mugs of instant coffee).',
      '200 mg de caféine par jour maximum (environ 2 tasses de café soluble).',
    ),
    why: txt(
      'High caffeine intake is linked to a higher chance of miscarriage and stillbirth. Count tea, cola, energy drinks and chocolate too.',
      'Une forte consommation de caféine est associée à un risque accru de fausse couche et de mort fœtale. Comptez aussi le thé, les sodas, les boissons énergisantes et le chocolat.',
    ),
    source: SOURCES.nhsFoods,
  },
  {
    id: 'herbal',
    category: 'avoid',
    title: txt('Liquorice root tea and too many herbal teas', 'Tisane de réglisse et excès de tisanes'),
    short: txt('Herbal teas: max 4 cups a day, no liquorice root.', 'Tisanes : 4 tasses par jour maximum, sans réglisse.'),
    why: txt(
      'Research on herbal teas in pregnancy is limited, and liquorice root may affect the baby’s development.',
      'Les tisanes ont été peu étudiées pendant la grossesse, et la racine de réglisse pourrait affecter le développement du bébé.',
    ),
    source: SOURCES.nhsFoods,
  },
  // ---------- Habits ----------
  {
    id: 'smoking',
    category: 'habits',
    title: txt('A smoke-free pregnancy and home', 'Une grossesse et un foyer sans tabac'),
    short: txt('Stopping smoking now still protects your baby.', 'Arrêter de fumer maintenant protège encore votre bébé.'),
    why: txt(
      'Tobacco in pregnancy raises the risk of low birth weight and of childhood asthma. Free cessation support is available.',
      'Le tabac pendant la grossesse augmente le risque de petit poids de naissance et d’asthme de l’enfant. Un accompagnement gratuit à l’arrêt existe.',
    ),
    source: SOURCES.whoAnc,
  },
  {
    id: 'meds',
    category: 'habits',
    title: txt('Check every medicine first', 'Vérifier chaque médicament'),
    short: txt(
      'Ask before taking any medicine, even over the counter.',
      'Demandez avant de prendre un médicament, même sans ordonnance.',
    ),
    why: txt(
      'Some common painkillers, acne treatments and herbal remedies are not safe in pregnancy. Always check with your doctor or pharmacist.',
      'Certains antidouleurs courants, traitements de l’acné et remèdes à base de plantes ne sont pas sûrs pendant la grossesse. Demandez toujours à votre médecin ou pharmacien.',
    ),
    source: SOURCES.whoAnc,
  },
  {
    id: 'active',
    category: 'habits',
    title: txt('Stay active', 'Rester active'),
    short: txt('A daily walk counts: stay gently active.', 'Une marche quotidienne compte : restez doucement active.'),
    why: txt(
      'Regular moderate activity is recommended during pregnancy and helps prevent excessive weight gain.',
      'Une activité modérée et régulière est recommandée pendant la grossesse et aide à éviter une prise de poids excessive.',
    ),
    source: SOURCES.whoAnc,
  },
]

export const CATEGORY_LABEL: Record<GuideCategory, Text> = {
  eat: txt('Eat well', 'Bien manger'),
  avoid: txt('Avoid or limit', 'À éviter ou limiter'),
  habits: txt('Healthy habits', 'Bonnes habitudes'),
}

// Shorter labels for the phone app's segmented control.
export const CATEGORY_SHORT: Record<GuideCategory, Text> = {
  eat: txt('Eat well', 'Manger'),
  avoid: txt('Avoid or limit', 'À éviter'),
  habits: txt('Healthy habits', 'Habitudes'),
}

// Research behind the guide, shown on the guide page. Paper titles stay in English.
export const RESEARCH = [
  {
    source: SOURCES.marshall,
    title: 'The importance of nutrition in pregnancy and lactation: lifelong consequences',
    note: txt(
      'Expert consensus review: diet before and during pregnancy affects fetal growth and the child’s long-term health.',
      'Revue de consensus d’experts : l’alimentation avant et pendant la grossesse influence la croissance fœtale et la santé à long terme de l’enfant.',
    ),
  },
  {
    source: SOURCES.koletzko,
    title: 'Nutrition during pregnancy, lactation and early childhood and its implications for maternal and long-term child health',
    note: txt(
      'EU EarlyNutrition project recommendations, with a focus on long-term effects and obesity prevention.',
      'Recommandations du projet européen EarlyNutrition, centrées sur les effets à long terme et la prévention de l’obésité.',
    ),
  },
  {
    source: SOURCES.mrc,
    title: 'Prevention of neural tube defects: results of the Medical Research Council Vitamin Study',
    note: txt(
      'Landmark randomised trial: folic acid prevents neural tube defects.',
      'Essai randomisé de référence : l’acide folique prévient les anomalies du tube neural.',
    ),
  },
]
