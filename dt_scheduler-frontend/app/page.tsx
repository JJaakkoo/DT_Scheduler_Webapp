export default function Home() {
  return (
    <main className="h-screen w-screen flex items-center justify-center bg-dreamtea-light p-8">
      <div className="w-full max-w-5xl h-[540] bg-white rounded-3xl flex-row overflow-hidden shadow-xl">
        <div className="w-full max-w-5xl h-[540] relative overflow-hidden">
          <img
            src="/Background Image.png"
            alt="The inside of Dream Tea"
            className="absolute top-0 right-0 h-full w-max-0.7 object-cover"
          />
        <div className="relative z-10 w-[448] h-[540] bg-dreamtea-white rounded-3xl flex-col">
          
        </div>
        </div>
      </div>
    </main>
  );

}