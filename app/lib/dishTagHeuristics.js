const TAG_RULES = [
  { tags: ["pasta", "italian", "carb heavy"], match: /\b(pasta|spaghetti|carbonara|amatriciana|cacio|penne|fusilli|lasagna|ravioli|gnocchi|tagliatelle|linguine|pesto)\b/i },
  { tags: ["italian", "comfort"], match: /\b(pizza|parmigiana|risotto|tiramisu|mozzarella|burrata|bruschetta|focaccia|polenta)\b/i },
  { tags: ["dessert", "comfort"], match: /\b(cake|torta|dolce|dessert|gelato|ice cream|cookie|brownie|tiramis[uù]|pancake|waffle|cheesecake|muffin)\b/i },
  { tags: ["asian", "rice"], match: /\b(sushi|ramen|noodle|noodles|pad thai|curry|dumpling|bao|poke|pho|udon|soba|kimchi|bibimbap|teriyaki)\b/i },
  { tags: ["seafood", "fresh"], match: /\b(fish|salmon|tuna|shrimp|prawn|octopus|calamari|squid|seafood|salmone|tonno|gamber|polpo)\b/i },
  { tags: ["american", "fast food"], match: /\b(burger|hot dog|bbq|ribs|wings|fries|sandwich|club sandwich)\b/i },
  { tags: ["fried", "comfort"], match: /\b(fried|fritto|fritta|tempura|croquette|nugget|cutlet|cotoletta|suppli|arancini)\b/i },
  { tags: ["spicy"], match: /\b(spicy|piccante|chili|chilli|jalape[nñ]o|nduja|arrabbiata|sriracha|hot)\b/i },
  { tags: ["fit", "high protein"], match: /\b(chicken|pollo|turkey|tacchino|beef|steak|uova|eggs|tofu|protein|proteico|proteica)\b/i },
  { tags: ["veg", "fresh"], match: /\b(salad|insalata|vegetable|verdure|zucchine|eggplant|melanzane|avocado|caprese)\b/i },
  { tags: ["vegan", "veg"], match: /\b(vegan|vegano|vegana|seitan|tempeh)\b/i },
  { tags: ["low carb", "light"], match: /\b(keto|low carb|senza carbo|light|healthy|fit)\b/i },
  { tags: ["quick", "easy"], match: /\b(toast|omelette|omelet|wrap|piadina|quick|easy|veloce|facile)\b/i },
  { tags: ["delivery", "fast food"], match: /\b(delivery|takeaway|take away|glovo|deliveroo|mcdonald|kfc|burger king)\b/i },
  { tags: ["date night", "fancy"], match: /\b(date|romantic|romantico|wine|vino|oyster|ostriche)\b/i },
  { tags: ["premium", "gourmet"], match: /\b(truffle|tartufo|wagyu|caviar|caviale|foie|lobster|aragosta)\b/i },
];

export function suggestDishTagsLocally(dishName, dishMode = "anywhere") {
  const name = String(dishName || "").trim();
  if (name.length < 2) return [];
  const tags = [];
  TAG_RULES.forEach((rule) => {
    if (!rule.match.test(name)) return;
    rule.tags.forEach((tag) => {
      if (!tags.includes(tag)) tags.push(tag);
    });
  });
  if (String(dishMode || "").toLowerCase().includes("restaurant")) {
    ["premium", "delivery"].forEach((tag) => {
      if (tags.length < 4 && !tags.includes(tag) && /\b(restaurant|ristorante|delivery|takeaway)\b/i.test(name)) tags.push(tag);
    });
  }
  if (!tags.length) tags.push("comfort", "easy");
  return tags.slice(0, 4);
}
