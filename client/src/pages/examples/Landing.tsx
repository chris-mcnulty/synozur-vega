import Landing from "../Landing";
import { ThemeProvider } from "@/components/ThemeProvider";

export default function LandingExample() {
  return (
    <ThemeProvider>
      <Landing />
    </ThemeProvider>
  );
}
