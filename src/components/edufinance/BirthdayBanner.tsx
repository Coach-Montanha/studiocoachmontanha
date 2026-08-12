import { Cake, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type BirthdayStudent = {
  id: string;
  name: string;
  phone?: string | null;
  birth_date: string;
  type: "studio" | "pt";
};

interface BirthdayBannerProps {
  students: BirthdayStudent[];
}

export function BirthdayBanner({ students }: BirthdayBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible || students.length === 0) return null;

  const handleWhatsApp = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const message = encodeURIComponent(`Olá ${name}, parabéns pelo seu aniversário! Desejamos muita saúde, treinos e conquistas! 🎉💪`);
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank");
  };

  // Sort by day
  const sorted = [...students].sort((a, b) => {
    const dayA = new Date(a.birth_date + "T12:00").getDate();
    const dayB = new Date(b.birth_date + "T12:00").getDate();
    return dayA - dayB;
  });

  return (
    <div className="relative mb-6 overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm transition-all animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-center gap-2 text-primary">
            <Cake className="h-5 w-5 animate-bounce text-state-pending" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">
              Aniversariantes do Mês
            </h3>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {sorted.map((student) => {
              const day = new Date(student.birth_date + "T12:00").getDate();
              return (
                <div
                  key={`${student.type}-${student.id}`}
                  className="flex items-center gap-2 rounded-lg bg-card/50 px-3 py-1.5 ring-1 ring-inset ring-primary/10 transition-ui hover:bg-card"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground">
                        {student.name}
                      </span>
                      <Badge variant="outline" className={cn(
                        "h-4 px-1 text-[10px] font-bold uppercase",
                        student.type === "pt" ? "border-amber-500/30 text-amber-600 bg-amber-50" : "border-blue-500/30 text-blue-600 bg-blue-50"
                      )}>
                        {student.type}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Dia {day}
                    </div>
                  </div>
                  
                  {student.phone && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full text-green-600 hover:bg-green-50 hover:text-green-700"
                      onClick={() => handleWhatsApp(student.phone!, student.name)}
                      title={`Enviar parabéns para ${student.name}`}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => setIsVisible(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
