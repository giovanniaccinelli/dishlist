// components/DishCard.js
'use client';
import { motion } from 'framer-motion';
import { shadows, radii } from '../app/lib/design';
import { DEFAULT_DISH_IMAGE, getDishImageUrl } from '../app/lib/dishImage';

export default function DishCard({ dish, onAdd }) {
  const imageSrc = getDishImageUrl(dish);

  return (
    <motion.div
      className="relative bg-neutral-800 overflow-hidden"
      style={{ borderRadius: radii.card, boxShadow: shadows.card }}
      whileHover={{ scale: 1.03 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
    >
      <img
        src={imageSrc}
        alt={dish.name}
        loading="lazy"
        decoding="async"
        className="w-full h-48 object-cover"
        onError={(e) => {
          e.currentTarget.src = DEFAULT_DISH_IMAGE;
        }}
      />
      <div className="absolute bottom-0 w-full p-4 bg-gradient-to-t from-black/80 to-transparent">
        <h2 className="text-xl font-semibold">{dish.name}</h2>
        <button
          onClick={() => onAdd(dish)}
          className="mt-2 px-4 py-2 bg-red-500 rounded-lg hover:bg-red-600 transition"
        >
          Add to Dishlist
        </button>
      </div>
    </motion.div>
  );
}
