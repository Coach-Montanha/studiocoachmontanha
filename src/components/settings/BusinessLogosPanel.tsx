import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, Dumbbell, User, Home } from "lucide-react";
import { toast } from "sonner";

const LOGO_PT_KEY = "coach.logo.pt";
const LOGO_STUDIO_KEY = "coach.logo.studio";

export function BusinessLogosPanel() {
  const [logoPt, setLogoPt] = useState<string | null>(null);
  const [logoStudio, setLogoStudio] = useState<string | null>(null);

  useEffect(() => {
    setLogoPt(localStorage.getItem(LOGO_PT_KEY));
    setLogoStudio(localStorage.getItem(LOGO_STUDIO_KEY));
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, key: string, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit for localStorage
        toast.error("Imagem muito grande. Use uma imagem menor que 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        localStorage.setItem(key, base64);
        setter(base64);
        toast.success("Logo atualizada com sucesso!");
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = (key: string, setter: (val: string | null) => void) => {
    localStorage.removeItem(key);
    setter(null);
    toast.success("Logo removida.");
  };

  return (
    <Card className="p-5 space-y-6">
      <div>
        <h2 className="text-base font-semibold">Identidade Visual (Logos)</h2>
        <p className="text-sm text-muted-foreground">
          Configure as logos que serão exibidas no portal e nos compartilhamentos de resultados.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Personal Trainer Logo */}
        <div className="space-y-4 rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Logo Personal Trainer</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Usada no compartilhamento de resultados de treinos PT.
          </p>
          
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-muted border-2 border-dashed border-muted-foreground/20 overflow-hidden">
              {logoPt ? (
                <img src={logoPt} className="h-full w-full object-contain" alt="PT Logo" />
              ) : (
                <Dumbbell className="h-10 w-10 text-muted-foreground/40" />
              )}
            </div>
            
            <div className="flex w-full gap-2">
              <input
                type="file"
                id="logo-pt-input"
                className="hidden"
                accept="image/*"
                onChange={(e) => handleLogoUpload(e, LOGO_PT_KEY, setLogoPt)}
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 gap-2"
                onClick={() => document.getElementById("logo-pt-input")?.click()}
              >
                <Upload className="h-3.5 w-3.5" /> Subir
              </Button>
              {logoPt && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => removeLogo(LOGO_PT_KEY, setLogoPt)}
                >
                  Remover
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Studio Logo */}
        <div className="space-y-4 rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Logo Studio</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Usada no portal do aluno e comunicações do Studio.
          </p>
          
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-muted border-2 border-dashed border-muted-foreground/20 overflow-hidden">
              {logoStudio ? (
                <img src={logoStudio} className="h-full w-full object-contain" alt="Studio Logo" />
              ) : (
                <Home className="h-10 w-10 text-muted-foreground/40" />
              )}
            </div>
            
            <div className="flex w-full gap-2">
              <input
                type="file"
                id="logo-studio-input"
                className="hidden"
                accept="image/*"
                onChange={(e) => handleLogoUpload(e, LOGO_STUDIO_KEY, setLogoStudio)}
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 gap-2"
                onClick={() => document.getElementById("logo-studio-input")?.click()}
              >
                <Upload className="h-3.5 w-3.5" /> Subir
              </Button>
              {logoStudio && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => removeLogo(LOGO_STUDIO_KEY, setLogoStudio)}
                >
                  Remover
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
