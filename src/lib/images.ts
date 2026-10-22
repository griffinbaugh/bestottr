import g1 from "@/assets/g1.jpg";
import g2 from "@/assets/g2.jpg";
import g3 from "@/assets/g3.jpg";
import g4 from "@/assets/g4.jpg";
import g5 from "@/assets/g5.jpg";
import g6 from "@/assets/g6.jpg";
import g7 from "@/assets/g7.jpg";
import g8 from "@/assets/g8.jpg";
import f1 from "@/assets/f1.jpg";
import f2 from "@/assets/f2.jpg";
import f3 from "@/assets/f3.jpg";
import f4 from "@/assets/f4.jpg";
import f5 from "@/assets/f5.jpg";
import f6 from "@/assets/f6.jpg";
import c1 from "@/assets/c1.jpg";
import c2 from "@/assets/c2.jpg";
import c3 from "@/assets/c3.jpg";
import cb1 from "@/assets/cb1.jpg";
import legendaryFusion from "@/assets/homepage/legendary-fusion.jpeg";
import jungleAdventure from "@/assets/homepage/jungle-adventure.jpeg";
import winterAction from "@/assets/homepage/winter-action.jpeg";

export const DEFAULT_HERO_IMAGES = ["legendaryFusion", "jungleAdventure", "winterAction"];

export const IMAGES: Record<string, string> = { g1, g2, g3, g4, g5, g6, g7, g8, f1, f2, f3, f4, f5, f6, c1, c2, c3, cb1, legendaryFusion, jungleAdventure, winterAction };
export const img = (key: string) => IMAGES[key] ?? (/^https:\/\//.test(key) ? key : g1);
