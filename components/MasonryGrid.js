// components/MasonryGrid.js
'use client';
import Masonry from 'react-masonry-css';
import DishCard from './DishCard';
import { motion } from 'framer-motion';

export default function MasonryGrid({ dishes, onAdd }) {
  const breakpoints = { default: 4, 1100: 3, 700: 2, 500: 1 };

  return (
    <Masonry
      breakpointCols={breakpoints}
      className="flex w-auto gap-6 p-6"
      columnClassName="bg-transparent"
    >
      {dishes.map((dish, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <DishCard dish={dish} onAdd={onAdd} />
        </motion.div>
      ))}
    </Masonry>
  );
}
