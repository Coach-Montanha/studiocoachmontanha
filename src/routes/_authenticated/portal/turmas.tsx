import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portal/turmas")({
  head: () => ({ meta: [{ title: "Minhas turmas" }] }),
  component: PortalTurmas,
});

const DOW = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function PortalTurmas() {
  const qc = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["portal-me-id3"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("students")
        .select("id")
        .eq("account_user_id", u.user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: allClasses = [] } = useQuery({
    queryKey: ["portal-all-classes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("classes")
        .select("id,name,trainer_name,day_of_week,start_time,duration_minutes,capacity,is_active")
        .eq("is_active", true)
        .order("day_of_week")
        .order("start_time");
      return data ?? [];
    },
  });

  const { data: enrollments = [], refetch: refetchEnroll } = useQuery({
    queryKey: ["portal-enrollments", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("class_enrollments")
        .select("id,class_id,active")
        .eq("student_id", me!.id);
      return data ?? [];
    },
  });

  // Count enrollments per class for capacity
  const { data: counts = {} } = useQuery({
    queryKey: ["portal-class-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("class_enrollments")
        .select("class_id")
        .eq("active", true);
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        map[r.class_id] = (map[r.class_id] ?? 0) + 1;
      });
      return map;
    },
  });

  const enrolledSet = new Set(enrollments.filter((e: any) => e.active).map((e: any) => e.class_id));
  const myClasses = allClasses.filter((c) => enrolledSet.has(c.id));
  const availableClasses = allClasses.filter((c) => {
    const filled = (counts as any)[c.id] ?? 0;
    return !enrolledSet.has(c.id) && filled < c.capacity;
  });

  async function enroll(classId: string, classUserId?: string) {
    if (!me) return;
    // Also insert user_id for the studio owner (from the class row)
    const { data: cls } = await supabase.from("classes").select("user_id").eq("id", classId).maybeSingle();
    if (!cls) return toast.error("Turma inválida");
    const existing = enrollments.find((e: any) => e.class_id === classId);
    if (existing) {
      const { error } = await supabase
        .from("class_enrollments")
        .update({ active: true })
        .eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("class_enrollments").insert({
        user_id: cls.user_id,
        class_id: classId,
        student_id: me.id,
        active: true,
      });
      if (error) return toast.error(error.message);
    }
    toast.success("Inscrito!");
    await refetchEnroll();
    qc.invalidateQueries({ queryKey: ["portal-class-counts"] });
    qc.invalidateQueries({ queryKey: ["portal-my-classes"] });
  }

  async function cancel(classId: string) {
    const existing = enrollments.find((e: any) => e.class_id === classId);
    if (!existing) return;
    const { error } = await supabase
      .from("class_enrollments")
      .update({ active: false })
      .eq("id", existing.id);
    if (error) return toast.error(error.message);
    toast.success("Inscrição cancelada");
    await refetchEnroll();
    qc.invalidateQueries({ queryKey: ["portal-class-counts"] });
    qc.invalidateQueries({ queryKey: ["portal-my-classes"] });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Minhas turmas</h1>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">Minhas ({myClasses.length})</TabsTrigger>
          <TabsTrigger value="available">Disponíveis ({availableClasses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="space-y-2">
          {myClasses.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              Você não está inscrito em nenhuma turma ainda.
            </Card>
          ) : (
            myClasses.map((c) => (
              <Card key={c.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {DOW[c.day_of_week ?? 0]} · {String(c.start_time).slice(0, 5)} · {c.duration_minutes} min
                    {c.trainer_name && <> · {c.trainer_name}</>}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => cancel(c.id)}>
                  Cancelar inscrição
                </Button>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="available" className="space-y-2">
          {availableClasses.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground">
              Nenhuma turma disponível no momento.
            </Card>
          ) : (
            availableClasses.map((c) => {
              const filled = (counts as any)[c.id] ?? 0;
              return (
                <Card key={c.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {DOW[c.day_of_week ?? 0]} · {String(c.start_time).slice(0, 5)} · {c.duration_minutes} min
                      {c.trainer_name && <> · {c.trainer_name}</>}
                    </div>
                    <div className="text-xs mt-1">
                      Vagas: {c.capacity - filled}/{c.capacity}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => enroll(c.id)}>Inscrever-me</Button>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
