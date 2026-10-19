import g1 from "@/assets/g1.jpg";
import g2 from "@/assets/g2.jpg";
import g3 from "@/assets/g3.jpg";
import g4 from "@/assets/g4.jpg";
import g5 from "@/assets/g5.jpg";
import g6 from "@/assets/g6.jpg";
import g7 from "@/assets/g7.jpg";
import g8 from "@/assets/g8.jpg";

export const IMAGES: Record<string, string> = { g1, g2, g3, g4, g5, g6, g7, g8 };
export const img = (key: string) => IMAGES[key] ?? g1;
