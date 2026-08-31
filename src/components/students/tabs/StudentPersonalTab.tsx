import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserRound, Pencil, IdCard, MapPin, FileText } from "lucide-react";
import { formatDateBR } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PersonalStudent = {
  name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  start_date: string | null;
  created_at: string;
  cpf: string | null;
  rg: string | null;
  address: string | null;
  postal_code: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  notes: string | null;
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="text-[11px] font-semibold uppercase leading-none tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("truncate text-sm leading-6", value ? "font-medium" : "text-muted-foreground")}>
        {value || "—"}
      </div>
    </div>
  );
}

export function StudentPersonalTab({
  student,
  onEdit,
}: {
  student: PersonalStudent;
  onEdit: () => void;
}) {
  const addressLine = [
    student.address,
    student.neighborhood,
    [student.city, student.state].filter(Boolean).join(" / "),
    student.postal_code,
    student.country,
  ]
    .filter((v) => v && String(v).trim().length > 0)
    .join(" · ");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <UserRound className="h-4 w-4 text-primary" /> Contato
          </h2>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-xs font-semibold text-primary transition-all duration-200 hover:bg-primary/10 active:scale-[0.98]"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" value={student.name} />
          <Field label="Email" value={student.email} />
          <Field label="Telefone" value={student.phone} />
          <Field
            label="Nascimento"
            value={student.birth_date ? formatDateBR(student.birth_date) : null}
          />
          <Field
            label="Início"
            value={student.start_date ? formatDateBR(student.start_date) : null}
          />
          <Field label="Cadastro" value={formatDateBR(student.created_at)} />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <IdCard className="h-4 w-4 text-primary" /> Documentos
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CPF" value={student.cpf} />
          <Field label="RG" value={student.rg} />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <MapPin className="h-4 w-4 text-primary" /> Endereço
        </h2>
        {addressLine ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Logradouro" value={student.address} />
            <Field label="Bairro" value={student.neighborhood} />
            <Field label="Cidade" value={student.city} />
            <Field label="Estado" value={student.state} />
            <Field label="CEP" value={student.postal_code} />
            <Field label="País" value={student.country} />
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            Nenhum endereço cadastrado. Use <span className="font-medium text-foreground">Editar</span> para preencher.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-primary" /> Observações
        </h2>
        <p className={cn("text-sm leading-6", student.notes ? "" : "text-muted-foreground")}>
          {student.notes || "Sem observações."}
        </p>
      </Card>
    </div>
  );
}
