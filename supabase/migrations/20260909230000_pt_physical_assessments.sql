-- Tabela de Avaliações Físicas e Antropometria (Personal Trainer)
create table if not exists public.pt_physical_assessments (
  id uuid primary key default gen_random_uuid(),
  pt_student_id uuid not null references public.pt_students(id) on delete cascade,
  user_id uuid not null,
  assessment_date date not null default current_date,
  weight numeric(5,2) not null,
  height numeric(5,2) not null,
  body_fat_percentage numeric(4,1),
  muscle_mass_percentage numeric(4,1),
  notes text,

  -- Circunferências (cm)
  chest numeric(5,2),
  waist numeric(5,2),
  abdomen numeric(5,2),
  hips numeric(5,2),
  right_arm numeric(5,2),
  left_arm numeric(5,2),
  right_thigh numeric(5,2),
  left_thigh numeric(5,2),
  right_calf numeric(5,2),
  left_calf numeric(5,2),

  -- Fotos de avaliação
  photo_front text,
  photo_back text,
  photo_side text,

  created_at timestamptz default now()
);

-- Índices para buscas rápidas
create index if not exists idx_pt_physical_assessments_student 
  on public.pt_physical_assessments (pt_student_id, assessment_date desc);
