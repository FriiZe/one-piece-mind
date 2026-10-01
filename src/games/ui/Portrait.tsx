import Image from "next/image";
import { portraitUrl } from "../cards";

/** Portrait d'un personnage dans un cadre de taille fixe, centré par défaut. `className` : taille et placement. */
export function Portrait({ img, className = "mx-auto h-32 w-24" }: { img: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border-2 border-sea-600 bg-sea-900 ${className}`}>
      <Image src={portraitUrl(img)} alt="" fill sizes="160px" className="object-cover object-top" />
    </div>
  );
}
