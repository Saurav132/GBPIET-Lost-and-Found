import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateRandomId() {
  return Math.random().toString(36).substring(2, 15);
}

export function getReputationBadge(points: number = 0) {
  if (points >= 100) return { label: 'Campus Hero', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' };
  if (points >= 50) return { label: 'Pro Finder', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' };
  if (points >= 20) return { label: 'Helper', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' };
  return { label: 'Beginner', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' };
}
