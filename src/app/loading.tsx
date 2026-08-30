export default function Loading() {
  return (
    <div className="container py-20">
      <div className="skeleton h-8 w-56" />
      <div className="mt-4 skeleton h-4 w-80" />
      <div className="mt-12 grid grid-cols-2 gap-6 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton aspect-[4/5] w-full" />
            <div className="mt-4 skeleton h-3 w-20" />
            <div className="mt-2.5 skeleton h-4 w-32" />
            <div className="mt-2.5 skeleton h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
