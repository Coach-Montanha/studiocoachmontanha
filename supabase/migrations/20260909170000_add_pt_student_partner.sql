-- Adiciona coluna partner_student_id na tabela pt_students para suporte a alunos em dupla
ALTER TABLE public.pt_students ADD COLUMN IF NOT EXISTS partner_student_id uuid REFERENCES public.pt_students(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pt_students_partner ON public.pt_students(partner_student_id);
