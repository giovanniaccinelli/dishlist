// components/DishCard.js
'use client';
import { motion } from 'framer-motion';
import { shadows, radii } from '../app/lib/design';

export default function DishCard({ dish, onAdd }) {
  return (
    <motion.div
      className="relative bg-neutral-800 overflow-hidden"
      style={{ borderRadius: radii.card, boxShadow: shadows.card }}
      whileHover={{ scale: 1.03 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
    >
      <img src={dish.image} alt={dish.name} className="w-full h-48 object-cover" />
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
