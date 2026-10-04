export default function MapView({ containerRef }) {
  return (
    <main className="relative h-full flex-1 overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
    </main>
  );
}
