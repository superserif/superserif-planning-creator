import AuthGate from "@/components/auth-gate";
import LineupApp from "@/components/lineup-app";

export default function Home() {
  return (
    <AuthGate>
      <LineupApp />
    </AuthGate>
  );
}
