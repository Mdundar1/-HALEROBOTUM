'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

interface LogoProps {
    className?: string;
    light?: boolean;
    animated?: boolean;
}

export default function Logo({ className = "", light = false, animated = true }: LogoProps) {
    const textColors = light ? "text-white" : "text-slate-900";

    const container = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.08,
                delayChildren: 0.3,
            }
        }
    };

    const item = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                type: "spring",
                damping: 12,
                stiffness: 200
            }
        }
    };

    const bounce = {
        hidden: { y: -20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                type: "spring",
                damping: 8,
                stiffness: 300
            }
        }
    };

    return (
        <Link href="/" className={`flex items-center group ${className}`}>
            <motion.div
                className={`flex items-baseline tracking-tighter ${textColors}`}
                variants={animated ? container : {}}
                initial="hidden"
                animate="visible"
            >
                {/* maliyet */}
                <div className="flex">
                    {"maliyet".split("").map((char, i) => (
                        <motion.span
                            key={i}
                            variants={animated ? item : {}}
                            className="font-black italic lg:text-3xl text-2xl"
                        >
                            {char}
                        </motion.span>
                    ))}
                </div>

                {/* 724 */}
                <div className="flex ml-0.5">
                    {["7", "2", "4"].map((char, i) => (
                        <motion.span
                            key={i}
                            variants={animated ? bounce : {}}
                            className="font-black lg:text-3xl text-2xl bg-gradient-to-br from-indigo-500 to-blue-600 bg-clip-text text-transparent drop-shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3"
                        >
                            {char}
                        </motion.span>
                    ))}
                </div>
            </motion.div>
        </Link>
    );
}
