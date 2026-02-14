import logoColor from "@/assets/brand/SynozurMark_color1400_1763228452349.png";
import logoWhite from "@/assets/brand/SynozurLogo_white 1400_1763228452349.png";
import logoHorizontal from "@/assets/brand/SA-Logo-Horizontal-color_1763228452349.png";

type SynozurLogoProps = {
  variant?: "mark" | "full" | "horizontal";
  className?: string;
};

export function SynozurLogo({ variant = "mark", className = "" }: SynozurLogoProps) {
  const logoSrc = variant === "full" ? logoWhite : variant === "horizontal" ? logoHorizontal : logoColor;
  
  return (
    <img 
      src={logoSrc} 
      alt="Synozur Alliance" 
      className={className}
    />
  );
}
