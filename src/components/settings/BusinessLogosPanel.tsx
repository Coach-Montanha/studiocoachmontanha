import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Dumbbell, User, Home, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const LOGO_PT_KEY = "coach.logo.pt";
const LOGO_STUDIO_KEY = "coach.logo.studio";

export function BusinessLogosPanel() {
  const { user } = useAuth();
  const [logoPt, setLogoPt] = useState<string | null>(null);
  const [logoStudio, setLogoStudio] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    async function loadLogos() {
      if (!user) return;
      
      const { data, error } = await supabase
        .from("studio_settings")
        .select("logo_pt_base64, logo_studio_base64")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        if (data.logo_pt_base64) {
          setLogoPt(data.logo_pt_base64);
          localStorage.setItem(LOGO_PT_KEY, data.logo_pt_base64);
        }
        if (data.logo_studio_base64) {
          setLogoStudio(data.logo_studio_base64);
          localStorage.setItem(LOGO_STUDIO_KEY, data.logo_studio_base64);
        }
      } else {
        setLogoPt(localStorage.getItem(LOGO_PT_KEY));
        setLogoStudio(localStorage.getItem(LOGO_STUDIO_KEY));
      }
      setLoading(false);
    }
    loadLogos();
  }, [user]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: string, field: 'logo_pt_base64' | 'logo_studio_base64', setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file && user) {
      if (file.size > 1024 * 1024) {
        toast.error("Imagem muito grande. Use uma imagem menor que 1MB.");
        return;
      }
      setUploading(field);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        
        const { error } = await supabase
          .from("studio_settings")
          .upsert({ 
            user_id: user.id,
            [field]: base64,
            updated_at: new Date().toISOString()
          });

        if (error) {
          toast.error("Erro ao salvar no servidor: " + error.message);
        } else {
          localStorage.setItem(key, base64);
          setter(base64);
          toast.success("Logo salva com sucesso!");
        }
        setUploading(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = async (key: string, field: 'logo_pt_base64' | 'logo_studio_base64', setter: (val: string | null) => void) => {
    if (!user) return;
    setUploading(field);
    const { error } = await supabase
      .from("studio_settings")
      .upsert({ 
        user_id: user.id,
        [field]: null,
        updated_at: new Date().toISOString()
      });

    if (error) {
      toast.error("Erro ao remover do servidor");
    } else {
      localStorage.removeItem(key);
      setter(null);
      toast.success("Logo removida.");
    }
    setUploading(null);
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
                onChange={(e) => handleLogoUpload(e, LOGO_PT_KEY, 'logo_pt_base64', setLogoPt)}
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 gap-2"
                onClick={() => document.getElementById("logo-pt-input")?.click()}
                disabled={uploading === 'logo_pt_base64'}
              >
                {uploading === 'logo_pt_base64' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Subir
              </Button>
              {logoPt && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => removeLogo(LOGO_PT_KEY, 'logo_pt_base64', setLogoPt)}
                  disabled={uploading === 'logo_pt_base64'}
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
                onChange={(e) => handleLogoUpload(e, LOGO_STUDIO_KEY, 'logo_studio_base64', setLogoStudio)}
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 gap-2"
                onClick={() => document.getElementById("logo-studio-input")?.click()}
                disabled={uploading === 'logo_studio_base64'}
              >
                {uploading === 'logo_studio_base64' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Subir
              </Button>
              {logoStudio && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => removeLogo(LOGO_STUDIO_KEY, 'logo_studio_base64', setLogoStudio)}
                  disabled={uploading === 'logo_studio_base64'}
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
