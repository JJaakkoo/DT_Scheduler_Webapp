export const getLocationTheme = (location: string) => {
  const loc = (location || "").toLowerCase();
  if (loc.includes("whyte")) return { text: "text-[#CAB1E3]", border: "border-[#CAB1E3]", icon: "text-[#CAB1E3]", leftBar: "bg-[#CAB1E3]", fill: "bg-[#CAB1E3]" };
  if (loc.includes("heritage")) return { text: "text-[#ED9BB4]", border: "border-[#ED9BB4]", icon: "text-[#ED9BB4]", leftBar: "bg-[#ED9BB4]", fill: "bg-[#ED9BB4]" };
  if (loc.includes("downtown") || loc.includes("dt")) return { text: "text-[#A0B99B]", border: "border-[#A0B99B]", icon: "text-[#A0B99B]", leftBar: "bg-[#A0B99B]", fill: "bg-[#A0B99B]" };
  if (loc.includes("north")) return { text: "text-purple-500", border: "border-purple-200", icon: "text-purple-300", leftBar: "bg-purple-300", fill: "bg-purple-300" };
  return { text: "text-sky-500", border: "border-sky-200", icon: "text-sky-300", leftBar: "bg-[#8ab4f8]", fill: "bg-[#8ab4f8]" };
};
