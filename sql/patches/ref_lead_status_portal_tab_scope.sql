-- Visibilidad de refLeadStatus en tabs del Portal (Case Manager / Active Leads)
-- (ALTER se ejecuta en apply-ref-lead-status-portal-tab-scope.js con manejo de columna existente)

UPDATE refLeadStatus SET portal_tab_scope = 'both'
WHERE leadStatus IN ('New Lead', 'CNA', 'Pending', 'Locked Down');

UPDATE refLeadStatus SET portal_tab_scope = 'case_manager'
WHERE leadStatus IN ('Came In', 'Dropped');

UPDATE refLeadStatus SET portal_tab_scope = 'hidden'
WHERE leadStatus IN (
  'Call Back', 'No Show', 'Rescheduled', 'Problem', 'Came in - unverified'
);
