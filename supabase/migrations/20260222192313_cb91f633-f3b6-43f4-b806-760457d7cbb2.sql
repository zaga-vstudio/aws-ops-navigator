-- Make compliance_remediation_log append-only by denying UPDATE and DELETE
CREATE POLICY "Deny compliance log updates"
  ON public.compliance_remediation_log FOR UPDATE
  USING (false);

CREATE POLICY "Deny compliance log deletion"
  ON public.compliance_remediation_log FOR DELETE
  USING (false);