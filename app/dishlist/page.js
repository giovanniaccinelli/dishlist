import NavBar from "../../components/BottomNav";

export default function Dishlist() {
  return (
    <main className="bg-zinc-950 text-white min-h-screen flex flex-col justify-center items-center">
      <h1 className="text-3xl font-bold">My Dishlist</h1>
      <p className="mt-4 text-zinc-400">Your saved dishes will appear here.</p>
      <NavBar />
    </main>
  );
}
