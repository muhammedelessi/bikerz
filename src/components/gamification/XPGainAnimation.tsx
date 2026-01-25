import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Flame, Star, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';

interface XPGainAnimationProps {
  xp: number;
  multiplier?: number;
  isLevelUp?: boolean;
  newLevel?: number;
  onComplete?: () => void;
}

const XPGainAnimation: React.FC<XPGainAnimationProps> = ({
  xp,
  multiplier = 1,
  isLevelUp = false,
  newLevel,
  onComplete,
}) => {
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (isLevelUp) {
      // Fire confetti for level up
      const duration = 2000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }
        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: Math.random(), y: Math.random() - 0.2 },
          colors: ['#22c55e', '#eab308', '#3b82f6', '#f97316', '#ec4899'],
        });
      }, 250);
    }

    const timer = setTimeout(() => {
      setShow(false);
      onComplete?.();
    }, isLevelUp ? 3000 : 1500);

    return () => clearTimeout(timer);
  }, [isLevelUp, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: -50 }}
          className="fixed bottom-24 start-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          {isLevelUp ? (
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 5, -5, 0],
              }}
              transition={{ duration: 0.5, repeat: 2 }}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3"
            >
              <Trophy className="w-8 h-8" />
              <div className="text-center">
                <p className="text-sm font-medium">LEVEL UP!</p>
                <p className="text-2xl font-black">Level {newLevel}</p>
              </div>
              <Star className="w-8 h-8" />
            </motion.div>
          ) : (
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 0.3, repeat: 2 }}
              className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-3 rounded-xl shadow-xl flex items-center gap-2"
            >
              <Zap className="w-5 h-5" />
              <span className="text-xl font-black">+{xp} XP</span>
              {multiplier > 1 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1"
                >
                  <Flame className="w-3 h-3" />
                  x{multiplier.toFixed(1)}
                </motion.span>
              )}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default XPGainAnimation;
