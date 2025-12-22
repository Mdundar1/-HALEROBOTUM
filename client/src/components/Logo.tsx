'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

interface LogoProps {
    className?: string;
    light?: boolean;
    animated?: boolean;
}

export default function Logo({ className = "", light = false, animated = true }: LogoProps) {
    const textColor = light ? "text-white" : "text-slate-900";

    const container = {
        hidden: { opacity: 0, x: -10 },
        visible: {
            opacity: 1,
            x: 0,
            transition: {
                duration: 0.5,
                ease: "easeOut",
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 5 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.4, ease: "easeOut" }
        }
    };

    return (
        <Link href="/" className={`flex items-center gap-2 group ${className}`}>
            {/* Logo Icon */}
            <motion.div
                className="relative flex items-center justify-center"
                initial={animated ? "hidden" : "visible"}
                animate="visible"
                variants={container}
            >
                <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-500 shadow-lg flex items-center justify-center text-white transform transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3`}>
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        className="w-5 h-5 lg:w-6 lg:h-6"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        {/* Abstract 'M' / Graph */}
                        <path d="M12 20V10" />
                        <path d="M18 20V4" />
                        <path d="M6 20v-4" />
                    </svg>
                </div>
            </motion.div>

            {/* Text */}
            <motion.div
                className={`flex flex-col justify-center ${textColor}`}
                variants={animated ? container : {}}
                initial={animated ? "hidden" : "visible"}
                animate="visible"
            >
                <div className="flex items-baseline leading-none">
                    <motion.span
                        variants={item}
                        className="font-bold text-xl lg:text-2xl tracking-tight"
                    >
                        Maliyet
                    </motion.span>
                    <motion.span
                        variants={item}
                        className={`font-extrabold text-xl lg:text-2xl ml-0.5 bg-gradient-to-r from-indigo-500 to-blue-600 bg-clip-text text-transparent`}
                    >
                        724
                    </motion.span>
                </div>
            </motion.div>
        </Link>
    );
}
