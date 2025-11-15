import { AIChatPanel } from "../AIChatPanel";

export default function AIChatPanelExample() {
  return (
    <div className="h-screen">
      <AIChatPanel onClose={() => console.log("Chat panel closed")} />
    </div>
  );
}
