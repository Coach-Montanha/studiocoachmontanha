
CREATE POLICY "Super admin can delete students" ON public.students FOR DELETE USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can delete payments" ON public.payments FOR DELETE USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can delete pt_students" ON public.pt_students FOR DELETE USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can delete pt_payments" ON public.pt_payments FOR DELETE USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can delete expenses" ON public.expenses FOR DELETE USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can delete plans" ON public.plans FOR DELETE USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can delete student_plan_history" ON public.student_plan_history FOR DELETE USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can delete student_contracts" ON public.student_contracts FOR DELETE USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can delete pt_student_contracts" ON public.pt_student_contracts FOR DELETE USING (public.is_super_admin(auth.uid()));

-- Also grant super_admin UPDATE/INSERT/DELETE where missing on ancillary tables
CREATE POLICY "Super admin can update expenses" ON public.expenses FOR UPDATE USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can insert expenses" ON public.expenses FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can select expenses" ON public.expenses FOR SELECT USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin can update plans" ON public.plans FOR UPDATE USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can insert plans" ON public.plans FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can select plans" ON public.plans FOR SELECT USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin can update student_plan_history" ON public.student_plan_history FOR UPDATE USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can insert student_plan_history" ON public.student_plan_history FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can select student_plan_history" ON public.student_plan_history FOR SELECT USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin can update student_contracts" ON public.student_contracts FOR UPDATE USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can insert student_contracts" ON public.student_contracts FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can select student_contracts" ON public.student_contracts FOR SELECT USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin can update pt_student_contracts" ON public.pt_student_contracts FOR UPDATE USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can insert pt_student_contracts" ON public.pt_student_contracts FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admin can select pt_student_contracts" ON public.pt_student_contracts FOR SELECT USING (public.is_super_admin(auth.uid()));
