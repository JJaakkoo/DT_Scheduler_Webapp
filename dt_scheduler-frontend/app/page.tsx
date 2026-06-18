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

          {/* Log In Page Container */}
          <div className="relative z-10 max-w-[448] h-[540] bg-dreamtea-white rounded-3xl flex flex-col items-center shrink-0 p-8">
            
            {/* Logo and Title Container */}
            <div className="flex flex-row items-center">
              <img
                src="/dreamtealogo.svg"
                alt="Dream Tea Logo"
                className="object-contain"
              />
              <h1 className="font-inter font-bold text-[12px] text-left text-text-primary p-1">
                Dream Tea Nexus
              </h1>
            </div>

            {/* Welcome Back Container */}
            <h1 className="font-inter font-bold text-[40px] p-10">
              Welcome Back
            </h1>

            <div className="h-[100] w-[100] border-2">
            </div>
            <div className="h-[100] w-[100] border-2">
            </div>
          </div>
        </div>
      </div>
    </main>
  );

}``