-- Staff who enroll MFA must complete it before reading/updating support tickets.
ALTER POLICY "Admins read tickets" ON public.support_tickets
 USING (public.has_role((select auth.uid()), 'admin') AND (select private.account_aal_allowed()));
ALTER POLICY "Admins update tickets" ON public.support_tickets
 USING (public.has_role((select auth.uid()), 'admin') AND (select private.account_aal_allowed()))
 WITH CHECK (public.has_role((select auth.uid()), 'admin') AND (select private.account_aal_allowed()));
